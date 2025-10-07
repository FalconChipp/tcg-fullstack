// helpers.js — OLD structure kept, NEW improvements merged (plain JS / ESM)

// --- OLD IMPORTS (kept) ---
import { SET_MAPPING, getSetCandidates } from './SetMapping.js';
// import { CardPrice } from '../../models/index.js';
import { fetchTCGDexCardById } from './api/tcgdex.js';
import { fetchPTCGCardById } from './api/pokemontcg.js';

// --- OLD DEBUG FLAG (kept) ---
const DEBUG_PRICE = process.env.DEBUG_PRICE === '1';

// --- OLD: Shared timeouts + helper (kept) ---
export const SAFE_TIMEOUTS = {
  externalFetch: Number(process.env.PRICE_FETCH_TIMEOUT_MS || 5000),
  jsonParse: 2000,
};
export function withTimeout(promise, ms, label = 'timeout', onTimeout /* ADDED */) {
  let t;
  const timer = new Promise((_, rej) => (t = setTimeout(() => rej(new Error(label)), ms)));
  return Promise.race([promise, timer])
    .catch((e) => {
      if (onTimeout) onTimeout(e);
      throw e;
    })
    .finally(() => clearTimeout(t));
}

// ADDED: lightweight timestamped logger (quiet by default unless DEBUG_PRICE)
const ts = () => new Date().toISOString();
export const log = {
  info: (...args) => DEBUG_PRICE && console.log(`[${ts()}] [info]`, ...args),
  warn: (...args) => DEBUG_PRICE && console.warn(`[${ts()}] [warn]`, ...args),
  error: (...args) => console.error(`[${ts()}] [error]`, ...args),
  timing: (obj) => DEBUG_PRICE && console.log(`[SEARCH][timing] ${JSON.stringify(obj)}`),
  priceMap: (from, to) => DEBUG_PRICE && console.log(`[PRICE][MAP] ${from} -> ${to}`),
};

// -----------------------------
// Set Exclusion / Normalization
// -----------------------------

export const BLOCKED_SET_CODES = [
  'PROMO-A','A1','A1a','A2','A2a','A2b','A3','A3a','A3b','A4'
];

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

/** --- Card Image URL Builder (hardened) --- */
export function tcgdexImageUrl(card) {
  const setCode = typeof card?.set === 'object' ? card?.set?.id : card?.set;
  const number = card?.number;
  if (!setCode || !number) return null;

  const eraMatch = String(setCode).match(/^([a-zA-Z]+)/);
  const era = eraMatch ? eraMatch[1] : setCode;
  const num = String(number).replace(/^0+/, '');

  return `https://assets.tcgdex.net/en/${era}/${setCode}/${num}/high.webp`;
}

/** Normalize any tcgdex image URL to /high.webp consistently */
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

// ---------------------------------------------
// Card Price Cache utils (prefer OLD behaviour)
// ---------------------------------------------

export async function getCardPriceCache(cardId) {
  if (!cardId) return null;
  const row = await CardPrice.findOne({ where: { cardId } });
  if (!row) return null;

  const out = {};
  if (row.tcgplayer) out.tcgplayer = row.tcgplayer;
  if (row.cardmarket) out.cardmarket = row.cardmarket;
  return Object.keys(out).length ? out : null;
}

export async function saveCardPriceCache(cardId, vendorBlob) {
  if (!cardId || !vendorBlob) return;

  const now = new Date();
  const payload = {
    currency: 'GBP',
    lastFetched: now,
    tcgplayer: vendorBlob.tcgplayer || null,
    cardmarket: vendorBlob.cardmarket || null,
  };

  const existing = await CardPrice.findOne({ where: { cardId } });
  if (existing) {
    await existing.update(payload);
  } else {
    await CardPrice.create({ cardId, ...payload });
  }
  return true;
}

// -----------------------------
// Set Meta / Rarities
// -----------------------------

export function getSetUniqueCardCount(setCode, cards, includePromos = true) {
  return new Set(
    cards
      .filter(card => {
        const s = typeof card.set === 'object' ? card.set?.id : card.set;
        return s === setCode && (includePromos ? true : !card.isPromo);
      })
      .map(card => card.number)
  ).size;
}

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

export function tcgdexToPtcgId(tcgdexId) {
  const v = toVendorId(tcgdexId);
  if (v && DEBUG_PRICE) log.priceMap(tcgdexId, v);
  return v;
}

export function normalizeId(id) {
  if (!id) return id;
  const s = String(id).trim().toLowerCase();

  const mCanon = /^(sv\d{2})(?:\.(\d+)([a-z]+)?)?-(\w{1,3})$/.exec(s);
  if (mCanon) {
    const [, setPart, dotNum, dotLetters, numRaw] = mCanon;
    const num = /^\d+$/.test(numRaw) ? String(parseInt(numRaw, 10)).padStart(3, '0') : numRaw;
    return `${setPart}${dotNum ? `.${parseInt(dotNum, 10)}${dotLetters || ''}` : ''}-${num}`;
  }

  const mVendor = /^(?:[a-z])?sv0?(\d+)(?:pt(\d+))?-(\w{1,3})$/.exec(s);
  if (mVendor) {
    const [, mainRaw, ptRaw, numRaw] = mVendor;
    const main = String(parseInt(mainRaw, 10)).padStart(2, '0');
    const num = /^\d+$/.test(numRaw) ? String(parseInt(numRaw, 10)).padStart(3, '0') : numRaw;
    return `sv${main}${ptRaw ? `.${parseInt(ptRaw, 10)}` : ''}-${num}`;
  }

  const mSimple = /^sv(\d+)-(\d{1,3})$/.exec(s);
  if (mSimple) {
    const main = String(parseInt(mSimple[1], 10)).padStart(2, '0');
    const num = String(parseInt(mSimple[2], 10)).padStart(3, '0');
    return `sv${main}-${num}`;
  }

  return s;
}

export function splitCanonId(canonId) {
  const m = /^(sv\d{2})(?:\.(\d+)([a-z]+)?)?-(\w{1,3})$/i.exec(canonId);
  if (!m) return null;
  const [, setPart, dotNum, dotLetters, num] = m;
  return {
    setPart: setPart.toLowerCase(),
    dotNum: dotNum ? parseInt(dotNum, 10) : null,
    dotLetters: dotLetters ? dotLetters.toLowerCase() : '',
    num: String(num).toLowerCase(),
  };
}

export function toVendorId(canonId) {
  const n = normalizeId(canonId);
  const parts = splitCanonId(n);
  if (!parts) return canonId || '';

  const numNoZero = /^\d+$/.test(parts.num) ? String(parseInt(parts.num, 10)) : parts.num;

  const tcgdexKey = parts.dotNum
    ? `${parts.setPart}.${parts.dotNum}${parts.dotLetters || ''}`
    : parts.setPart;

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

  const m = /^sv(\d{2})$/i.exec(parts.setPart);
  let base = `sv${parseInt(m[1], 10)}`;
  if (parts.dotNum) base += `pt${parts.dotNum}`;
  const vendor = `${base}-${numNoZero}`;
  if (DEBUG_PRICE) log.priceMap(n, vendor);
  return vendor;
}

// -------------------------------------
// Cursor + retry + sorting
// -------------------------------------

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
  const setKey = (typeof card.set === 'object' ? card.set?.id : card.set || '').toLowerCase();
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

export function applyFilters(cards, { listed, forTrade, rarity } = {}) {
  return cards.filter((c) => {
    const setCode = typeof c.set === 'object' ? c.set?.id : c.set;
    if (isSetBlocked(setCode)) return false;
    if (typeof listed === 'boolean' && !!c.listed !== listed) return false;
    if (typeof forTrade === 'boolean' && !!c.forTrade !== forTrade) return false;
    if (rarity && c.rarity && c.rarity.toLowerCase() !== rarity.toLowerCase()) return false;
    return true;
  });
}

export function normalizeVariantKey(k) {
  const s = String(k || '').toLowerCase().trim();
  if (s === 'reverseholofoil' || s === 'reverseholo' || s === 'reverse') return 'reverse';
  if (s === 'holofoil' || s === 'holo') return 'holo';
  if (s === 'normal') return 'normal';
  return k;
}

export function mergePriceFields(target, priceObj, variation) {
  if (!priceObj) return;
  const key = normalizeVariantKey(variation);
  if (!target.pricing) target.pricing = {};
  target.pricing[key] = { ...(target.pricing[key] || {}), ...priceObj };

  if ('low' in priceObj) target.tcgplayerLow = priceObj.low;
  if ('mid' in priceObj) target.tcgplayerMid = priceObj.mid;
  if ('high' in priceObj) target.tcgplayerHigh = priceObj.high;
  if ('market' in priceObj) target.tcgplayerMarket = priceObj.market;
  if ('directLow' in priceObj) target.tcgplayerDirectLow = priceObj.directLow;

  if ('averageSellPrice' in priceObj) target.cardmarketAverageSell = priceObj.averageSellPrice;
  if ('lowPrice' in priceObj) target.cardmarketLowPrice = priceObj.lowPrice;
  if ('trendPrice' in priceObj) target.cardmarketTrendPrice = priceObj.trendPrice;
}

// -----------------------------
// Concurrency limiter
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
// Hydration helper
// -------------------------------------

export async function hydrateCard(card) {
  let hydrated = { ...card };

  if (!hydrated.rarity || !hydrated.setName || !hydrated.setLogo || !hydrated.image) {
    try {
      const dexData = await withTimeout(
        fetchTCGDexCardById(card.id),
        SAFE_TIMEOUTS.externalFetch,
        'tcgdex-timeout'
      );
      if (dexData) hydrated = { ...dexData, ...hydrated };
    } catch {}
  }

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
          normalizeImage(ptcgData?.images?.large) ||
          normalizeImage(ptcgData?.images?.small) ||
          null;
      } catch {}
    }
  } else {
    hydrated.image = normalizeImage(hydrated.image);
  }

  return hydrated;
}

// --- DEFAULT EXPORT (aggregated) ---
export default {
  DEBUG_PRICE,
  SAFE_TIMEOUTS,

  log,
  withTimeout,
  retry,

  BLOCKED_SET_CODES,
  normalizeSetCode,
  isSetBlocked,
  getSetInfo,

  tcgdexImageUrl,
  normalizeImage,

  isCacheFresh,
  getCardPriceCache,
  saveCardPriceCache,

  getSetUniqueCardCount,
  RARITIES,
  getAllRarities,

  tcgdexToPtcgId,
  normalizeId,
  splitCanonId,
  toVendorId,

  stableSort,
  compareCards,
  encodeCursor,
  decodeCursor,

  normalizeVariantKey,
  mergePriceFields,

  createLimiter,
  hydrateCard,
};
