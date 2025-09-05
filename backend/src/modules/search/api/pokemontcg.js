// src/modules/search/api/pokemontcg.js
// SELF-CONTAINED to avoid circular import with helpers.js

import fetch from 'node-fetch';

// --- CONFIG ---
const POKEMON_TCG_API = process.env.POKEMONTCG_BASE || 'https://api.pokemontcg.io/v2';
const API_KEY = process.env.POKEMON_TCG_API_KEY || '';

const DEBUG_PRICE = process.env.DEBUG_PRICE === '1';

// Tunables (kept)
// CHANGED: use sane defaults and allow per-call overrides
const PTCG_TIMEOUT_MS  = Number(process.env.PTCG_TIMEOUT_MS ?? process.env.PROVIDER_TIMEOUT_MS ?? 6000);
const PTCG_RETRIES     = Number(process.env.PTCG_RETRIES ?? 2);
const RETRY_BACKOFF_MS = Number(process.env.PTCG_BACKOFF_MS ?? 300);

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
  return k;
}

// JSON fetch with retries & optional timeout (AbortController)
async function fetchJSON(
  url,
  { method = 'GET', headers = {} } = {},
  {
    timeoutMs = PTCG_TIMEOUT_MS,
    retries = PTCG_RETRIES,
    backoffMs = RETRY_BACKOFF_MS,
  } = {}
) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const useTimeout = timeoutMs && timeoutMs > 0;
    const ctrl = useTimeout ? new AbortController() : undefined;
    const t = useTimeout ? setTimeout(() => ctrl.abort(), timeoutMs) : null;

    try {
      const res = await fetch(url, {
        method,
        headers: { ...getHeaders(), ...headers },
        signal: ctrl?.signal,
      });

      if (t) clearTimeout(t);

      // Retry on 429 or 5xx
      if (!res.ok && (res.status === 429 || (res.status >= 500 && res.status < 600))) {
        lastErr = new Error(`PTCG ${res.status} on ${url}`);
      } else {
        const text = await res.text();
        try {
          return { res, json: text ? JSON.parse(text) : null };
        } catch {
          return { res, json: null, raw: text };
        }
      }
    } catch (e) {
      if (t) clearTimeout(t);
      lastErr = e;
    }

    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, attempt)));
    }
  }
  throw lastErr || new Error('PTCG request failed');
}

if (DEBUG_PRICE) console.log('[PTCG API] pokemontcg.js module loaded!');

// ---------------------------------------------
// EXPORTS
// ---------------------------------------------

/**
 * Fetch a single card by ID from PokémonTCG.io
 * @param {string} cardId - e.g. 'sv8-57'
 * @param {{timeoutMs?:number, retries?:number, backoffMs?:number}} opts
 * @returns {Promise<{data: object|null, status: number, hasPrices: boolean}>}
 */
export async function fetchPTCGCardById(cardId, opts = {}) {
  const url = `${POKEMON_TCG_API}/cards/${encodeURIComponent(cardId)}`;
  const { res, json } = await fetchJSON(
    url,
    {},
    {
      timeoutMs: toInt(opts.timeoutMs, PTCG_TIMEOUT_MS),
      retries: toInt(opts.retries, PTCG_RETRIES),
      backoffMs: toInt(opts.backoffMs, RETRY_BACKOFF_MS),
    }
  ).catch((e) => {
    return { res: { ok: false, status: 0 }, json: null, error: e };
  });
  if (!res?.ok) {
    if (res?.status === 404) {
      return { data: null, status: 404, hasPrices: false };
    }
    throw new Error(
      `[PTCG] Failed to fetch card: ${cardId}${res?.status ? ` (status ${res.status})` : ''}`
    );
  }
  const data = json?.data || null;
  const hasPrices = !!(data?.tcgplayer || data?.cardmarket);
  return { data, status: res.status, hasPrices };
}

function toInt(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/**
 * Fetch multiple cards using query (by name, set, number, etc)
 */
export async function fetchPTCGCards({ name, set, number } = {}) {
  const parts = [];
  if (name) parts.push(`name:${JSON.stringify(name)}`);
  if (set) parts.push(`set.id:${JSON.stringify(set)}`);
  if (number) parts.push(`number:${JSON.stringify(number)}`);

  const query = encodeURIComponent(parts.join(' ').trim());
  const url = `${POKEMON_TCG_API}/cards?q=${query}`;

  const { res, json } = await fetchJSON(url).catch(() => ({ res: { ok: false }, json: null }));
  if (!res?.ok || !json) {
    return [];
  }
  return json.data || [];
}

/**
 * Fetch pricing information (tcgplayer, cardmarket) for a card by ID
 * @param {string} cardId
 * @param {{timeoutMs?:number, retries?:number, backoffMs?:number}} opts
 * @returns {{tcgplayer:any, cardmarket:any, status:number, hasPrices:boolean}}
 */
export async function fetchPTCGCardPrices(cardId, opts = {}) {
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

/**
 * Fetch all sets (returns array of {id, name, ...})
 */
export async function fetchPTCGSets() {
  const url = `${POKEMON_TCG_API}/sets`;
  const { res, json } = await fetchJSON(url).catch(() => ({ res: { ok: false }, json: null }));
  if (!res?.ok || !json) {
    throw new Error('[PTCG] Failed to fetch sets');
  }
  return json.data || [];
}

/**
 * Fetch set by ID/code (returns {id, name, ...})
 */
export async function fetchPTCGSetById(id) {
  const url = `${POKEMON_TCG_API}/sets/${encodeURIComponent(id)}`;
  const { res, json } = await fetchJSON(url).catch(() => ({ res: { ok: false }, json: null }));
  if (!res?.ok) {
    if (res?.status === 404) return null;
    throw new Error(
      `[PTCG] Failed to fetch set: ${id}${res?.status ? ` (status ${res.status})` : ''}`
    );
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
    const { res, json } = await fetchJSON(url);
    if (!res?.ok) return [];
    return (json?.data || []).map(mapCard);
  } catch {
    return [];
  }
}

export async function getCardByIdMapped(id, opts = {}) {
  try {
    const { res, json } = await fetchJSON(
      `${POKEMON_TCG_API}/cards/${encodeURIComponent(id)}`,
      {},
      {
        timeoutMs: toInt(opts.timeoutMs, PTCG_TIMEOUT_MS),
        retries: toInt(opts.retries, PTCG_RETRIES),
        backoffMs: toInt(opts.backoffMs, RETRY_BACKOFF_MS),
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
      `${POKEMON_TCG_API}/cards/${encodeURIComponent(id)}?select=tcgplayer,cardmarket`,
      {},
      {
        timeoutMs: toInt(opts.timeoutMs, PTCG_TIMEOUT_MS),
        retries: toInt(opts.retries, PTCG_RETRIES),
        backoffMs: toInt(opts.backoffMs, RETRY_BACKOFF_MS),
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
      if (
        cm?.reverseHoloSell != null ||
        cm?.reverseHoloLow != null ||
        cm?.reverseHoloTrend != null
      ) {
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

// Alias expected by updateCardPrices.js (kept)
export const fetchPTCGCardPricesUnified = getPricesById;

const api = {
  fetchPTCGCardById,
  fetchPTCGCards,
  fetchPTCGCardPrices,
  fetchPTCGSets,
  fetchPTCGSetById,
  searchCardsMapped,
  getCardByIdMapped,
  getPricesById,
  fetchPTCGCardPricesUnified,
};

export default api;
