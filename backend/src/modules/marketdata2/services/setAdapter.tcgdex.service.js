// src/modules/marketdata2/services/setAdapter.tcgdex.service.js
// TCGdex set+card fetcher with two-lane retries and timeouts.
// Keeps behavior deterministic and fast, but robust to intermittents.

import pLimit from 'p-limit';
import createLogger from './logger.js';
import { fetchWithTimeout } from './net.js';

const log = createLogger('md2:tcgdex');

const BASE = process.env.TCGDEX_BASE_URL || 'https://api.tcgdex.net/v2';
const FAST_TIMEOUT = +(process.env.MD2_FETCH_TIMEOUT_MS || 15000);
const SLOW_TIMEOUT = +(process.env.MD2_FETCH_TIMEOUT_SLOW_MS || 30000);
const CONC = +(process.env.MD2_TCGDEX_CONCURRENCY || 6);
const SLOW_CONC = +(process.env.MD2_TCGDEX_SLOW_CONC || 2);
const FAST_RETRIES = +(process.env.MD2_TCGDEX_MAX_RETRIES || 2);
const SLOW_RETRIES = +(process.env.MD2_TCGDEX_MAX_RETRIES_SLOW || 4);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getJson(url, { timeout = FAST_TIMEOUT, retries = FAST_RETRIES } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetchWithTimeout(url, { timeout });
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
      return await r.json();
    } catch (e) {
      lastErr = e;
      if (i < retries) await sleep(250 * (i + 1));
    }
  }
  throw lastErr;
}

export async function fetchSetMeta(setCode) {
  const url = `${BASE}/sets/${encodeURIComponent(setCode)}`;
  return getJson(url);
}

async function fetchCardRaw(cardId) {
  const url = `${BASE}/cards/${encodeURIComponent(cardId)}`;
  return getJson(url);
}

function ensureCardId(setCode, obj) {
  const num = String(obj?.localId ?? obj?.number ?? '').padStart(3, '0');
  return obj?.id || `${setCode}-${num}`;
}

function normalizeCard(json) {
  // Keep as-is but ensure consistent shapes for variants and numeric types
  const variants = Array.isArray(json?.variants) ? json.variants.map(v => String(v).toLowerCase()) : [];
  const types = Array.isArray(json?.types) ? json.types : [];
  const subtypes = Array.isArray(json?.subtypes) ? json.subtypes : [];

  return {
    ...json,
    variants,
    types,
    subtypes,
  };
}

/**
 * Fetch full set and every card JSON via two-pass strategy:
 * - First pass: fast concurrency+timeout
 * - Second pass: retry failures with slower lane
 */
export async function fetchSetAndCards(setCode) {
  const setMeta = await fetchSetMeta(setCode);

  // TCGdex provides list of cards for a set via /sets/{code}
  const cardIds = Array.isArray(setMeta?.cards) ? setMeta.cards : [];
  if (!cardIds.length) {
    // Fallback: derive ids from known count/local range if needed (rare)
    throw new Error(`TCGdex returned no cards list for set ${setCode}`);
  }

  const firstLimit = pLimit(CONC);
  const slowLimit = pLimit(SLOW_CONC);

  let results = new Array(cardIds.length).fill(null);
  let failures = [];

  // First pass
  await Promise.all(cardIds.map((id, idx) => firstLimit(async () => {
    try {
      const raw = await fetchCardRaw(id);
      results[idx] = normalizeCard(raw);
    } catch (e) {
      failures.push({ id, idx, err: e });
    }
  })));

  // Second pass (slow lane) for failures
  if (failures.length) {
    const again = [];
    await Promise.all(failures.map(({ id, idx }) => slowLimit(async () => {
      try {
        const raw = await getJson(`${BASE}/cards/${encodeURIComponent(id)}`, {
          timeout: SLOW_TIMEOUT, retries: SLOW_RETRIES,
        });
        results[idx] = normalizeCard(raw);
      } catch (e) {
        again.push({ id, idx, err: e });
      }
    })));
    failures = again;
  }

  // Drop any nulls safely
  const cards = results.filter(Boolean);

  log.info('fetched:set', { setCode, total: cardIds.length, ok: cards.length, failed: failures.length });
  return { setMeta, cards };
}
