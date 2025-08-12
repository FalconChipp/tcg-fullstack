import fetch from 'node-fetch';

const TCGDEX_API_BASE = 'https://api.tcgdex.net/v2/en';

// ADDED: tunables via env
const TCGDEX_TIMEOUT_MS = Number(process.env.TCGDEX_TIMEOUT_MS || 5000);
const TCGDEX_RETRIES    = Number(process.env.TCGDEX_RETRIES || 2);
const RETRY_BACKOFF_MS  = Number(process.env.TCGDEX_BACKOFF_MS || 300);

// ADDED: tiny fetch helper with timeout + retry + backoff for transient errors
async function fetchJSON(url, { method = 'GET', headers = {} } = {}, {
  timeoutMs = TCGDEX_TIMEOUT_MS,
  retries = TCGDEX_RETRIES,
  backoffMs = RETRY_BACKOFF_MS
} = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'sixbyfive-tcg (server)',
          ...headers
        },
        signal: ctrl.signal
      });
      clearTimeout(t);

      // Transient? retry on 429/5xx
      if (!res.ok && (res.status === 429 || (res.status >= 500 && res.status < 600))) {
        lastErr = new Error(`TCGDex ${res.status} on ${url}`);
      } else {
        // Non-transient; return JSON or text
        const text = await res.text();
        try {
          return { res, json: text ? JSON.parse(text) : null };
        } catch {
          // CHANGED: safe parse; return null instead of throwing
          return { res, json: null, raw: text };
        }
      }
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
    }

    // backoff before retry (except after last attempt)
    if (attempt < retries) {
      await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
    }
  }
  throw lastErr || new Error('TCGDex request failed');
}

// Fetch a single card by ID
export async function fetchTCGDexCardById(cardId) {
  const url = `${TCGDEX_API_BASE}/cards/${encodeURIComponent(cardId)}`;
  const { res, json } = await fetchJSON(url);

  // CHANGED: treat 404 as "not found" (null) instead of throwing
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`[TCGDex] Failed to fetch card: ${cardId} (status ${res.status})`);
  }
  if (!json || typeof json !== 'object') {
    throw new Error(`[TCGDex] Unexpected card payload for ${cardId}`);
  }
  const card = json;
  card.number = card.number || card.localId || "";
  return card;
}

/**
 * TCGDex paged search (robust for all cases).
 * Handles API requirements:
 *   - Only add number if set is present
 *   - If name+number (no set), search by name and filter locally by number
 *   - If number only (no set/name), return no results
 * Handles both array and {data: [], totalCount: N} API responses.
 * CHANGED: wrapped with timeout/retries and never throws on transient errors.
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
  const url = `${TCGDEX_API_BASE}/cards?${params.join("&")}`;

  if (name && number && !set) {
    filterLocally = true;
  }

  // CHANGED: safe fetch with retries/timeouts
  const { res, json, raw } = await fetchJSON(url).catch(() => ({ res: { ok: false }, json: null }));

  if (!res?.ok || (!json && !raw)) {
    // Fail-open: return empty result instead of throwing
    return { cards: [], total: 0 };
  }

  let dataArr;
  if (Array.isArray(json)) {
    dataArr = json;
  } else if (json && Array.isArray(json.data)) {
    dataArr = json.data;
  } else {
    dataArr = [];
  }

  if (filterLocally) {
    dataArr = dataArr.filter(card =>
      card?.localId &&
      String(card.localId).replace(/^0+/, "") === String(number).replace(/^0+/, "")
    );
  }

  const fakeTotal = (dataArr.length === pageSize)
    ? page * pageSize + 1
    : (page - 1) * pageSize + dataArr.length;

  return {
    cards: dataArr.map(card => ({
      ...card,
      number: card.number || card.localId || "",
    })),
    total: Array.isArray(json)
      ? fakeTotal
      : (typeof json?.totalCount === "number" ? json.totalCount : dataArr.length),
  };
}

// Fetch all sets
export async function fetchTCGDexSets() {
  const url = `${TCGDEX_API_BASE}/sets`;
  const { res, json } = await fetchJSON(url);
  if (!res.ok) throw new Error('[TCGDex] Failed to fetch sets');
  return Array.isArray(json) ? json : [];
}

// Fetch a single set by code (e.g. 'sv08')
export async function fetchTCGDexSetByCode(code) {
  const url = `${TCGDEX_API_BASE}/sets/${encodeURIComponent(code)}`;
  const { res, json } = await fetchJSON(url);
  if (!res.ok) {
    if (res.status === 404) return null; // CHANGED: not found → null
    throw new Error(`[TCGDex] Failed to fetch set: ${code} (status ${res.status})`);
  }
  return json || null;
}
