// helpers.js — OLD structure kept, NEW improvements merged (plain JS / ESM)

// --- OLD IMPORTS (kept) ---
import { SET_MAPPING, getSetCandidates } from './SetMapping.js';
import { CardPriceCache } from '../../models/index.js';
import { fetchTCGDexCardById } from './api/tcgdex.js';
import { fetchPTCGCardById } from './api/pokemontcg.js';

// --- OLD DEBUG FLAG (kept) ---
const DEBUG_PRICE = process.env.DEBUG_PRICE === '1';

// --- OLD: Shared timeouts + helper (kept) ---
// CHANGED: allow optional onTimeout callback while preserving old signature.
export const SAFE_TIMEOUTS = {
  externalFetch: Number(process.env.PRICE_FETCH_TIMEOUT_MS || 5000),
  jsonParse: 2000,
};
export function withTimeout(promise, ms, label = 'timeout', onTimeout /* ADDED */) {
  let t;
  const timer = new Promise((_, rej) => (t = setTimeout(() => rej(new Error(label)), ms)));
  return Promise.race([promise, timer])
    .catch((e) => {
      if (onTimeout) onTimeout(e); // ADDED
      throw e;
    })
    .finally(() => clearTimeout(t));
}

// ADDED: lightweight timestamped logger (quiet by default unless DEBUG_PRICE)
const ts = () => new Date().toISOString();
export const log = {
  info: (...args) => DEBUG_PRICE && console.log(`[${ts()}] [info]`, ...args),
  warn: (...args) => DEBUG_PRICE && console.warn(`[${ts()}] [warn]`, ...args),
  error: (...args) => console.error(`[${ts()}] [error]`, ...args), // always log errors
  timing: (obj) => DEBUG_PRICE && console.log(`[SEARCH][timing] ${JSON.stringify(obj)}`),
  priceMap: (from, to) => DEBUG_PRICE && console.log(`[PRICE][MAP] ${from} -> ${to}`),
};

// -----------------------------
// Set Exclusion / Normalization
// -----------------------------

/** --- Set Exclusion Blocklist (OLD kept) --- */
export const BLOCKED_SET_CODES = [
  // Pokémon TCG Pocket (example) / other unsupported sets
  'PROMO-A','A1','A1a','A2','A2a','A2b','A3','A3a','A3b','A4'
];

/** --- Set Normalization & Filtering (OLD kept) --- */
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

// -----------------------------
// Image helpers
// -----------------------------

/** --- Card Image URL Builder (OLD kept) --- */
export function tcgdexImageUrl(card) {
  if (!card?.set || !card?.number) return null;
  const eraMatch = String(card.set).match(/^([a-zA-Z]+)/);
  const era = eraMatch ? eraMatch[1] : card.set;
  const number = String(card.number).replace(/^0+/, '');
  return `https://assets.tcgdex.net/en/${era}/${card.set}/${number}/high.webp`;
}

/** ADDED: Normalize any tcgdex image URL to /high.webp consistently */
export function normalizeImage(url) {
  if (!url) return url;
  if (/assets\.tcgdex\.net/.test(url)) {
    const base = url.replace(/\/(low|high)\.webp$/i, '');
    return `${base}/high.webp`;
  }
  return url;
}

// -----------------------------
// Cache freshness utilities
// -----------------------------

/** --- Cache Freshness (OLD kept) --- */
export function isCacheFresh(lastUpdated) {
  if (!lastUpdated) return false;
  const updated = new Date(lastUpdated);
  return Date.now() - updated < 7 * 24 * 60 * 60 * 1000;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000; // OLD
function isFresh(dateLike) {            // OLD
  if (!dateLike) return false;
  const t = new Date(dateLike).getTime();
  return Number.isFinite(t) && Date.now() - t < ONE_DAY_MS;
}
function isEmptyPriceData(pd) {         // OLD
  if (!pd) return true;
  const hasTCG = pd.tcgplayer && Object.keys(pd.tcgplayer).length > 0;
  const hasCMK = pd.cardmarket && Object.keys(pd.cardmarket).length > 0;
  return !(hasTCG || hasCMK);
}

// ---------------------------------------------
// Card Price Cache utils (prefer OLD behaviour)
// ---------------------------------------------

// --- Card Price Cache Util (OLD kept: 24h TTL, ignore empty blobs) ---
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

// -----------------------------
// Set Meta / Rarities (OLD kept)
// -----------------------------

/** --- Set Unique Count (OLD kept) --- */
export function getSetUniqueCardCount(setCode, cards, includePromos = true) {
  return new Set(
    cards
      .filter(card => card.set === setCode && (includePromos ? true : !card.isPromo))
      .map(card => card.number)
  ).size;
}

/** --- Rarity List Helper (OLD kept) --- */
export const RARITIES = [
  'Common','Uncommon','Rare','Rare Holo','Rare Holo EX',
  'Rare Ultra','Rare Secret','Promo','Other'
];
export function getAllRarities() {
  return RARITIES.slice().sort();
}

// -----------------------------------------------
// ID normalization / vendor mapping (IMPROVED)
// -----------------------------------------------

/**
 * Convert TCGDex id (e.g. sv08-057, sv08.5-028, sv10.5b-028) → PokémonTCG id (sv8-57, sv8pt5-28, zsv10pt5-28).
 * OLD function name kept for callers; mapping logic improved to consult SET_MAPPING first.
 */
export function tcgdexToPtcgId(tcgdexId) {
  const v = toVendorId(tcgdexId); // CHANGED: reuse improved mapper
  if (v && DEBUG_PRICE) log.priceMap(tcgdexId, v);
  return v;
}

/** CHANGED: Normalize to canonical TCGdex-like ids.
 *  - Preserves optional “.X” and trailing letters (e.g. .5b / .5bw) when present.
 *  - Pads card number to 3 digits when numeric (e.g. 57 → 057).
 *  - Accepts vendor-ish forms (sv8-57 / sv8pt5-28 / zsv10pt5-28) and converts to canonical.
 */
export function normalizeId(id) {
  if (!id) return id;
  const s = String(id).trim().toLowerCase();

  // Already canonical-like? svNN, svNN.X, svNN.Xletters
  const mCanon = /^(sv\d{2})(?:\.(\d+)([a-z]+)?)?-(\w{1,3})$/.exec(s);
  if (mCanon) {
    const [, setPart, dotNum, dotLetters, numRaw] = mCanon;
    const num = /^\d+$/.test(numRaw) ? String(parseInt(numRaw, 10)).padStart(3, '0') : numRaw;
    return `${setPart}${dotNum ? `.${parseInt(dotNum, 10)}${dotLetters || ''}` : ''}-${num}`;
  }

  // Vendor-ish:
  //  - sv8-57        -> sv08-057
  //  - sv8pt5-28     -> sv08.5-028
  //  - zsv10pt5-28   -> sv10.5-028   (letters like 'z'/'r' map to ptcg prefixes; TCGdex side has letters after .5)
  const mVendor = /^(?:[a-z])?sv0?(\d+)(?:pt(\d+))?-(\w{1,3})$/.exec(s);
  if (mVendor) {
    const [, mainRaw, ptRaw, numRaw] = mVendor;
    const main = String(parseInt(mainRaw, 10)).padStart(2, '0');
    const num = /^\d+$/.test(numRaw) ? String(parseInt(numRaw, 10)).padStart(3, '0') : numRaw;
    // We cannot infer TCGdex trailing letters (e.g. 'b'/'bw') from vendor id alone → omit letters here.
    return `sv${main}${ptRaw ? `.${parseInt(ptRaw, 10)}` : ''}-${num}`;
  }

  // Simple fallback
  const mSimple = /^sv(\d+)-(\d{1,3})$/.exec(s);
  if (mSimple) {
    const main = String(parseInt(mSimple[1], 10)).padStart(2, '0');
    const num = String(parseInt(mSimple[2], 10)).padStart(3, '0');
    return `sv${main}-${num}`;
  }

  return s;
}

/** CHANGED: Split canonical id into parts, preserving any letters after .X (e.g. .5b / .5bw) */
export function splitCanonId(canonId) {
  const m = /^(sv\d{2})(?:\.(\d+)([a-z]+)?)?-(\w{1,3})$/i.exec(canonId);
  if (!m) return null;
  const [, setPart, dotNum, dotLetters, num] = m;
  return {
    setPart: setPart.toLowerCase(),                // e.g. sv10
    dotNum: dotNum ? parseInt(dotNum, 10) : null,  // e.g. 5
    dotLetters: dotLetters ? dotLetters.toLowerCase() : '', // e.g. 'b' or 'bw'
    num: String(num).toLowerCase(),                // may be alphanumeric
  };
}

/** CHANGED: Map canonical TCGdex id → vendor id.
 *  1) Consult SET_MAPPING (exact tcgdex match, including letters like 'sv10.5b').
 *  2) Fallback heuristic: svNN(.X) → svN N ptX  (letters cannot be represented without mapping).
 */
export function toVendorId(canonId) {
  const n = normalizeId(canonId);
  const parts = splitCanonId(n);
  if (!parts) return canonId || '';

  // number without leading zeros if numeric
  const numNoZero = /^\d+$/.test(parts.num) ? String(parseInt(parts.num, 10)) : parts.num;

  // 1) Prefer SET_MAPPING when tcgdex setPart matches exactly (incl. letters)
  const tcgdexKey = parts.dotNum
    ? `${parts.setPart}.${parts.dotNum}${parts.dotLetters || ''}` // e.g. 'sv10.5b'
    : parts.setPart;                                             // e.g. 'sv08'

  for (const entry of Object.values(SET_MAPPING)) {
    if (entry?.tcgdex && String(entry.tcgdex).toLowerCase() === tcgdexKey) {
      const pt = entry.ptcg ? String(entry.ptcg).toLowerCase() : '';
      if (pt) {
        const vendor = `${pt}-${numNoZero}`;
        if (DEBUG_PRICE) log.priceMap(n, vendor);
        return vendor;
      }
    }
  }

  // 2) Heuristic fallback (no special prefix):
  //    svNN(.X) -> svN N ptX
  const m = /^sv(\d{2})$/i.exec(parts.setPart);
  let base = `sv${parseInt(m[1], 10)}`;         // sv08 -> sv8
  if (parts.dotNum) base += `pt${parts.dotNum}`; // .5 -> pt5
  const vendor = `${base}-${numNoZero}`;
  if (DEBUG_PRICE) log.priceMap(n, vendor);
  return vendor;
}

// -------------------------------------
// Cursor + retry + sorting (IMPROVED)
// -------------------------------------

// ADDED: Cursor helpers for Relay-style pagination
export function encodeCursor(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}
export function decodeCursor(cur) {
  try {
    return JSON.parse(Buffer.from(cur, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

// ADDED: Simple retry with linear backoff
export async function retry(fn, { tries = 2, baseMs = 300 } = {}) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn(i);
    } catch (e) {
      lastErr = e;
      if (i === tries) break;
      await new Promise((r) => setTimeout(r, baseMs * i));
    }
  }
  throw lastErr;
}

// ADDED: Stable sort wrapper + deterministic card comparator
export function stableSort(arr, cmp) {
  return arr
    .map((v, i) => ({ v, i }))
    .sort((a, b) => {
      const d = cmp(a.v, b.v);
      return d !== 0 ? d : a.i - b.i;
    })
    .map((x) => x.v);
}
function _cardKeyParts(card) {
  const setKey = (card.set || '').toLowerCase();
  const numStr = (card.number || '').toString().toLowerCase();
  const num = parseInt(numStr.replace(/[^\d]/g, ''), 10);
  return { setKey, num: Number.isNaN(num) ? Infinity : num, id: (card.id || '').toLowerCase() };
}
export function compareCards(a, b) {
  const ka = _cardKeyParts(a);
  const kb = _cardKeyParts(b);
  if (ka.setKey < kb.setKey) return -1;
  if (ka.setKey > kb.setKey) return 1;
  if (ka.num < kb.num) return -1;
  if (ka.num > kb.num) return 1;
  if (ka.id < kb.id) return -1;
  if (ka.id > kb.id) return 1;
  return 0;
}

// -----------------------------
// Filters + variant merging
// -----------------------------

// ADDED: Filters now also respect blocked sets (OLD logic preserved)
export function applyFilters(cards, { listed, forTrade, rarity } = {}) {
  return cards.filter((c) => {
    if (isSetBlocked(c.set)) return false;
    if (typeof listed === 'boolean' && !!c.listed !== listed) return false;
    if (typeof forTrade === 'boolean' && !!c.forTrade !== forTrade) return false;
    if (rarity && c.rarity && c.rarity.toLowerCase() !== rarity.toLowerCase()) return false;
    return true;
  });
}

/** ADDED: Normalize vendor variant keys to a small set */
export function normalizeVariantKey(k) {
  const s = String(k || '').toLowerCase().trim();
  if (s === 'reverseholofoil' || s === 'reverseholo' || s === 'reverse') return 'reverse';
  if (s === 'holofoil' || s === 'holo') return 'holo';
  if (s === 'normal') return 'normal';
  return k; // keep uncommon keys as-is
}

/** ADDED: Merge price objects into a consolidated structure (+ convenience slots) */
export function mergePriceFields(target, priceObj, variation) {
  if (!priceObj) return;
  const key = normalizeVariantKey(variation);
  if (!target.pricing) target.pricing = {};
  target.pricing[key] = { ...(target.pricing[key] || {}), ...priceObj };

  // tcgplayer-style
  if ('low' in priceObj) target.tcgplayerLow = priceObj.low;
  if ('mid' in priceObj) target.tcgplayerMid = priceObj.mid;
  if ('high' in priceObj) target.tcgplayerHigh = priceObj.high;
  if ('market' in priceObj) target.tcgplayerMarket = priceObj.market;
  if ('directLow' in priceObj) target.tcgplayerDirectLow = priceObj.directLow;

  // cardmarket-style
  if ('averageSellPrice' in priceObj) target.cardmarketAverageSell = priceObj.averageSellPrice;
  if ('lowPrice' in priceObj) target.cardmarketLowPrice = priceObj.lowPrice;
  if ('trendPrice' in priceObj) target.cardmarketTrendPrice = priceObj.trendPrice;
}

// -----------------------------
// Concurrency limiter (ADDED)
// -----------------------------

export function createLimiter(max = 5) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= max || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn()
      .then((v) => {
        active--;
        resolve(v);
        next();
      })
      .catch((e) => {
        active--;
        reject(e);
        next();
      });
  };
  return function limit(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}

// -------------------------------------
// Hydration helper (OLD kept + tweak)
// -------------------------------------

/**
 * Hydrate a card object with as much detail as possible from TCGDex and PTCG.io
 * Used before saving to DB to prevent nulls!
 */
export async function hydrateCard(card) {
  let hydrated = { ...card };

  // Fetch TCGDex details if important fields are missing
  if (!hydrated.rarity || !hydrated.setName || !hydrated.setLogo || !hydrated.image) {
    try {
      const dexData = await withTimeout(
        fetchTCGDexCardById(card.id),
        SAFE_TIMEOUTS.externalFetch,
        'tcgdex-timeout'
      );
      if (dexData) hydrated = { ...dexData, ...hydrated }; // hydrate, keep provided fields
    } catch {}
  }

  // If still missing image, try PTCG.io
  if (!hydrated.image) {
    const ptcgId = tcgdexToPtcgId(card.id);
    if (ptcgId) {
      try {
        const ptcgData = await withTimeout(
          fetchPTCGCardById(ptcgId),
          SAFE_TIMEOUTS.externalFetch,
          'ptcg-timeout'
        );
        hydrated.image =
          normalizeImage(ptcgData?.images?.large) || // ADDED: run through normalizer
          normalizeImage(ptcgData?.images?.small) ||
          null;
      } catch {}
    }
  } else {
    // ADDED: normalize any existing tcgdex URL to /high.webp
    hydrated.image = normalizeImage(hydrated.image);
  }

  return hydrated;
}

// --- DEFAULT EXPORT (aggregated) ---
export default {
  // flags/config
  DEBUG_PRICE,
  SAFE_TIMEOUTS,

  // logging & utils
  log,
  withTimeout,
  retry,

  // sets / normalization
  BLOCKED_SET_CODES,
  normalizeSetCode,
  isSetBlocked,
  getSetInfo,

  // images
  tcgdexImageUrl,
  normalizeImage,

  // caching
  isCacheFresh,
  getCardPriceCache,
  saveCardPriceCache,

  // set meta / rarities
  getSetUniqueCardCount,
  RARITIES,
  getAllRarities,

  // ids & vendor mapping
  tcgdexToPtcgId,
  normalizeId,
  splitCanonId,
  toVendorId,

  // sorting / pagination helpers
  stableSort,
  compareCards,
  encodeCursor,
  decodeCursor,

  // variants & price merge
  normalizeVariantKey,
  mergePriceFields,

  // concurrency + hydration
  createLimiter,
  hydrateCard,
};
