// src/modules/search/api/tcgdex.js
// SELF-CONTAINED to avoid circular import with helpers.js

import fetch from 'node-fetch';

// Base + tunables (kept compatible with old envs)
const TCGDEX_API_BASE = process.env.TCGDEX_BASE || 'https://api.tcgdex.net/v2/en';
const TCGDEX_TIMEOUT_MS = Number(process.env.TCGDEX_TIMEOUT_MS ?? process.env.PROVIDER_TIMEOUT_MS ?? 5000);
const TCGDEX_RETRIES    = Number(process.env.TCGDEX_RETRIES ?? 2);
const RETRY_BACKOFF_MS  = Number(process.env.TCGDEX_BACKOFF_MS ?? 300);

// Local withTimeout (simple guard; keeps name used below)
function withTimeout(promise, ms, label = 'timeout') {
  if (!ms || ms <= 0) return promise;
  let t;
  const timer = new Promise((_, rej) => (t = setTimeout(() => rej(new Error(label)), ms)));
  return Promise.race([promise.finally(() => clearTimeout(t)), timer]);
}

// Hardened fetch with retry/backoff + safe JSON parse
async function fetchJSON(
  url,
  { method = 'GET', headers = {} } = {},
  {
    timeoutMs = TCGDEX_TIMEOUT_MS,
    retries = TCGDEX_RETRIES,
    backoffMs = RETRY_BACKOFF_MS,
  } = {}
) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const useTimeout = timeoutMs && timeoutMs > 0;
    const ctrl = useTimeout ? new AbortController() : undefined;
    const t = useTimeout ? setTimeout(() => ctrl.abort(), timeoutMs) : null;

    try {
      const doFetch = fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'sixbyfive-tcg (server)',
          ...headers,
        },
        signal: ctrl?.signal,
      });

      // optional second guard (same timeout window)
      const res = useTimeout ? await withTimeout(doFetch, timeoutMs) : await doFetch;

      if (!res.ok && (res.status === 429 || (res.status >= 500 && res.status < 600))) {
        lastErr = new Error(`TCGDex ${res.status} on ${url}`);
      } else {
        const text = await res.text();
        if (t) clearTimeout(t);
        try {
          return { res, json: text ? JSON.parse(text) : null };
        } catch {
          // safe-parse fallback
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
  throw lastErr || new Error('TCGDex request failed');
}

/* ---------- OLD EXPORTS (kept) ---------- */

// Single card by ID (404 => null). Ensures `number` present.
export async function fetchTCGDexCardById(cardId) {
  const url = `${TCGDEX_API_BASE}/cards/${encodeURIComponent(cardId)}`;
  const { res, json } = await fetchJSON(url);

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`[TCGDex] Failed to fetch card: ${cardId} (status ${res.status})`);
  }
  if (!json || typeof json !== 'object') {
    throw new Error(`[TCGDex] Unexpected card payload for ${cardId}`);
  }
  const card = json;
  card.number = card.number || card.localId || '';
  return card;
}

/**
 * Paged search:
 * - name/set/number/page/pageSize as before
 * - If (name && number && !set) → fetch by name and filter locally by number
 * - If (number && !name && !set) → return empty (unchanged)
 * - Accepts array or {data,totalCount}
 */
export async function fetchTCGDexCards({ name, set, number, page = 1, pageSize = 25 }) {
  if (number && !name && !set) {
    return { cards: [], total: 0 };
  }

  let params = [];
  let filterLocally = false;

  if (name) params.push(`name=${encodeURIComponent(name)}`);
  if (set) params.push(`set=${encodeURIComponent(set)}`);
  if (number && set) params.push(`number=${encodeURIComponent(number)}`);

  params.push(`pagination:page=${page}`);
  params.push(`pagination:itemsPerPage=${pageSize}`);
  const url = `${TCGDEX_API_BASE}/cards?${params.join('&')}`;

  if (name && number && !set) {
    filterLocally = true;
  }

  const { res, json, raw } = await fetchJSON(url).catch(() => ({ res: { ok: false }, json: null }));
  if (!res?.ok || (!json && !raw)) {
    return { cards: [], total: 0 };
  }

  let dataArr;
  if (Array.isArray(json)) dataArr = json;
  else if (json && Array.isArray(json.data)) dataArr = json.data;
  else dataArr = [];

  if (filterLocally) {
    dataArr = dataArr.filter(
      (card) =>
        card?.localId &&
        String(card.localId).replace(/^0+/, '') === String(number).replace(/^0+/, '')
    );
  }

  const fakeTotal =
    dataArr.length === pageSize ? page * pageSize + 1 : (page - 1) * pageSize + dataArr.length;

  return {
    cards: dataArr.map((card) => ({
      ...card,
      number: card.number || card.localId || '',
    })),
    total: Array.isArray(json)
      ? fakeTotal
      : typeof json?.totalCount === 'number'
      ? json.totalCount
      : dataArr.length,
  };
}

// All sets
export async function fetchTCGDexSets() {
  const url = `${TCGDEX_API_BASE}/sets`;
  const { res, json } = await fetchJSON(url);
  if (!res.ok) throw new Error('[TCGDex] Failed to fetch sets');
  return Array.isArray(json) ? json : [];
}

// Set by code (404 => null)
export async function fetchTCGDexSetByCode(code) {
  const url = `${TCGDEX_API_BASE}/sets/${encodeURIComponent(code)}`;
  const { res, json } = await fetchJSON(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`[TCGDex] Failed to fetch set: ${code} (status ${res.status})`);
  }
  return json || null;
}

/* ---------- OPTIONAL convenience (non-breaking) ---------- */

// Mapped single-card getter
export async function getCardById(id) {
  try {
    const data = await fetchTCGDexCardById(id);
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      number: data.localId || data.number || String(data.id || '').split('-').pop(),
      set: data.set?.id || data.set || null,
      setName: data.set?.name || data.setName || null,
      setLogo: data.set?.logo || data.setLogo || null,
      setSymbol: data.set?.symbol || data.setSymbol || null,
      image: data.image,
      rarity: data.rarity,
    };
  } catch {
    return null;
  }
}

// Simple mapped search (set-first), separate from paged API search
export async function searchCards({ name = '', set = '', number = '' } = {}) {
  let list = [];
  try {
    if (set) {
      const setNorm = set.toLowerCase();
      const { res, json } = await fetchJSON(`${TCGDEX_API_BASE}/sets/${encodeURIComponent(setNorm)}`);
      if (res?.ok && json) {
        list = (json?.cards || []).map((c) => ({
          id: c.id,
          name: c.name,
          number: c.localId || c.number || String(c.id || '').split('-').pop(),
          set: setNorm,
          setName: json?.name,
          setLogo: json?.logo,
          setSymbol: json?.symbol,
          image: c.image,
          rarity: c.rarity,
        }));
      }
    } else {
      const { res, json } = await fetchJSON(`${TCGDEX_API_BASE}/cards`);
      if (res?.ok && json) {
        const data = Array.isArray(json) ? json : json.data || [];
        list = data.map((c) => ({
          id: c.id,
          name: c.name,
          number: c.localId || c.number || String(c.id || '').split('-').pop(),
          set: c.set?.id,
          setName: c.set?.name,
          setLogo: c.set?.logo,
          setSymbol: c.set?.symbol,
          image: c.image,
          rarity: c.rarity,
        }));
      }
    }
  } catch {
    list = [];
  }

  const n = name.toLowerCase();
  return list.filter((c) => {
    if (name && !(c.name || '').toLowerCase().includes(n)) return false;
    if (number && String(c.number || '').toLowerCase() !== String(number).toLowerCase())
      return false;
    return true;
  });
}

// Default export bundle
const api = {
  fetchTCGDexCardById,
  fetchTCGDexCards,
  fetchTCGDexSets,
  fetchTCGDexSetByCode,
  // conveniences
  getCardById,
  searchCards,
};

export default api;
