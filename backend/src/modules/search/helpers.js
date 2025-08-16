import { SET_MAPPING, getSetCandidates } from './SetMapping.js';
import { CardPriceCache } from '../../models/index.js';
import { fetchTCGDexCardById } from './api/tcgdex.js';
import { fetchPTCGCardById } from './api/pokemontcg.js';

const DEBUG_PRICE = process.env.DEBUG_PRICE === '1';

// Shared timeouts + helper
const SAFE_TIMEOUTS = {
  externalFetch: Number(process.env.PRICE_FETCH_TIMEOUT_MS || 5000),
  jsonParse: 2000,
};

function withTimeout(promise, ms, label = 'timeout') {
  let t;
  const timer = new Promise((_, rej) => (t = setTimeout(() => rej(new Error(label)), ms)));
  return Promise.race([promise.finally(() => clearTimeout(t)), timer]);
}

/** --- Set Exclusion Blocklist --- */
export const BLOCKED_SET_CODES = [
  // Pokémon TCG Pocket (example) / other unsupported sets
  'PROMO-A','A1','A1a','A2','A2a','A2b','A3','A3a','A3b','A4'
];

/** --- Set Normalization & Filtering --- */
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

/** --- Card Image URL Builder --- */
export function tcgdexImageUrl(card) {
  if (!card?.set || !card?.number) return null;
  const eraMatch = String(card.set).match(/^([a-zA-Z]+)/);
  const era = eraMatch ? eraMatch[1] : card.set;
  const number = String(card.number).replace(/^0+/, '');
  return `https://assets.tcgdex.net/en/${era}/${card.set}/${number}/high.webp`;
}

/** --- Cache Freshness (7 days; price cache has 24h TTL below) --- */
export function isCacheFresh(lastUpdated) {
  if (!lastUpdated) return false;
  const updated = new Date(lastUpdated);
  return Date.now() - updated < 7 * 24 * 60 * 60 * 1000;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
function isFresh(dateLike) {
  if (!dateLike) return false;
  const t = new Date(dateLike).getTime();
  return Number.isFinite(t) && Date.now() - t < ONE_DAY_MS;
}

function isEmptyPriceData(pd) {
  if (!pd) return true;
  const hasTCG = pd.tcgplayer && Object.keys(pd.tcgplayer).length > 0;
  const hasCMK = pd.cardmarket && Object.keys(pd.cardmarket).length > 0;
  return !(hasTCG || hasCMK);
}

// --- Card Price Cache Util (unchanged TTL logic, but ignore empty blobs)
export async function getCardPriceCache(cardId) {
  const cache = await CardPriceCache.findOne({ where: { cardId } });
  if (!cache) return null;
  const freshnessAnchor = cache.lastFetched || cache.updatedAt;
  if (!isFresh(freshnessAnchor)) return null;

  const pd = {
    tcgplayer: cache.tcgplayer || null,
    cardmarket: cache.cardmarket || null,
  };

  // ignore “empty” cached blobs so we’ll refetch
  if (isEmptyPriceData(pd)) {
    if (DEBUG_PRICE) console.log(`[PRICE][CACHE] ${cardId} fresh-but-empty -> refetch`);
    return null;
  }
  return pd;
}

export async function saveCardPriceCache(cardId, priceData) {
  // don’t persist if it’s effectively empty
  if (isEmptyPriceData(priceData)) {
    if (DEBUG_PRICE) console.log(`[PRICE][CACHE] ${cardId} not saving empty cache`);
    return;
  }
  const [cache] = await CardPriceCache.findOrCreate({ where: { cardId } });
  cache.tcgplayer = priceData?.tcgplayer ?? null;
  cache.cardmarket = priceData?.cardmarket ?? null;
  cache.lastFetched = new Date();
  await cache.save();
  if (DEBUG_PRICE) console.log(`[PRICE][CACHE] ${cardId} saved`);
}

/** --- Set Card Count (for Completion %) --- */
export function getSetUniqueCardCount(setCode, cards, includePromos = true) {
  return new Set(
    cards
      .filter(card => card.set === setCode && (includePromos ? true : !card.isPromo))
      .map(card => card.number)
  ).size;
}

/** --- Rarity List Helper --- */
export const RARITIES = [
  'Common','Uncommon','Rare','Rare Holo','Rare Holo EX',
  'Rare Ultra','Rare Secret','Promo','Other'
];
export function getAllRarities() {
  return RARITIES.slice().sort();
}

/**
 * Convert TCGDex id (e.g. sv08-057, sv08.5-028) → PokémonTCG id (sv8-57, sv8pt5-28).
 * Uses SET_MAPPING first; then a safe fallback (strip leading zeros, “.5”→“pt5”).
 */
// Convert TCGDex id → PTCG id with resilient fallback
export function tcgdexToPtcgId(tcgdexId) {
  if (!tcgdexId) return "";
  const m = String(tcgdexId).trim().match(/^([a-z0-9.]+)[-._](\d+)$/i);
  if (!m) return "";
  const [, tcgdexSet, rawNum] = m;

  // Prefer explicit SET_MAPPING
  for (const mapping of Object.values(SET_MAPPING)) {
    if (mapping.tcgdex === tcgdexSet && mapping.ptcg) {
      const id = `${mapping.ptcg}-${parseInt(rawNum, 10)}`;
      if (DEBUG_PRICE) console.log(`[PRICE][MAP] ${tcgdexId} -> ${id} via mapping`);
      return id;
    }
  }

  // Fallback: normalize (sv08 -> sv8, sv08.5 -> sv8pt5)
  const m2 = tcgdexSet.match(/^([a-z]+)(\d+(?:\.\d+)?)$/i);
  if (!m2) return "";
  const prefix = m2[1].toLowerCase();
  const version = m2[2];
  const [main, dot] = version.split('.');
  const mainNoZero = String(parseInt(main, 10));
  const ptPart = dot ? `pt${parseInt(dot, 10)}` : "";
  const ptcgSet = `${prefix}${mainNoZero}${ptPart}`;
  const id = `${ptcgSet}-${parseInt(rawNum, 10)}`;
  if (DEBUG_PRICE) console.log(`[PRICE][MAP] ${tcgdexId} -> ${id} via fallback`);
  return id;
}

/**
 * Hydrate a card object with as much detail as possible from TCGDex and PTCG.io
 * Used before saving to DB to prevent nulls!
 */
export async function hydrateCard(card) {
  let hydrated = { ...card };

  // Fetch TCGDex details if important fields are missing
  if (!hydrated.rarity || !hydrated.setName || !hydrated.setLogo || !hydrated.image) {
    try {
      const dexData = await withTimeout(fetchTCGDexCardById(card.id), SAFE_TIMEOUTS.externalFetch, 'tcgdex-timeout');
      if (dexData) hydrated = { ...dexData, ...hydrated }; // hydrate, keep provided fields
    } catch {}
  }

  // If still missing image, try PTCG.io
  if (!hydrated.image) {
    const ptcgId = tcgdexToPtcgId(card.id);
    if (ptcgId) {
      try {
        const ptcgData = await withTimeout(fetchPTCGCardById(ptcgId), SAFE_TIMEOUTS.externalFetch, 'ptcg-timeout');
        hydrated.image = ptcgData?.images?.large || ptcgData?.images?.small || null;
      } catch {}
    }
  }
  return hydrated;
}
