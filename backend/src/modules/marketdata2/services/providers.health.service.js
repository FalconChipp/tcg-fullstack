// Provider health checks with latency, diagnostics, and server-side caching.

import { fetchWithTimeout } from './net.js';
import { getIndex } from './setIndex.service.js';

const TCGDEX_BASE = (process.env.TCGDEX_BASE_URL || 'https://api.tcgdex.net/v2').replace(/\/+$/,'');
const PTCGIO_BASE = (process.env.PTCGIO_BASE_URL || 'https://api.pokemontcg.io/v2').replace(/\/+$/,'');
const PPT_BASE    = (process.env.PPT_BASE_URL    || 'https://api.pokemonpricetracker.com/api/v2').replace(/\/+$/,'');

const PTCG_KEY =
  process.env.PTCGIO_API_KEY ||
  process.env.POKEMONTCG_IO_KEY ||
  process.env.POKEMONTCGIO_API_KEY ||
  process.env.POKEMONTCG_API_KEY ||
  process.env.POKEMONTCG_KEY ||
  '';

const TIMEOUT_MS = Number(process.env.MD2_HEALTH_PING_TIMEOUT || 12000);
// 🆕 cache TTL (env overrideable): default 5 minutes
export const HEALTH_TTL_MS = Number(process.env.MD2_HEALTH_TTL_MS || 300000);

function nowISO(){ return new Date().toISOString(); }

async function probe(name, url, { headers = {}, timeoutMs = TIMEOUT_MS, parseBody = false, method = 'GET' } = {}) {
  const started = Date.now();
  try {
    const r = await fetchWithTimeout(url, { headers, method }, timeoutMs);
    const latencyMs = Date.now() - started;
    if (!r.ok) {
      let msg = `HTTP ${r.status}`;
      if (parseBody) {
        try {
          const ct = r.headers.get('content-type') || '';
          if (/json/i.test(ct)) {
            const j = await r.json().catch(()=>null);
            if (j && (j.error || j.message)) msg += ` — ${(j.error || j.message)}`;
          } else {
            const t = await r.text().catch(()=> '');
            if (t) msg += ` — ${t.slice(0, 120).replace(/\s+/g,' ').trim()}`;
          }
        } catch {}
      }
      return { name, ok: false, latencyMs, message: msg, checkedAt: nowISO() };
    }
    return { name, ok: true, latencyMs, message: 'OK', checkedAt: nowISO() };
  } catch (e) {
    const latencyMs = Date.now() - started;
    const msg = /aborted|timeout/i.test(String(e?.message)) ? `timeout ${timeoutMs}ms` : (e?.message || 'fetch failed');
    return { name, ok: false, latencyMs, message: msg, checkedAt: nowISO() };
  }
}

/** TCGdex — prefer a tiny HEAD/GET to a known set if we have one locally. */
async function checkTCGdex() {
  const lang = process.env.MD2_LANG || 'en';
  try {
    const idx = await getIndex();
    const anyCode = Object.keys(idx.sets || {})[0];
    if (anyCode) {
      const url = `${TCGDEX_BASE}/${lang}/sets/${encodeURIComponent(anyCode)}`;
      const head = await probe('TCGdex', url, { method: 'HEAD', timeoutMs: Math.min(TIMEOUT_MS, 6000) });
      if (head.ok) return head;
      return probe('TCGdex', url, { timeoutMs: TIMEOUT_MS });
    }
  } catch {}
  return probe('TCGdex', `${TCGDEX_BASE}/${lang}/sets`, { timeoutMs: TIMEOUT_MS });
}

/** PokémonTCG.io — health (public) then /v2 tiny list with key if present. */
async function checkPTCGio() {
  const h = await probe('PTCG.io', 'https://api.pokemontcg.io/health', { timeoutMs: Math.min(TIMEOUT_MS, 5000) });
  if (h.ok) return h;

  const headers = { 'Accept':'application/json', 'User-Agent':'sixbyfive-tcg/md2-health' };
  if (PTCG_KEY) headers['X-Api-Key'] = PTCG_KEY;

  const url = `${PTCGIO_BASE}/sets?page=1&pageSize=1`;
  const r = await probe('PTCG.io', url, { headers, timeoutMs: TIMEOUT_MS, parseBody: true });

  if (!r.ok) {
    if (/HTTP 401|HTTP 403/i.test(r.message)) {
      r.message = PTCG_KEY ? `${r.message} (key present but rejected)` : 'auth required — set PTCGIO_API_KEY';
    } else if (/HTTP 429/i.test(r.message)) {
      r.message = 'rate limited (HTTP 429) — slow down or rotate key';
    }
  }
  return r;
}

/** PPT — /health then minimal list. */
async function checkPPT() {
  const h = await probe('PPT', `${PPT_BASE}/health`, { timeoutMs: Math.min(TIMEOUT_MS, 5000) });
  if (h.ok || !/HTTP 404/.test(h.message)) return h;
  return probe('PPT', `${PPT_BASE}/sets?limit=1`, { timeoutMs: TIMEOUT_MS });
}

export async function checkAll() {
  const [a, b, c] = await Promise.all([checkTCGdex(), checkPTCGio(), checkPPT()]);
  return [a, b, c];
}

// 🆕 cached facade with TTL + in-flight de-dupe
let _cache = { at: 0, data: null, inFlight: null };
export async function checkAllCached({ ttlMs = HEALTH_TTL_MS } = {}) {
  const now = Date.now();
  if (_cache.data && (now - _cache.at) < ttlMs) {
    return { list: _cache.data, cached: true, at: new Date(_cache.at).toISOString() };
  }
  if (_cache.inFlight) {
    const list = await _cache.inFlight;
    return { list, cached: true, at: new Date(_cache.at).toISOString() };
  }
  _cache.inFlight = (async () => {
    try {
      const list = await checkAll();
      _cache.data = list;
      _cache.at = Date.now();
      return list;
    } finally {
      _cache.inFlight = null;
    }
  })();
  const list = await _cache.inFlight;
  return { list, cached: false, at: new Date(_cache.at).toISOString() };
}

export default { checkAll, checkAllCached, HEALTH_TTL_MS };
