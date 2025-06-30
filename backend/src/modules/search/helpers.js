import { SET_MAPPING, getSetCandidates } from './SetMapping.js';
import { CardPriceCache } from '../../models/index.js';
import { convertToGBP as convertToGBPLive } from './api/exchangeRates.js';

// --------- Set Exclusion Blocklist ---------
export const BLOCKED_SET_CODES = [
  // Fill this with set codes from Pokémon TCG Pocket, e.g. 'POKPOC1'
];

// --------- 1. Set Normalization & Filtering ---------

export function normalizeSetCode(setInput) {
  const candidates = getSetCandidates(setInput);
  return candidates.length ? candidates[0] : null;
}

export function isSetBlocked(setCode) {
  return BLOCKED_SET_CODES.includes(setCode?.toUpperCase());
}

export function getSetInfo(setCode) {
  return SET_MAPPING[setCode] || null;
}

// --------- 2. Card Image URL Builder ---------

export function tcgdexImageUrl(card) {
  if (!card?.set || !card?.number) return null;
  const eraMatch = card.set.match(/^([a-zA-Z]+)/);
  const era = eraMatch ? eraMatch[1] : card.set;
  const number = String(card.number).replace(/^0+/, '');
  return `https://assets.tcgdex.net/en/${era}/${card.set}/${number}/high.webp`;
}

// --------- 3. Cache Freshness ---------

export function isCacheFresh(lastUpdated) {
  if (!lastUpdated) return false;
  const updated = new Date(lastUpdated);
  const now = new Date();
  return now - updated < 7 * 24 * 60 * 60 * 1000;
}

// --------- 4. Price Conversion (always to GBP) ---------

export async function convertToGBP(price, currency) {
  if (currency === 'GBP') return price;
  if (!price || typeof price !== 'number') return 0;
  // Uses api/exchangeRates.js utility
  return convertToGBPLive(price, currency);
}

// --------- 5. Price Data Enrichment ---------

export async function enrichCardWithGBPPrices(card, priceData) {
  const result = { ...card, pricesGBP: {} };
  if (priceData?.tcgplayer) {
    for (const [variation, info] of Object.entries(priceData.tcgplayer)) {
      if (info?.market) {
        result.pricesGBP[variation] = await convertToGBP(info.market, 'USD');
      }
    }
  }
  if (priceData?.cardmarket) {
    for (const [variation, info] of Object.entries(priceData.cardmarket)) {
      if (info?.market) {
        result.pricesGBP[variation] = await convertToGBP(info.market, 'EUR');
      }
    }
  }
  return result;
}

// --------- 6. Card Price Cache Util ---------

export async function getCardPriceCache(cardId) {
  const cache = await CardPriceCache.findOne({ where: { cardId } });
  if (!cache) return null;
  if (!isCacheFresh(cache.updatedAt)) return null;
  return cache.data ? { ...cache.data } : null;
}

export async function saveCardPriceCache(cardId, priceData) {
  const [cache] = await CardPriceCache.findOrCreate({ where: { cardId } });
  cache.data = priceData;
  cache.updatedAt = new Date();
  await cache.save();
}

// --------- 7. Set Card Count (for Completion %) ---------

export function getSetUniqueCardCount(setCode, cards, includePromos = true) {
  return new Set(
    cards
      .filter(card =>
        card.set === setCode &&
        (includePromos ? true : !card.isPromo)
      )
      .map(card => card.number)
  ).size;
}

// --------- 8. Rarity List Helper ---------

export const RARITIES = [
  "Common", "Uncommon", "Rare", "Rare Holo", "Rare Holo EX",
  "Rare Ultra", "Rare Secret", "Promo", "Other"
];

export function getAllRarities() {
  return RARITIES.slice().sort();
}

/**
 * Convert a TCGDex card ID (sv08-238, sv08.5-028, etc) to PokémonTCG.io ID (sv8-238, sv8pt5-028, etc).
 * Returns empty string if cannot map.
 */
export function tcgdexToPtcgId(tcgdexId) {
  // Matches formats: sv08-238 or sv08.5-028
  const match = tcgdexId.match(/^([a-z0-9.]+)[-.](\d+)$/i);
  if (!match) return "";
  const [ , tcgdexSet, number ] = match;
  for (const mapping of Object.values(SET_MAPPING)) {
    if (mapping.tcgdex === tcgdexSet) {
      return `${mapping.ptcg}-${parseInt(number, 10)}`;
    }
  }
  return "";
}