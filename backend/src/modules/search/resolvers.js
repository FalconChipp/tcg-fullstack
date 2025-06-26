import {
  normalizeSetCode,
  isSetBlocked,
  tcgdexImageUrl,
  getSetUniqueCardCount,
  getAllRarities,
  getCardPriceCache,
  saveCardPriceCache,
} from './helpers.js';

import { fetchTCGDexCards, fetchTCGDexCardById } from './api/tcgdex.js';
import { fetchPTCGCardById, fetchPTCGCardPrices } from './api/pokemontcg.js';
import { getExchangeRates } from './api/exchangeRates.js';

import { SET_MAPPING } from './SetMapping.js';
import { Card, Listing, Collection } from '../../models/index.js';

// Simple in-memory cache for search results to reduce external API calls
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

// Helper: Enrich cards with prices, images, listing, forTrade, etc.
async function enrichCards(cards, { listed, forTrade, rarity }) {
  const cardIds = cards.map(c => c.id);

  // Get price cache in one DB call for all
  const priceCaches = await Promise.all(cardIds.map(getCardPriceCache));
  const priceMap = Object.fromEntries(cardIds.map((id, i) => [id, priceCaches[i]]));

  // Marketplace listings
  let listingsMap = {};
  if (listed) {
    const listings = await Listing.findAll({ where: { cardId: cardIds, status: 'active' } });
    for (const l of listings) {
      if (!listingsMap[l.cardId]) listingsMap[l.cardId] = [];
      listingsMap[l.cardId].push(l.toJSON());
    }
  }

  // For trade
  let forTradeMap = {};
  if (forTrade) {
    const tradeEntries = await Collection.findAll({
      where: { cardId: cardIds, wantsTrade: true }
    });
    for (const entry of tradeEntries) {
      forTradeMap[entry.cardId] = true;
    }
  }

  // Rarity filter
  let filtered = cards;
  if (rarity) {
    filtered = filtered.filter(card => (card.rarity || '').toLowerCase() === rarity.toLowerCase());
  }

  // Build enriched objects
  return Promise.all(filtered.map(async card => {
    const out = { ...card };

    // Attach image URL
    out.image = tcgdexImageUrl(card);

    // Attach set info
    if (card.set && SET_MAPPING[card.set]) {
      out.setName = SET_MAPPING[card.set].name;
      out.setLogo = SET_MAPPING[card.set].logo || null;
    }

    // Attach listings
    out.listings = listingsMap[card.id] || [];
    out.isListed = !!out.listings.length;
    // Attach forTrade
    out.isForTrade = !!forTradeMap[card.id];
    // Attach GBP prices from cache if available
    out.prices = priceMap[card.id] || null;

    // setSize and setCompletion are handled in a separate resolver
    out.setSize = null;
    out.setCompletion = null;
    return out;
  }));
}

// Main searchCards resolver
async function searchCardsResolver(_, { input }, context) {
  const {
    name,
    set,
    number,
    forTrade,
    listed,
    rarity,
    page = 1,
    pageSize = 20
  } = input;

  // Normalize set code, filter out blocked sets
  let setCode = set ? normalizeSetCode(set) : null;
  if (setCode && isSetBlocked(setCode)) return { cards: [], total: 0, page, pageSize };

  const cacheKey = JSON.stringify({ name, set: setCode, number });
  let cards = getCachedSearch(cacheKey);
  if (!cards) {
    // TCGDex fetch (exact match only)
    cards = await fetchTCGDexCards({ name, set: setCode, number });
    setCachedSearch(cacheKey, cards);
  }
  // Remove any from blocked sets
  cards = cards.filter(card => !isSetBlocked(card.set));
  const total = cards.length;
  // Pagination
  const paginated = cards.slice((page - 1) * pageSize, page * pageSize);

  // Enrich with pricing, listing, images, forTrade, etc.
  const enriched = await enrichCards(paginated, { listed, forTrade, rarity });
  return { cards: enriched, total, page, pageSize };
}

// Main searchSets resolver
async function searchSetsResolver(_, { query }) {
  const results = [];
  for (const [code, data] of Object.entries(SET_MAPPING)) {
    if (isSetBlocked(code)) continue;
    if (
      !query ||
      data.name.toLowerCase().includes(query.toLowerCase()) ||
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

// Query: cardById
async function cardByIdResolver(_, { id }) {
  let card = await Card.findByPk(id);
  if (!card) {
    // Optionally try fetching from TCGDex
    card = await fetchTCGDexCardById(id);
    if (!card) return null;
  }
  const enrichedArr = await enrichCards([card], {}, null);
  return enrichedArr[0];
}

// Query: getSet (all cards in set, with size)
async function getSetResolver(_, { code }) {
  if (isSetBlocked(code)) return null;
  let cards = await fetchTCGDexCards({ set: code });
  cards = cards.filter(card => !isSetBlocked(card.set));
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

// Query: cardSetCompletion (for user/owner, option to display public or not)
async function cardSetCompletionResolver(_, { userId, set }) {
  const ownedCards = await Collection.findAll({ where: { userId, set } });
  const totalOwned = new Set(ownedCards.map(card => card.cardId)).size;
  let allSetCards = await fetchTCGDexCards({ set });
  const total = getSetUniqueCardCount(set, allSetCards, true);
  return total ? +(totalOwned / total * 100).toFixed(2) : 0;
}

// Query: getExchangeRates
async function getExchangeRatesResolver() {
  return getExchangeRates();
}

// Query: allRarities
function allRaritiesResolver() {
  return getAllRarities();
}

// --- Export resolvers ---
const resolvers = {
  Query: {
    searchCards: searchCardsResolver,
    searchSets: searchSetsResolver,
    cardById: cardByIdResolver,
    getSet: getSetResolver,
    cardSetCompletion: cardSetCompletionResolver,
    getExchangeRates: getExchangeRatesResolver,
    allRarities: allRaritiesResolver,
  }
};

export default resolvers;
