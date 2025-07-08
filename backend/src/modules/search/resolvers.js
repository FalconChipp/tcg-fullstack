import {
  normalizeSetCode,
  isSetBlocked,
  tcgdexImageUrl,
  getSetUniqueCardCount,
  getAllRarities,
  getCardPriceCache,
  saveCardPriceCache,
  tcgdexToPtcgId,
  convertToGBP,
  hydrateCard // NEW: Import hydrateCard helper for complete field hydration
} from './helpers.js';

import { fetchTCGDexCards, fetchTCGDexCardById } from './api/tcgdex.js';
import { fetchPTCGCardById, fetchPTCGCardPrices } from './api/pokemontcg.js';
import { getExchangeRates } from './api/exchangeRates.js';
import { saveOrUpdateCard } from './cardPersistence.js';

import { SET_MAPPING } from './SetMapping.js';
import { Card, Listing, Collection } from '../../models/index.js';

// -----------------------------------------------
// Utility: Normalize set data for a given card
// Returns consistent { setId, setName, setLogo }
// -----------------------------------------------
function normalizeCardSet(card) {
  let setId = null, setName = null, setLogo = null;
  if (card.set && typeof card.set === "object") {
    setId = card.set.id || null;
    setName = card.set.name || null;
    setLogo = card.set.logo || null;
  } else if (card.set && typeof card.set === "string") {
    setId = card.set;
    if (SET_MAPPING[setId]) {
      setName = SET_MAPPING[setId].name || null;
      setLogo = SET_MAPPING[setId].logo || null;
    }
  }
  if (!setId && typeof card.id === "string") {
    const m = card.id.match(/^([a-z0-9.]+)[-]/i);
    if (m) setId = m[1];
    if (setId && SET_MAPPING[setId]) {
      setName = SET_MAPPING[setId].name || null;
      setLogo = SET_MAPPING[setId].logo || null;
    }
  }
  if (setId && SET_MAPPING[setId]) {
    setName = setName || SET_MAPPING[setId].name || null;
    setLogo = setLogo || SET_MAPPING[setId].logo || null;
  }
  return { setId, setName, setLogo };
}

// -----------------------------
// In-memory search result cache
// -----------------------------
const searchCache = new Map();

function getCachedSearch(key) {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    searchCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedSearch(key, value, ttl = 60 * 60 * 1000) {
  searchCache.set(key, { value, expiry: Date.now() + ttl });
}

// -------------------------------------------
// ENRICH CARDS (price, listing, set info, etc)
// -------------------------------------------
async function enrichCards(cards, { listed, forTrade, rarity }) {
  const cardIds = cards.map(c => c.id);

  // Step 1: Hydrate and persist each card in DB with all available data and prices
  for (const card of cards) {
    // Hydrate the card object before saving
    const hydratedCard = await hydrateCard(card);

    // Fetch price data for this card from PTCG API
    let ptcgId = tcgdexToPtcgId(card.id);
    let priceData = null;
    if (ptcgId) {
      priceData = await fetchPTCGCardPrices(ptcgId);
    }
    // Save or update in DB
    await saveOrUpdateCard(hydratedCard, priceData);
  }

  // Step 2: Price cache lookup/update per card
  const priceMap = {};
  for (const card of cards) {
    let priceCache = await getCardPriceCache(card.id);
    let needsLiveUpdate = false;

    // Update if missing or >1 day old
    if (!priceCache) {
      needsLiveUpdate = true;
    } else if (priceCache.updatedAt) {
      const updated = new Date(priceCache.updatedAt);
      if (Date.now() - updated.getTime() > 24 * 60 * 60 * 1000) needsLiveUpdate = true;
    }
    if (needsLiveUpdate) {
      const ptcgId = tcgdexToPtcgId(card.id);
      let livePrice = null;
      if (ptcgId) {
        livePrice = await fetchPTCGCardPrices(ptcgId);
        await saveCardPriceCache(card.id, livePrice);
      } else {
        console.warn('[enrichCards] Could not convert card ID to ptcgId for pricing:', card.id);
      }
      priceCache = livePrice;
    }
    priceMap[card.id] = priceCache;
  }

  // Step 3: Marketplace listings
  let listingsMap = {};
  if (listed) {
    const listings = await Listing.findAll({ where: { cardId: cardIds, status: 'active' } });
    for (const l of listings) {
      if (!listingsMap[l.cardId]) listingsMap[l.cardId] = [];
      listingsMap[l.cardId].push(l.toJSON());
    }
  }

  // Step 4: For-trade flags
  let forTradeMap = {};
  if (forTrade) {
    const tradeEntries = await Collection.findAll({
      where: { cardId: cardIds, wantsTrade: true }
    });
    for (const entry of tradeEntries) {
      forTradeMap[entry.cardId] = true;
    }
  }

  // Step 5: Optional rarity filter
  let filtered = cards;
  if (rarity) {
    filtered = filtered.filter(card =>
      (card.rarity || '').toLowerCase() === rarity.toLowerCase()
    );
  }

  // Step 6: Build enriched card objects
  return await Promise.all(filtered.map(async card => {
    // Always normalize set at the top
    const { setId, setName, setLogo } = normalizeCardSet(card);

    // Variations + pricing
    const variations = card.variations || card.variants || {};
    const variationKeys = Object.keys(variations).filter(k => variations[k]);
    const priceInfo = priceMap[card.id] || {};
    let prices = [];

    if (priceInfo && (priceInfo.tcgplayer || priceInfo.cardmarket)) {
      prices = await Promise.all(variationKeys.map(async varName => {
        let tcgVarKey = varName;
        switch (varName) {
          case 'reverse':    tcgVarKey = 'reverseHolofoil'; break;
          case 'holo':       tcgVarKey = 'holofoil'; break;
          case 'normal':     tcgVarKey = 'normal'; break;
          case 'firstEdition': tcgVarKey = 'firstEdition'; break;
          case 'wPromo':     tcgVarKey = 'normal'; break;
          default:           tcgVarKey = varName;
        }

        // Extract prices for this variation from TCGPlayer and CardMarket
        const tcg = priceInfo.tcgplayer?.prices?.[tcgVarKey] || {};
        const cmk = priceInfo.cardmarket?.prices || {};

        let cardmarket = null;
        if (tcgVarKey === 'normal') {
          cardmarket = cmk.trendPrice ?? cmk.averageSellPrice ?? null;
        }
        if (tcgVarKey === 'reverseHolofoil') {
          cardmarket = cmk.reverseHoloTrend ?? cmk.reverseHoloSell ?? null;
        }
        if (tcgVarKey === 'holofoil') {
          cardmarket = cmk.trendPrice ?? cmk.averageSellPrice ?? null;
        }
        if (tcgVarKey === 'firstEdition') {
          cardmarket = cmk.trendPrice ?? null;
        }
        if (tcgVarKey === 'wPromo') {
          cardmarket = cmk.trendPrice ?? cmk.averageSellPrice ?? null;
        }

        // --- CURRENCY CONVERSION TO GBP ---
        let tcgplayerGBP = null, cardmarketGBP = null;
        if (typeof tcg.market === 'number') {
          try {
            tcgplayerGBP = await convertToGBP(tcg.market, 'USD');
          } catch (e) {
            console.warn('[enrichCards] Failed to convert TCGPlayer USD to GBP:', e);
            tcgplayerGBP = null;
          }
        }
        if (typeof cardmarket === 'number') {
          try {
            cardmarketGBP = await convertToGBP(cardmarket, 'EUR');
          } catch (e) {
            console.warn('[enrichCards] Failed to convert CardMarket EUR to GBP:', e);
            cardmarketGBP = null;
          }
        }

        return {
          variation: varName,
          tcgplayer: tcg.market ?? null,
          cardmarket: cardmarket,
          gbp: Math.max(
            tcgplayerGBP !== null ? tcgplayerGBP : 0,
            cardmarketGBP !== null ? cardmarketGBP : 0
          ) || null,
          currency: 'GBP',
          updatedAt: priceInfo.tcgplayer?.updatedAt || priceInfo.cardmarket?.updatedAt || null
        };
      }));
    } else if (variationKeys.length) {
      // If no price info, create placeholder array
      prices = variationKeys.map(varName => ({
        variation: varName,
        tcgplayer: null,
        cardmarket: null,
        gbp: null,
        currency: null,
        updatedAt: null
      }));
    }

    // Defensive: always pass setId to tcgdexImageUrl if needed
    const imageUrl = card.image || tcgdexImageUrl({ ...card, set: setId });

    return {
      id: card.id,
      name: card.name,
      number: card.number,
      setName,
      setLogo,
      image: imageUrl,
      rarity: card.rarity || null,
      variations,
      prices,
      listings: listingsMap[card.id] || [],
      isListed: !!(listingsMap[card.id]?.length),
      isForTrade: !!forTradeMap[card.id],
      setSize: null,
      setCompletion: null
    };
  }));
}

// ----------------------------------------------------
// MAIN searchCards RESOLVER (always uses TCGDex cards)
// ----------------------------------------------------
async function searchCardsResolver(_, { input }, context) {
  const {
    name,
    set,
    number,
    forTrade,
    listed,
    rarity,
    page = 1,
    pageSize = 25
  } = input;

  // Step 1: Normalize set code and check blocklist
  let setCode = set ? normalizeSetCode(set) : null;
  if (setCode && isSetBlocked(setCode)) return { cards: [], total: 0, page, pageSize };

  // Step 2: Fetch paginated results from TCGDex API
  const { cards, total } = await fetchTCGDexCards({
    name,
    set: setCode,
    number,
    page,
    pageSize
  });

  // Defensive: Ensure every card has a set field. If not, re-fetch from TCGDex by ID.
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].set) {
      try {
        cards[i] = await fetchTCGDexCardById(cards[i].id);
      } catch (e) {
        // If it fails, leave the card as-is (shouldn't happen)
      }
    }
  }

  // Remove cards from blocked sets (should be rare)
  let filtered = cards.filter(card =>
    card.set && (typeof card.set === "object" ? card.set.id : card.set) &&
    !isSetBlocked(typeof card.set === "object" ? card.set.id : card.set)
  );

  // ---- Exact set filter ----
  if (setCode) {
    filtered = filtered.filter(card => {
      // Handle both { set: { id } } and set: '...' cases
      const cardSetId =
        typeof card.set === "object" && card.set && card.set.id
          ? card.set.id
          : card.set;
      return cardSetId === setCode;
    });
  }

  // Remove cards with missing or empty number (just in case)
  const numbered = filtered.filter(card =>
    card && typeof card.number === "string" && card.number.trim() !== ""
  );

  // Step 3: Enrich with pricing, listing, etc
  const enriched = await enrichCards(numbered, { listed, forTrade, rarity });

  // Step 4: Return page, pageSize, and the total from TCGDex
  return {
    cards: enriched,
    total: total ?? enriched.length, // fallback to length if total missing
    page,
    pageSize,
  };
}

// ----------------------
// searchSets RESOLVER
// ----------------------
async function searchSetsResolver(_, { query }) {
  const results = [];
  for (const [code, data] of Object.entries(SET_MAPPING)) {
    if (isSetBlocked(code)) continue;
    if (
      !query ||
      (data.name && data.name.toLowerCase().includes(query.toLowerCase())) ||
      code.toLowerCase().includes(query.toLowerCase())
    ) {
      results.push({
        code,
        name: data.name,
        total: data.total || null,
        tcgDexCode: data.tcgdex,
        logo: data.logo || null,
        cards: null
      });
    }
  }
  return { sets: results, total: results.length };
}

// ----------------------
// cardById RESOLVER
// ----------------------
async function cardByIdResolver(_, { id }) {
  let card = await Card.findByPk(id);
  if (!card || !card.set) {
    card = await fetchTCGDexCardById(id);
    if (!card) return null;
  }
  const enrichedArr = await enrichCards([card], {}, null);
  return enrichedArr[0];
}

// ----------------------
// getSet RESOLVER
// ----------------------
async function getSetResolver(_, { code }) {
  if (isSetBlocked(code)) return null;
  let cards = await fetchTCGDexCards({ set: code });
  cards = cards.filter(card => card.set && (typeof card.set === "object" ? card.set.id : card.set) && !isSetBlocked(typeof card.set === "object" ? card.set.id : card.set));
  const total = getSetUniqueCardCount(code, cards, true);
  return {
    code,
    name: SET_MAPPING[code]?.name || code,
    total,
    tcgDexCode: SET_MAPPING[code]?.tcgdex || code,
    logo: SET_MAPPING[code]?.logo || null,
    cards
  };
}

// ----------------------
// cardSetCompletion RESOLVER
// ----------------------
async function cardSetCompletionResolver(_, { userId, set }) {
  const ownedCards = await Collection.findAll({ where: { userId, set } });
  const totalOwned = new Set(ownedCards.map(card => card.cardId)).size;
  let allSetCards = await fetchTCGDexCards({ set });
  const total = getSetUniqueCardCount(set, allSetCards, true);
  return total ? +(totalOwned / total * 100).toFixed(2) : 0;
}

// ----------------------
// getExchangeRates RESOLVER
// ----------------------
async function getExchangeRatesResolver() {
  return getExchangeRates();
}

// ----------------------
// allRarities RESOLVER
// ----------------------
function allRaritiesResolver() {
  return getAllRarities();
}

// ----------------------
// EXPORT RESOLVERS
// ----------------------
const resolvers = {
  Query: {
    searchCards: searchCardsResolver,
    searchSets: searchSetsResolver,
    cardById: cardByIdResolver,
    getSet: getSetResolver,
    cardSetCompletion: cardSetCompletionResolver,
    getExchangeRates: getExchangeRatesResolver,
    allRarities: allRaritiesResolver,
  },

  Card: {
    variations: (card) => {
      if (!card.variations) return null;
      try { return JSON.parse(card.variations); } catch { return null; }
    },
    prices: (card) => {
      if (!card.pricing) return [];
      try {
        const parsed = JSON.parse(card.pricing);
        // If it's already an array (could contain nulls or objects), return as is
        if (Array.isArray(parsed)) return parsed;
        // If it's a single object (not null), wrap it in an array; allow null as [null]
        if (parsed === null) return [null];
        if (typeof parsed === 'object') return [parsed];
        // Fallback for any other type (should not occur)
        return [];
      } catch {
        return [];
      }
    },
    setName: (card) => card.setName || null, 
    image: (card) => card.image || null,
    rarity: (card) => card.rarity || null, 
  }
};

export default resolvers;
