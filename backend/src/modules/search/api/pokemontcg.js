// src/modules/search/api/pokemontcg.js
import fetch from 'node-fetch';

const POKEMON_TCG_API = 'https://api.pokemontcg.io/v2';
const API_KEY = process.env.POKEMON_TCG_API_KEY || '';

const DEBUG_PRICE = process.env.DEBUG_PRICE === '1';

// ADDED: tunables
const PTCG_TIMEOUT_MS = 0;
const PTCG_RETRIES    = Number(process.env.PTCG_RETRIES || 2);
const RETRY_BACKOFF_MS = Number(process.env.PTCG_BACKOFF_MS || 300);

function getHeaders() {
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'sixbyfive-tcg (server)',
  };
  if (API_KEY) headers['X-Api-Key'] = API_KEY;
  return headers;
}

async function fetchJSON(url, { method = 'GET', headers = {} } = {}, {
  timeoutMs = PTCG_TIMEOUT_MS,
  retries = PTCG_RETRIES,
  backoffMs = RETRY_BACKOFF_MS
} = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Only create an AbortController if we actually want a timeout
    const useTimeout = timeoutMs && timeoutMs > 0;
    const ctrl = useTimeout ? new AbortController() : undefined;
    const t = useTimeout ? setTimeout(() => ctrl.abort(), timeoutMs) : null;

    try {
      const res = await fetch(url, {
        method,
        headers: { ...getHeaders(), ...headers },
        signal: ctrl?.signal
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
      await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
    }
  }
  throw lastErr || new Error('PTCG request failed');
}

console.log("[PTCG API] pokemontcg.js module loaded!");

/**
 * Fetch a single card by ID from PokémonTCG.io
 * @param {string} cardId - e.g. 'sv8-16'
 * @returns {Promise<Object|null>}  // CHANGED: returns null on 404
 */
export async function fetchPTCGCardById(cardId) {
  const url = `${POKEMON_TCG_API}/cards/${encodeURIComponent(cardId)}`;
  const { res, json } = await fetchJSON(url).catch((e) => {
    return { res: { ok: false, status: 0 }, json: null, error: e };
  });
  if (!res?.ok) {
    if (res?.status === 404) {
      return { data: null, status: 404, hasPrices: false };
    }
    throw new Error(`[PTCG] Failed to fetch card: ${cardId}${res?.status ? ` (status ${res.status})` : ''}`);
  }
  const data = json?.data || null;
  const hasPrices = !!(data?.tcgplayer || data?.cardmarket);
  return { data, status: res.status, hasPrices };
}

/**
 * Fetch multiple cards using query (by name, set, number, etc)
 * Always returns an array (may be empty)
 */
export async function fetchPTCGCards({ name, set, number }) {
  let query = '';
  if (name) query += `name:"${name}" `;
  if (set) query += `set.id:"${set}" `;
  if (number) query += `number:"${number}"`;
  const url = `${POKEMON_TCG_API}/cards?q=${encodeURIComponent(query.trim())}`;

  const { res, json } = await fetchJSON(url).catch(() => ({ res: { ok: false }, json: null }));
  if (!res?.ok || !json) {
    return []; // CHANGED: fail-open for search
  }
  return json.data || [];
}

/**
 * Fetch pricing information (tcgplayer, cardmarket) for a card by ID
 * Returns: { tcgplayer, cardmarket }
 * CHANGED: now uses the hardened fetchPTCGCardById (404 → null) and never throws.
 */
export async function fetchPTCGCardPrices(cardId) {
  try {
    const { data, status, hasPrices } = await fetchPTCGCardById(cardId);
    if (!data) return { tcgplayer: null, cardmarket: null, status, hasPrices: false };
    return {
      tcgplayer: data?.tcgplayer || null,
      cardmarket: data?.cardmarket || null,
      status: status || 200,
      hasPrices
    };
  } catch (e) {
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
    if (res?.status === 404) return null; // CHANGED: not found → null
    throw new Error(`[PTCG] Failed to fetch set: ${id}${res?.status ? ` (status ${res.status})` : ''}`);
  }
  return json?.data || null;
}
