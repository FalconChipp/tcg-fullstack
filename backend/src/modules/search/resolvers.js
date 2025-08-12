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

// ADDED: limit concurrency & add timeouts so upstream flakiness doesn't stall requests
import pLimit from 'p-limit';

const PRICE_TIMEOUT_MS = Number(process.env.PRICE_FETCH_TIMEOUT_MS || 5000); // ADDED
const PRICE_CONCURRENCY = Number(process.env.PRICE_CONCURRENCY || 6);       // ADDED
const DISABLE_ENRICH = process.env.DISABLE_PRICE_ENRICHMENT === '1';         // ADDED

function withTimeout(promise, ms, label = 'timeout') { // ADDED
  let t;
  const timer = new Promise((_, rej) => (t = setTimeout(() => rej(new Error(label)), ms)));
  return Promise.race([promise.finally(() => clearTimeout(t)), timer]);
}

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
  // CHANGED: cap concurrency and fail-open on individual cards
  const limit = pLimit(PRICE_CONCURRENCY);
  const cardIds = cards.map(c => c.id);

  // Step 1: Hydrate and persist each card in DB with all available data and prices
  const settle = await Promise.allSettled(cards.map(card => limit(async () => {
    // Hydrate the card object before saving
    const hydratedCard = await withTimeout(hydrateCard(card), PRICE_TIMEOUT_MS, 'hydrate-timeout').catch(() => card);

    // Fetch price data (cached -> fetch -> fail-open)
    let priceData = null;
    if (!DISABLE_ENRICH) {
      const ptcgId = tcgdexToPtcgId(card.id);
      if (ptcgId) {
        // Try cache first
        priceData = await getCardPriceCache(card.id);
        if (!priceData) {
          // CHANGED: wrap in timeout and swallow errors (404/504 -> null)
          priceData = await withTimeout(fetchPTCGCardPrices(ptcgId), PRICE_TIMEOUT_MS, 'price-timeout')
            .catch(() => null);
          if (priceData) {
            await saveCardPriceCache(card.id, priceData).catch(() => {});
          }
        }
      }
    }

    // Save or update in DB (CHANGED: tolerate null priceData)
    await saveOrUpdateCard(hydratedCard, priceData).catch(() => {});
  })));

  // Optional: log any hard rejections (without failing the request)
  // settle.forEach(r => { if (r.status === 'rejected') console.warn('[enrich] ', r.reason); });

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
    let dbCard = await Card.findByPk(card.id).catch(() => null);
    dbCard = dbCard || card;

    const { setId, setName, setLogo } = normalizeCardSet(dbCard);

    // CHANGED: safe return object (no throws if dbCard is a plain API object)
    const base = dbCard.dataValues ? dbCard.dataValues : dbCard;

    return {
      ...base,
      setName: setName ?? base.setName ?? null,
      setLogo: setLogo ?? base.setLogo ?? null,
      image: base.image || tcgdexImageUrl({ ...base, set: setId }),
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

  // Optional in-memory cache key (name/set/number/page/pageSize only)
  const cacheKey = JSON.stringify({ name, set, number, page, pageSize, rarity, listed, forTrade });
  const cached = getCachedSearch(cacheKey);
  if (cached) return cached; // ADDED: quick win

  // Step 1: Normalize set code and check blocklist
  let setCode = set ? normalizeSetCode(set) : null;
  if (setCode && isSetBlocked(setCode)) {
    const empty = { cards: [], total: 0, page, pageSize };
    setCachedSearch(cacheKey, empty, 60_000);
    return empty;
  }

  // Step 2: Fetch paginated results from TCGDex API (CHANGED: timeout + fail-open)
  const { cards = [], total = 0 } = await withTimeout(
    fetchTCGDexCards({ name, set: setCode, number, page, pageSize }),
    Number(process.env.SEARCH_FETCH_TIMEOUT_MS || 8000),
    'tcgdex-search-timeout'
  ).catch(() => ({ cards: [], total: 0 }));

  // Defensive: Ensure every card has a set field. If not, re-fetch from TCGDex by ID.
  const fixedCards = await Promise.all(cards.map(async (c) => {
    if (!c?.set) {
      try {
        const full = await withTimeout(fetchTCGDexCardById(c.id), 3000, 'tcgdex-byid-timeout');
        return full || c;
      } catch {
        return c;
      }
    }
    return c;
  }));

  // Remove cards from blocked sets (should be rare)
  let filtered = fixedCards.filter(card =>
    card.set && (typeof card.set === "object" ? card.set.id : card.set) &&
    !isSetBlocked(typeof card.set === "object" ? card.set.id : card.set)
  );

  // ---- Exact set filter ----
  if (setCode) {
    filtered = filtered.filter(card => {
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

  // Step 3: Enrich with pricing, listing, etc (CHANGED: guarded by DISABLE_ENRICH & resilient)
  const enriched = DISABLE_ENRICH
    ? numbered
    : await enrichCards(numbered, { listed, forTrade, rarity }).catch(() => numbered);

  // Step 4: Return page, pageSize, and the total from TCGDex (fallback to enriched length)
  const out = {
    cards: enriched,
    total: total || enriched.length,
    page,
    pageSize,
  };

  setCachedSearch(cacheKey, out, 60_000); // ADDED: cache 1 minute
  return out;
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
    card = await withTimeout(fetchTCGDexCardById(id), 5000, 'tcgdex-byid-timeout').catch(() => null);
    if (!card) return null;
  }
  const enrichedArr = await enrichCards([card], { listed: false, forTrade: false }).catch(() => [card]); // CHANGED
  return enrichedArr[0];
}

// ----------------------
// getSet RESOLVER
// ----------------------
async function getSetResolver(_, { code }) {
  if (isSetBlocked(code)) return null;
  let cardsRes = await withTimeout(fetchTCGDexCards({ set: code }), 8000, 'tcgdex-set-timeout')
    .catch(() => ({ cards: [] }));
  let cards = cardsRes.cards || [];
  cards = cards.filter(card =>
    card.set &&
    (typeof card.set === "object" ? card.set.id : card.set) &&
    !isSetBlocked(typeof card.set === "object" ? card.set.id : card.set)
  );
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
  let allSetCards = await withTimeout(fetchTCGDexCards({ set }), 8000, 'tcgdex-set-timeout')
    .catch(() => ({ cards: [] }));
  const total = getSetUniqueCardCount(set, allSetCards.cards || [], true);
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
        if (typeof parsed === "string") parsed = JSON.parse(parsed);
        if (Array.isArray(parsed)) {
          return parsed.filter(p => p && typeof p.variation === "string");
        }
        if (parsed && typeof parsed === "object" && typeof parsed.variation === "string") {
          return [parsed];
        }
        return [];
      } catch (e) {
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
