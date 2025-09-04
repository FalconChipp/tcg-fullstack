// src/modules/search/api/exchangeRates.js
// ESM

import fs from 'node:fs/promises';
import path from 'node:path';

// --- Defaults are "per 1 USD" (i.e., USD→EUR=0.86 means $1 = €0.86).
const DEFAULT_RATES = {
  USD: 1,
  EUR: 0.86,
  GBP: 0.74,
  JPY: 148.21,
};

// Cache state (memory + optional disk)
const ONE_HOUR_MS = 60 * 60 * 1000;
const TTL_HOURS = +(process.env.EXCHANGE_RATES_TTL_HOURS || 24);
const CACHE_TTL_MS = TTL_HOURS * ONE_HOUR_MS;

const CACHE_FILE = process.env.EXCHANGE_RATES_CACHE_FILE
  || path.join(process.cwd(), 'data', 'exchange-rates.json');

// API config (works with exchangerate.host; flexible for “exchange.host” style keys)
const API_BASE = process.env.EXCHANGE_HOST_BASE_URL
  || 'https://api.exchangerate.host/latest'; // base=USD&symbols=USD,EUR,GBP,JPY

const API_KEY = process.env.EXCHANGE_HOST_API_KEY || '';
// If your provider needs a specific query param name for keys, set it here:
const API_KEY_PARAM = process.env.EXCHANGE_HOST_API_KEY_PARAM || 'access_key';
// Some providers also accept header "apikey"
const API_KEY_HEADER = process.env.EXCHANGE_HOST_API_KEY_HEADER || 'apikey';

const BASE = process.env.EXCHANGE_BASE || 'USD';
const SYMBOLS = (process.env.EXCHANGE_SYMBOLS || 'USD,EUR,GBP,JPY')
  .split(',').map(s => s.trim().toUpperCase()).filter(Boolean).join(',');

let cache = {
  rates: { ...DEFAULT_RATES },
  fetchedAt: 0, // epoch ms
};

/* -------------------- helpers -------------------- */

function now() { return Date.now(); }
function fresh(ts) { return ts && (now() - ts) < CACHE_TTL_MS; }
function safeNum(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function ensureCacheDir() {
  try {
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  } catch {}
}

async function loadFromDisk() {
  try {
    const buf = await fs.readFile(CACHE_FILE, 'utf8');
    const json = JSON.parse(buf);
    if (json && json.rates && typeof json.fetchedAt === 'number') {
      // validate shape is per-USD
      cache.rates = { ...DEFAULT_RATES, ...json.rates };
      cache.fetchedAt = json.fetchedAt;
    }
  } catch {}
}

async function saveToDisk() {
  try {
    await ensureCacheDir();
    await fs.writeFile(
      CACHE_FILE,
      JSON.stringify({ rates: cache.rates, fetchedAt: cache.fetchedAt }, null, 2),
      'utf8'
    );
  } catch {}
}

async function fetchImpl(url, options) {
  // Node >=18 has global fetch. If not, fall back to node-fetch dynamically.
  const f = globalThis.fetch || (await import('node-fetch')).default;
  return f(url, options);
}

async function fetchFromAPI({ timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = new URL(API_BASE);
    url.searchParams.set('base', BASE);
    url.searchParams.set('symbols', SYMBOLS);

    // Some providers want the key as a query param
    if (API_KEY) {
      url.searchParams.set(API_KEY_PARAM, API_KEY);
    }

    const headers = {};
    // Some providers accept apikey header
    if (API_KEY) headers[API_KEY_HEADER] = API_KEY;

    const res = await fetchImpl(url.toString(), { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    // Try to normalize a few common shapes:
    // exchangerate.host: { base: "USD", rates: { EUR: 0.93, GBP: 0.78, ... } }
    // some paid providers: { success: true, base: "...", rates: { ... } }
    const apiRates = data?.rates && typeof data.rates === 'object' ? data.rates : null;
    if (!apiRates) throw new Error('No rates in response');

    const next = { ...DEFAULT_RATES };

    // Always force USD to 1.0 (we requested base=USD).
    next.USD = 1;

    for (const code of SYMBOLS.split(',')) {
      const k = code.toUpperCase();
      if (k === 'USD') continue;
      const val = safeNum(apiRates[k]);
      if (val) next[k] = val;
    }

    return next;
  } finally {
    clearTimeout(t);
  }
}

/* -------------------- public API -------------------- */

/**
 * Force-refresh from remote API, falling back to:
 *  - cached file
 *  - EXCHANGE_RATES_JSON (if provided)
 *  - DEFAULT_RATES
 */
export async function refreshExchangeRates({ timeoutMs } = {}) {
  // 1) Try remote
  try {
    const rates = await fetchFromAPI({ timeoutMs });
    cache.rates = rates;
    cache.fetchedAt = now();
    await saveToDisk();
    return cache.rates;
  } catch (e) {
    // 2) Try disk cache
    await loadFromDisk();
    if (!fresh(cache.fetchedAt)) {
      // 3) Try explicit env JSON override
      try {
        if (process.env.EXCHANGE_RATES_JSON) {
          const parsed = JSON.parse(process.env.EXCHANGE_RATES_JSON);
          cache.rates = { ...DEFAULT_RATES, ...parsed };
          cache.fetchedAt = now();
        }
      } catch {}
    }
    // 4) Ensure at least defaults
    cache.rates = cache.rates || { ...DEFAULT_RATES };
    cache.fetchedAt = cache.fetchedAt || 0;
    return cache.rates;
  }
}

/**
 * Async accessor that returns fresh rates if cache is stale,
 * otherwise returns the in-memory (or on-disk) cache.
 */
export async function getExchangeRates() {
  // In-memory fresh?
  if (fresh(cache.fetchedAt)) return cache.rates;

  // Load from disk if we don’t have fresh memory
  await loadFromDisk();
  if (fresh(cache.fetchedAt)) return cache.rates;

  // Finally, hit the API (with fallback logic inside)
  return refreshExchangeRates();
}

/**
 * Synchronous accessor (never hits the network). Useful for hot paths.
 * Might return slightly stale data until `refreshExchangeRates()` runs.
 */
export function getRates() {
  // Allow explicit override via ENV JSON (last resort; single boot read)
  try {
    if (!fresh(cache.fetchedAt) && process.env.EXCHANGE_RATES_JSON) {
      const parsed = JSON.parse(process.env.EXCHANGE_RATES_JSON);
      cache.rates = { ...DEFAULT_RATES, ...parsed };
      cache.fetchedAt = 0; // mark as stale so a later getExchangeRates() can refresh
    }
  } catch {}
  return cache.rates || DEFAULT_RATES;
}

/** Convert any currency in this per-USD space into GBP. */
export function toGBP(value, from = 'USD') {
  const rates = getRates();
  const fromRate = safeNum(rates[from], 1);   // "per 1 USD" figure for source
  const gbpRate  = safeNum(rates.GBP, 1);     // "per 1 USD" figure for GBP
  // Convert input → USD, then USD → GBP (both using per-USD rates)
  const usd = value / fromRate;
  return +(usd * gbpRate).toFixed(2);
}

export default {
  getRates,
  getExchangeRates,
  refreshExchangeRates,
  toGBP,
};
