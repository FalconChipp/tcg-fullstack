// src/modules/search/api/pokemontcg.js
import fetch from 'node-fetch';

const POKEMON_TCG_API = 'https://api.pokemontcg.io/v2';
const API_KEY = process.env.POKEMON_TCG_API_KEY || '';

// ADDED: tunables
const PTCG_TIMEOUT_MS = Number(process.env.PTCG_TIMEOUT_MS || 5000);
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

// ADDED: common helper for timeout + retry + backoff
async function fetchJSON(url, { method = 'GET', headers = {} } = {}, {
  timeoutMs = PTCG_TIMEOUT_MS,
  retries = PTCG_RETRIES,
  backoffMs = RETRY_BACKOFF_MS
} = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, headers: { ...getHeaders(), ...headers }, signal: ctrl.signal });
      clearTimeout(t);

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
      clearTimeout(t);
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
  const { res, json } = await fetchJSON(url).catch(() => ({ res: { ok: false }, json: null }));
  if (!res?.ok) {
    // CHANGED: treat 404 as "not found" instead of throwing; other non-ok still bubble up
    if (res?.status === 404) return null;
    throw new Error(`[PTCG] Failed to fetch card: ${cardId}${res?.status ? ` (status ${res.status})` : ''}`);
  }
  return json?.data || null;
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
    const card = await fetchPTCGCardById(cardId);
    if (!card) return { tcgplayer: null, cardmarket: null };
    return {
      tcgplayer: card?.tcgplayer || null,
      cardmarket: card?.cardmarket || null,
    };
  } catch (e) {
    // Network/transient failures → return empty pricing; caller should fail-open
    return { tcgplayer: null, cardmarket: null };
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
