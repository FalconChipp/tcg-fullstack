// src/modules/search/api/pokemontcg.js
// SELF-CONTAINED to avoid circular import with helpers.js

import fetch from 'node-fetch';
import http from 'node:http';
import https from 'node:https';

// --- CONFIG ---
const POKEMON_TCG_API = process.env.POKEMONTCG_BASE || 'https://api.pokemontcg.io/v2';
const API_KEY = process.env.POKEMON_TCG_API_KEY || '';

const DEBUG_PRICE = process.env.DEBUG_PRICE === '1';

// --- ENV SANITIZERS ---
const posNum = (v, def) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
};
const nonNegInt = (v, def) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : def;
};
const toPosInt = (v, def) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
};

// Tunables (sane defaults; env-overridable)
const PTCG_TIMEOUT_MS  = posNum(
  process.env.PTCG_TIMEOUT_MS ?? process.env.PRICE_TIMEOUT_MS ?? process.env.PROVIDER_TIMEOUT_MS,
  9000
);
const PTCG_RETRIES     = nonNegInt(process.env.PTCG_RETRIES, 1);
const RETRY_BACKOFF_MS = posNum(process.env.PTCG_BACKOFF_MS, 800);

// Optional very light circuit breaker
const BREAKER_FAILS    = nonNegInt(process.env.PTCG_BREAKER_FAILS, 6);
const BREAKER_SLEEP_MS = posNum(process.env.PTCG_BREAKER_SLEEP_MS, 120000);

let breakerUntilTs = 0;
let recent5xxCount = 0;

// Keep-alive to cut TLS setup overhead
const keepAliveHttp = new http.Agent({ keepAlive: true, maxSockets: 50 });
const keepAliveHttps = new https.Agent({ keepAlive: true, maxSockets: 50 });
const getAgent = (url) => (url.startsWith('https:') ? keepAliveHttps : keepAliveHttp);

// --- HEADERS ---
function getHeaders() {
  const headers = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate, br',
    'User-Agent': 'sixbyfive-tcg (server)',
  };
  if (API_KEY) headers['X-Api-Key'] = API_KEY;
  return headers;
}

// --- LOCAL helpers ---
function normalizeVariantKey(k) {
  const s = String(k || '').toLowerCase().trim();
  if (s === 'reverseholofoil' || s === 'reverseholo' || s === 'reverse') return 'reverse';
  if (s === 'holofoil' || s === 'holo') return 'holo';
  if (s === 'normal') return 'normal';
  return s;
}
function idToPTCG(id) {
  return String(id || '').trim().toLowerCase();
}

function shouldRetry(status, attempt, maxRetries) {
  if (status === 429) return attempt < maxRetries;
  if (status === 504) return attempt < Math.min(1, maxRetries);
  if (status >= 500 && status < 600) return attempt < Math.min(1, maxRetries);
  return false;
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function backoffDelay(base, attempt) {
  const exp = base * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * (base / 2));
  return Math.min(30000, exp + jitter);
}

// JSON fetch with retries & optional timeout (AbortController)
async function fetchJSON(
  url,
  { method = 'GET', headers = {} } = {},
  {
    timeoutMs = PTCG_TIMEOUT_MS,
    retries = PTCG_RETRIES,
    backoffMs = RETRY_BACKOFF_MS,
    label = 'PTCG',
  } = {}
) {
  // circuit breaker
  const now = Date.now();
  if (now < breakerUntilTs) {
    const err = new Error('PTCG circuit open (cooling down after repeated 5xx)');
    err.status = 503;
    throw err;
  }

  let lastErr;
  const maxAttempts = (retries ?? 0) + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // IMPORTANT: caller-provided timeout wins
    const desired = toPosInt(timeoutMs, PTCG_TIMEOUT_MS);
    const useTimeout = Math.max(desired, PTCG_TIMEOUT_MS);
    const ctrl = useTimeout ? new AbortController() : undefined;
    const t = useTimeout ? setTimeout(() => ctrl.abort(), useTimeout) : null;
    const started = Date.now();

    try {
      const res = await fetch(url, {
        method,
        headers: { ...getHeaders(), ...headers },
        signal: ctrl?.signal,
        agent: getAgent(url),
      });

      if (t) clearTimeout(t);
      const dur = Date.now() - started;

      if (!res.ok) {
        if (DEBUG_PRICE) {
          console.log(`[${label}][try ${attempt + 1}/${maxAttempts}] ${res.status} ${url} in ${dur}ms`);
        }
        const doRetry = shouldRetry(res.status, attempt, retries ?? 0);
        if (doRetry) {
          const wait = backoffDelay(backoffMs, attempt);
          if (DEBUG_PRICE) console.log(`[${label}][retry] waiting ${wait}ms before retrying ${url}`);
          await sleep(wait);
          continue;
        }
      } else if (DEBUG_PRICE) {
        console.log(`[${label}][try ${attempt + 1}/${maxAttempts}] ${res.status} ${url} in ${dur}ms`);
      }

      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch {}

      if (res.status >= 500) {
        recent5xxCount += 1;
        if (recent5xxCount >= BREAKER_FAILS) {
          breakerUntilTs = Date.now() + BREAKER_SLEEP_MS;
          if (DEBUG_PRICE) console.warn(`[${label}] breaker open for ${BREAKER_SLEEP_MS}ms`);
        }
      } else if (res.ok) {
        recent5xxCount = 0;
      }

      return { res, json, raw: json ? null : text };
    } catch (e) {
      if (t) clearTimeout(t);
      lastErr = e;
      const isAbort = e?.name === 'AbortError';
      if (DEBUG_PRICE) {
        const dur = Date.now() - started;
        console.warn(`[${label}][timeout] ${isAbort ? 'AbortError' : e?.message || e} after ${dur}ms for ${url}`);
      }
      if (!isAbort && attempt < (retries ?? 0)) {
        const wait = backoffDelay(backoffMs, attempt);
        if (DEBUG_PRICE) console.log(`[${label}][retry] waiting ${wait}ms before retrying ${url}`);
        await sleep(wait);
        continue;
      }
      break;
    }
  }
  throw lastErr || new Error('PTCG request failed');
}

if (DEBUG_PRICE) console.log('[PTCG API] pokemontcg.js module loaded!');

// ---------------------------------------------
// EXPORTS
// ---------------------------------------------

export async function fetchPTCGCardById(cardId, opts = {}) {
  const id = idToPTCG(cardId);
  const url = `${POKEMON_TCG_API}/cards/${encodeURIComponent(id)}`;
  const { res, json } = await fetchJSON(
    url,
    {},
    {
      timeoutMs: toPosInt(opts.timeoutMs, PTCG_TIMEOUT_MS),
      retries: nonNegInt(opts.retries, PTCG_RETRIES),
      backoffMs: toPosInt(opts.backoffMs, RETRY_BACKOFF_MS),
      label: 'PTCG',
    }
  ).catch((e) => {
    return { res: { ok: false, status: e?.status || 0 }, json: null, error: e };
  });
  if (!res?.ok) {
    if (res?.status === 404) {
      return { data: null, status: 404, hasPrices: false };
    }
    throw new Error(`[PTCG] Failed to fetch card: ${id}${res?.status ? ` (status ${res.status})` : ''}`);
  }
  const data = json?.data || null;
  const hasPrices = !!(data?.tcgplayer || data?.cardmarket);
  return { data, status: res.status, hasPrices };
}

export async function fetchPTCGCards({ name, set, number } = {}) {
  const parts = [];
  if (name) parts.push(`name:${JSON.stringify(name)}`);
  if (set) parts.push(`set.id:${JSON.stringify(set)}`);
  if (number) parts.push(`number:${JSON.stringify(number)}`);

  const query = encodeURIComponent(parts.join(' ').trim());
  const url = `${POKEMON_TCG_API}/cards?q=${query}`;

  const { res, json } = await fetchJSON(url, {}, { label: 'PTCG' })
    .catch(() => ({ res: { ok: false }, json: null }));
  if (!res?.ok || !json) return [];
  return json.data || [];
}

export async function fetchPTCGCardVendors(cardId, opts = {}) {
  try {
    const { data, status, hasPrices } = await fetchPTCGCardById(cardId, opts);
    if (!data) return { tcgplayer: null, cardmarket: null, status, hasPrices: false };
    return {
      tcgplayer: data?.tcgplayer || null,
      cardmarket: data?.cardmarket || null,
      status: status || 200,
      hasPrices,
    };
  } catch {
    return { tcgplayer: null, cardmarket: null, status: 0, hasPrices: false };
  }
}

export async function fetchPTCGSets() {
  const url = `${POKEMON_TCG_API}/sets`;
  const { res, json } = await fetchJSON(url, {}, { label: 'PTCG' })
    .catch(() => ({ res: { ok: false }, json: null }));
  if (!res?.ok || !json) {
    throw new Error('[PTCG] Failed to fetch sets');
  }
  return json.data || [];
}

export async function fetchPTCGSetById(id) {
  const url = `${POKEMON_TCG_API}/sets/${encodeURIComponent(idToPTCG(id))}`;
  const { res, json } = await fetchJSON(url, {}, { label: 'PTCG' })
    .catch(() => ({ res: { ok: false }, json: null }));
  if (!res?.ok) {
    if (res?.status === 404) return null;
    throw new Error(`[PTCG] Failed to fetch set: ${id}${res?.status ? ` (status ${res.status})` : ''}`);
  }
  return json?.data || null;
}

/* Optional convenience exports below (unchanged public surface) */

function mapCard(c) {
  const set = c?.set || {};
  const images = c?.images || {};
  return {
    id: c?.id?.toLowerCase(),
    name: c?.name,
    number: c?.number,
    set: set?.id?.toLowerCase(),
    setName: set?.name,
    setLogo: set?.images?.logo,
    setSymbol: set?.images?.symbol,
    image: images?.small || images?.large,
    rarity: c?.rarity,
    variations: c?.tcgplayer?.prices ? Object.keys(c.tcgplayer.prices) : [],
  };
}

export async function searchCardsMapped({ name = '', set = '', number = '' } = {}) {
  const q = [];
  if (name) q.push(`name:${JSON.stringify(name)}`);
  if (set) q.push(`set.id:${JSON.stringify(set)}`);
  if (number) q.push(`number:${JSON.stringify(number)}`);
  const query = encodeURIComponent(q.join(' '));
  const url =
    `${POKEMON_TCG_API}/cards?q=${query}` +
    `&orderBy=set.id,number` +
    `&select=id,name,number,images,set,rarity,tcgplayer`;
  try {
    const { res, json } = await fetchJSON(url, {}, { label: 'PTCG' });
    if (!res?.ok) return [];
    return (json?.data || []).map(mapCard);
  } catch {
    return [];
  }
}

export async function getCardByIdMapped(id, opts = {}) {
  try {
    const { res, json } = await fetchJSON(
      `${POKEMON_TCG_API}/cards/${encodeURIComponent(idToPTCG(id))}`,
      {},
      {
        timeoutMs: toPosInt(opts.timeoutMs, PTCG_TIMEOUT_MS),
        retries: nonNegInt(opts.retries, PTCG_RETRIES),
        backoffMs: toPosInt(opts.backoffMs, RETRY_BACKOFF_MS),
        label: 'PTCG',
      }
    );
    if (!res?.ok) return null;
    const c = json?.data;
    return c ? mapCard(c) : null;
  } catch {
    return null;
  }
}

export async function getPricesById(id, opts = {}) {
  try {
    const { res, json } = await fetchJSON(
      `${POKEMON_TCG_API}/cards/${encodeURIComponent(idToPTCG(id))}?select=tcgplayer,cardmarket`,
      {},
      {
        timeoutMs: toPosInt(opts.timeoutMs, PTCG_TIMEOUT_MS),
        retries: nonNegInt(opts.retries, PTCG_RETRIES),
        backoffMs: toPosInt(opts.backoffMs, RETRY_BACKOFF_MS),
        label: 'PTCG',
      }
    );
    if (!res?.ok) return {};

    const c = json?.data;
    const out = {};

    if (c?.tcgplayer?.prices) {
      for (const [k, v] of Object.entries(c.tcgplayer.prices)) {
        const key = normalizeVariantKey(k);
        out[key] = { ...(out[key] || {}), ...v };
      }
    }

    if (c?.cardmarket?.prices) {
      const cm = c.cardmarket.prices;
      if (cm?.averageSellPrice != null || cm?.lowPrice != null || cm?.trendPrice != null) {
        out.normal = {
          ...(out.normal || {}),
          averageSellPrice: cm?.averageSellPrice ?? out.normal?.averageSellPrice,
          lowPrice: cm?.lowPrice ?? out.normal?.lowPrice,
          trendPrice: cm?.trendPrice ?? out.normal?.trendPrice,
        };
      }
      if (cm?.reverseHoloSell != null || cm?.reverseHoloLow != null || cm?.reverseHoloTrend != null) {
        out.reverse = {
          ...(out.reverse || {}),
          reverseHoloSell: cm?.reverseHoloSell ?? out.reverse?.reverseHoloSell,
          reverseHoloLow: cm?.reverseHoloLow ?? out.reverse?.reverseHoloLow,
          reverseHoloTrend: cm?.reverseHoloTrend ?? out.reverse?.reverseHoloTrend,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

// Aliases
export const fetchPTCGCardPrices = getPricesById;
export const fetchPTCGCardPricesUnified = getPricesById;

const api = {
  fetchPTCGCardById,
  fetchPTCGCards,
  fetchPTCGCardVendors,
  fetchPTCGSets,
  fetchPTCGSetById,
  searchCardsMapped,
  getCardByIdMapped,
  getPricesById,
  fetchPTCGCardPrices,
  fetchPTCGCardPricesUnified,
};

export default api;
