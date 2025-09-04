// backend/src/modules/search/helpers.js

import crypto from 'node:crypto';
import { CardPriceCache } from '../../models/index.js';

/** -------- Logging (light) -------- */
const ts = () => new Date().toISOString();
export const log = {
  info: (...args) => console.log(`[${ts()}] [info]`, ...args),
  warn: (...args) => console.warn(`[${ts()}] [warn]`, ...args),
  error: (...args) => console.error(`[${ts()}] [error]`, ...args),
  timing: (obj) => console.log(`[SEARCH][timing] ${JSON.stringify(obj)}`),
  priceOk: (id, where) => console.log(`[PRICE][OK] ${id} via ${where}`),
  priceErr: (id, tryNo, code) =>
    console.log(`[PRICE][ERR] ${id} ${code ? code + ' ' : ''}try ${tryNo}: price-timeout`),
  priceMap: (from, to) => console.log(`[PRICE][MAP] ${from} -> ${to} via mapping`),
  priceFallbackErr: (id, code) => console.log(`[PRICE][ERR] ${id} card-by-id fallback: ${code}`),
  priceFallbackFail: (id, code) => console.log(`[PRICE][FAIL] ${id} after fallback ${code}`),
};

/** -------- Pocket / unsupported sets blocklist -------- */
export const BLOCKED_SET_CODES = [
  // Pokémon TCG Pocket (examples)
  'PROMO-A','A1','A1a','A2','A2a','A2b','A3','A3a','A3b','A4',
];

export function isSetBlocked(setCode) {
  return !!setCode && BLOCKED_SET_CODES.includes(String(setCode).toUpperCase());
}

/** -------- Image normalizer (TCGdex -> /high.webp) -------- */
export function normalizeImage(url) {
  if (!url) return url;
  if (/assets\.tcgdex\.net/.test(url)) {
    const base = url.replace(/\/(low|high)\.webp$/i, '');
    return `${base}/high.webp`;
  }
  return url;
}

/** -------- ID normalization + mapping --------
 * Canonical ids look like `sv08-077` or `sv08.5-028`.
 * Vendors use `sv8-77` or `sv8pt5-28` (drop leading zeros, `.5` -> `pt5`).
 */
export function normalizeId(id) {
  if (!id) return id;
  let canon = id.toLowerCase();
  // normalize weird forms into e.g. sv08.5-028
  canon = canon.replace(/sv(\d+)\.5-/g, (_m, n) => `sv${n}.5-`);
  return canon;
}

export function splitCanonId(canonId) {
  const m = /^([a-z]+)(\d+(?:\.5)?)\-([0-9a-z]+)$/i.exec(canonId);
  if (!m) return null;
  const [, prefix, version, num] = m;
  const pt5 = /\.5$/.test(version);
  const main = parseInt(version, 10); // sv05 -> 5
  return { prefix: prefix.toLowerCase(), main, pt5, num: num.toLowerCase() };
}

export function toVendorId(canonId /*, kind */) {
  const n = normalizeId(canonId);
  const parts = splitCanonId(n);
  if (!parts) return canonId;

  const base = parts.pt5 ? `sv${parts.main}pt5` : `sv${parts.main}`;
  const numNoZero = parts.num.replace(/^0+/, '');
  const vendorId = `${base}-${numNoZero}`;
  log.priceMap(canonId, vendorId);
  return vendorId;
}

// backward-compatible alias — old callers expect this name
export function tcgdexToPtcgId(canonId) {
  return toVendorId(canonId);
}

/** -------- Cursor helpers -------- */
export function encodeCursor(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
export function decodeCursor(cur) {
  try {
    return JSON.parse(Buffer.from(cur, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/** -------- Abortable fetch with timeout -------- */
export async function withTimeout(promise, ms, onTimeout) {
  let timer;
  try {
    const out = await Promise.race([
      promise,
      new Promise((_, rej) => (timer = setTimeout(() => rej(new Error('price-timeout')), ms))),
    ]);
    clearTimeout(timer);
    return out;
  } catch (e) {
    if (timer) clearTimeout(timer);
    if (onTimeout) onTimeout(e);
    throw e;
  }
}

/** -------- Simple retry with backoff -------- */
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

/** -------- Stable sort + card comparator -------- */
export function stableSort(arr, cmp) {
  return arr
    .map((v, i) => ({ v, i }))
    .sort((a, b) => {
      const d = cmp(a.v, b.v);
      return d !== 0 ? d : a.i - b.i;
    })
    .map((x) => x.v);
}

function cardKeyParts(card) {
  const setKey = (card.set || '').toLowerCase();
  const numStr = (card.number || '').toString().toLowerCase();
  const num = parseInt(numStr.replace(/[^\d]/g, ''), 10);
  return { setKey, num: Number.isNaN(num) ? Infinity : num, id: (card.id || '').toLowerCase() };
}

export function compareCards(a, b) {
  const ka = cardKeyParts(a);
  const kb = cardKeyParts(b);
  if (ka.setKey < kb.setKey) return -1;
  if (ka.setKey > kb.setKey) return 1;
  if (ka.num < kb.num) return -1;
  if (ka.num > kb.num) return 1;
  if (ka.id < kb.id) return -1;
  if (ka.id > kb.id) return 1;
  return 0;
}

/** -------- Filter helpers -------- */
export function applyFilters(cards, { listed, forTrade, rarity } = {}) {
  return cards.filter((c) => {
    if (isSetBlocked(c.set)) return false;
    if (typeof listed === 'boolean' && !!c.listed !== listed) return false;
    if (typeof forTrade === 'boolean' && !!c.forTrade !== forTrade) return false;
    if (rarity && c.rarity && c.rarity.toLowerCase() !== rarity.toLowerCase()) return false;
    return true;
  });
}

/** -------- Variant key normalizer --------
 * Normalizes vendor keys so we don’t stomp fields:
 * - reverseHolofoil -> reverse
 * - holofoil -> holo
 * - normal stays normal
 * - everything else stays as-is
 */
export function normalizeVariantKey(k) {
  const s = String(k || '').toLowerCase().trim();
  if (s === 'reverseholofoil' || s === 'reverseholo' || s === 'reverse') return 'reverse';
  if (s === 'holofoil' || s === 'holo') return 'holo';
  if (s === 'normal') return 'normal';
  return k; // leave uncommon keys as-is (e.g., '1stEdition', etc.)
}

/** -------- Price merge helper -------- */
export function mergePriceFields(target, priceObj, variation) {
  if (!priceObj) return;
  const key = normalizeVariantKey(variation);
  if (!target.pricing) target.pricing = {};
  // merge (don’t clobber if we merged from multiple vendors)
  target.pricing[key] = { ...(target.pricing[key] || {}), ...priceObj };

  // tcgplayer style
  if ('low' in priceObj) target.tcgplayerLow = priceObj.low;
  if ('mid' in priceObj) target.tcgplayerMid = priceObj.mid;
  if ('high' in priceObj) target.tcgplayerHigh = priceObj.high;
  if ('market' in priceObj) target.tcgplayerMarket = priceObj.market;
  if ('directLow' in priceObj) target.tcgplayerDirectLow = priceObj.directLow;

  // cardmarket style
  if ('averageSellPrice' in priceObj) target.cardmarketAverageSell = priceObj.averageSellPrice;
  if ('lowPrice' in priceObj) target.cardmarketLowPrice = priceObj.lowPrice;
  if ('trendPrice' in priceObj) target.cardmarketTrendPrice = priceObj.trendPrice;
}

/** -------- Concurrency limiter -------- */
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

/** -------- Simple price cache helpers for the daily job -------- */
export async function getCardPriceCache(cardId) {
  const row = await CardPriceCache.findOne({ where: { cardId }, raw: true });
  return row ? row.tcgplayer || null : null;
}

export async function saveCardPriceCache(cardId, prices) {
  const now = new Date();
  const existing = await CardPriceCache.findOne({ where: { cardId } });
  if (existing) {
    await CardPriceCache.update(
      { tcgplayer: prices ?? null, lastFetched: now, updatedAt: now },
      { where: { cardId } }
    );
  } else {
    await CardPriceCache.create({
      id: crypto.randomUUID(),
      cardId,
      tcgplayer: prices ?? null,
      cardmarket: null,
      lastFetched: now,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/** Convenience export bundle */
export default {
  log,
  normalizeId,
  splitCanonId,
  toVendorId,
  tcgdexToPtcgId,
  normalizeImage,
  encodeCursor,
  decodeCursor,
  withTimeout,
  retry,
  stableSort,
  compareCards,
  applyFilters,
  normalizeVariantKey,
  mergePriceFields,
  createLimiter,
  getCardPriceCache,
  saveCardPriceCache,
  BLOCKED_SET_CODES,
  isSetBlocked,
};
