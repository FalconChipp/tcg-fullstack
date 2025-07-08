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
  hydrateCard
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
// NOW FETCHES FINAL FIELDS FROM THE DB!
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

  // Step 2: Marketplace listings
  let listingsMap = {};
  if (listed) {
    const listings = await Listing.findAll({ where: { cardId: cardIds, status: 'active' } });
    for (const l of listings) {
      if (!listingsMap[l.cardId]) listingsMap[l.cardId] = [];
      listingsMap[l.cardId].push(l.toJSON());
    }
  }

  // Step 3: For-trade flags
  let forTradeMap = {};
  if (forTrade) {
    const tradeEntries = await Collection.findAll({
      where: { cardId: cardIds, wantsTrade: true }
    });
    for (const entry of tradeEntries) {
      forTradeMap[entry.cardId] = true;
    }
  }

  // Step 4: Optional rarity filter
  let filtered = cards;
  if (rarity) {
    filtered = filtered.filter(card =>
      (card.rarity || '').toLowerCase() === rarity.toLowerCase()
    );
  }

  // Step 5: Always return card fields from the DB
  return await Promise.all(filtered.map(async card => {
    // Read fresh card data from the DB (including updated pricing and variations)
    let dbCard = await Card.findByPk(card.id);

    // Defensive fallback: if not in DB, fallback to original card
    dbCard = dbCard || card;

    // Normalize set fields for return
    const { setId, setName, setLogo } = normalizeCardSet(dbCard);

    return {
      ...dbCard.dataValues, // All card fields as persisted
      setName: setName ?? dbCard.setName ?? null,
      setLogo: setLogo ?? dbCard.setLogo ?? null,
      image: dbCard.image || tcgdexImageUrl({ ...dbCard, set: setId }),
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
  // Read enriched card from DB after update
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
      try { 
        return typeof card.variations === 'string' 
          ? JSON.parse(card.variations) 
          : card.variations; 
      } catch { 
        return null; 
      }
    },
    prices: (card) => {
      // Return an empty array if nothing stored
      if (!card.pricing) return [];
      try {
        let parsed = card.pricing;
        // If it's a string, parse it. If already an array/object, leave as is.
        if (typeof parsed === "string") parsed = JSON.parse(parsed);
        if (Array.isArray(parsed)) {
          // Remove nulls and only allow objects with a non-null 'variation' (for GraphQL non-null)
          return parsed.filter(p => p && typeof p.variation === "string");
        }
        // If it's a single object (not an array), wrap in array if it has a variation
        if (parsed && typeof parsed === "object" && typeof parsed.variation === "string") {
          return [parsed];
        }
        // If nothing matches, return empty array
        return [];
      } catch (e) {
        // Log the error to help with debugging (optional)
        console.error('Failed to parse Card.pricing:', e, card.pricing);
        return [];
      }
    },
    setName: (card) => card.setName || null, 
    image: (card) => card.image || null,
    rarity: (card) => card.rarity || null, 
  }
};

export default resolvers;
