// src/modules/marketdata2/services/priceAdapter.ptcgio.service.js
// Robust fallback/secondary price source using PokemonTCG.io (v2).
// We fetch a whole set in pages, join to *your* DB cards by `number`,
// and emit raw observations (USD from TCGplayer, EUR from Cardmarket).
//
// Exports:
//   - fetchSetPricesFallback(setCode, cards)
//
// Env:
//   PTCGIO_BASE_URL (default: https://api.pokemontcg.io/v2)
//   PTCGIO_API_KEY  (or POKEMONTCG*_KEY variants) -> header X-Api-Key
//   MD2_HTTP_TIMEOUT_MS (default 15000)
//   MD2_PTCG_PAGE_SIZE  (default 250)

import createLogger from './logger.js';
import { fetchWithTimeout, sleep } from './net.js';

const log = createLogger('ptcgio');

const BASE = (process.env.PTCGIO_BASE_URL || 'https://api.pokemontcg.io/v2').replace(/\/+$/, '');
const TIMEOUT_MS = Number(process.env.MD2_HTTP_TIMEOUT_MS || 15000);
const PAGE_SIZE  = Math.max(50, Math.min(250, Number(process.env.MD2_PTCG_PAGE_SIZE || 250)));

const PTCG_KEY =
  process.env.PTCGIO_API_KEY ||
  process.env.POKEMONTCG_IO_KEY ||
  process.env.POKEMONTCGIO_API_KEY ||
  process.env.POKEMONTCG_API_KEY ||
  process.env.POKEMONTCG_KEY ||
  '';

function nowISO(){ return new Date().toISOString(); }

function headers() {
  const h = { 'Accept': 'application/json', 'User-Agent': 'sixbyfive-tcg/md2-ptcgio' };
  if (PTCG_KEY) h['X-Api-Key'] = PTCG_KEY;
  return h;
}

// map tcgplayer / cardmarket variant keys to our canonical variants
function normVar(key) {
  const k = String(key || '').toLowerCase();
  if (k.includes('reverse')) return 'reverse';
  if (k.includes('holo'))    return 'holo';
  return 'normal';
}

// choose a meaningful numeric price
function pickPrice(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const candidates = [
    obj.market, obj.mid, obj.avg, obj.average, obj.trend,
    obj.trendPrice, obj.low, obj.lowPrice, obj.averageSellPrice, obj.price,
  ];
  for (const v of candidates) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * Try multiple plausible PTCG.io `set.id` values for a given code.
 * e.g. sv01 -> sv1; sv08.5 -> sv085, sv8.5, sv8-5, sv8pt5
 */
function candidateSetIds(setCode) {
  const s = String(setCode || '');
  const uniq = new Set([s]);

  // sv01 -> sv1
  uniq.add(s.replace(/^sv0/, 'sv'));
  // dots removed / dashed / compact
  uniq.add(s.replace(/\./g, ''));
  uniq.add(s.replace(/\./g, '-'));
  // special .5 -> pt5
  uniq.add(s.replace('.5', 'pt5'));
  // sv08.5 -> sv85
  uniq.add(s.replace('.',''));
  return Array.from(uniq).filter(Boolean);
}

async function fetchPage(setId, page, pageSize) {
  // We query by set.id; keep fields wide enough to cover both sources
  const url = `${BASE}/cards?q=set.id:${encodeURIComponent(setId)}&page=${page}&pageSize=${pageSize}`;
  const r = await fetchWithTimeout(url, { headers: headers() }, TIMEOUT_MS);
  if (r.status === 429) {
    // basic backoff
    await sleep(1500);
    return fetchPage(setId, page, pageSize);
  }
  if (!r.ok) {
    const txt = await r.text().catch(()=> '');
    throw new Error(`HTTP ${r.status}${txt ? ' — ' + txt.slice(0,120).replace(/\s+/g,' ') : ''}`);
  }
  return r.json();
}

async function fetchAllForSetId(setId) {
  let page = 1;
  let all = [];
  while (true) {
    const data = await fetchPage(setId, page, PAGE_SIZE);
    const batch = Array.isArray(data?.data) ? data.data : [];
    all.push(...batch);
    const count = Number(data?.count || 0);
    if (all.length >= count || batch.length === 0) break;
    page++;
  }
  return all;
}

/**
 * Join PTCG.io list to our DB cards by matching the card number.
 * Our DB cards contain { id: 'sv01-001', number: '001', ... }.
 * PTCG.io returns objects with `number`, `tcgplayer`, `cardmarket`, etc.
 */
function buildNumberMap(cards) {
  const m = new Map();
  for (const c of cards) {
    // keep raw `number` (may include letter suffixes), plus zero-stripped
    const nRaw = String(c.number ?? '').trim();
    if (!nRaw) continue;
    // The DB often stores numbers left-padded to 3 (e.g. 001). PTCG.io uses natural numbers (e.g. "1")
    const nLoose = nRaw.replace(/^0+/, '');
    m.set(nRaw, c);
    if (!m.has(nLoose)) m.set(nLoose, c);
  }
  return m;
}

/**
 * Extract observations (USD/EUR) for a single PTCG.io card json matched to our card_id.
 */
function extractObservations(cardId, ptcgCard) {
  const out = [];
  const seen = new Set();

  // TCGplayer (USD)
  const tp = ptcgCard?.tcgplayer?.prices || null;
  if (tp && typeof tp === 'object') {
    for (const [k, obj] of Object.entries(tp)) {
      const variant = normVar(k);
      const amount  = pickPrice(obj);
      if (amount != null) {
        const key = `${variant}::ptcgio:tcgplayer`;
        if (!seen.has(key)) {
          out.push({
            card_id: cardId,
            variant,
            source: 'ptcgio:tcgplayer',
            currency: 'USD',
            amount,
            observed_at: nowISO(),
          });
          seen.add(key);
        }
      }
    }
  }

  // Cardmarket (EUR)
  const cm = ptcgCard?.cardmarket?.prices || null;
  if (cm && typeof cm === 'object') {
    // PTCG.io typically gives flat prices here
    const amount = pickPrice(cm);
    if (amount != null) {
      const key = `normal::ptcgio:cardmarket`;
      if (!seen.has(key)) {
        out.push({
          card_id: cardId,
          variant: 'normal',
          source: 'ptcgio:cardmarket',
          currency: 'EUR',
          amount,
          observed_at: nowISO(),
        });
        seen.add(key);
      }
    }
  }

  return out;
}

/**
 * Public API used by collectPrices.job.js
 * @param {string} setCode
 * @param {Array<{id:string, number:string|number}>} cards  (from your DB)
 * @returns {Promise<Array<{card_id, variant, source, currency, amount, observed_at}>>}
 */
export async function fetchSetPricesFallback(setCode, cards) {
  const t0 = Date.now();
  if (!Array.isArray(cards) || cards.length === 0) return [];

  const idCandidates = candidateSetIds(setCode);
  let all = [];
  let usedId = null;
  let lastErr = null;

  for (const cand of idCandidates) {
    try {
      const list = await fetchAllForSetId(cand);
      if (Array.isArray(list) && list.length > 0) {
        all = list;
        usedId = cand;
        break;
      }
    } catch (e) {
      lastErr = e;
      // try next candidate
    }
  }

  if (!usedId) {
    // Log once; return [] (let other sources handle it)
    log.warn('set:lookup:fail', { setCode, tried: idCandidates, err: lastErr?.message || String(lastErr || 'not found') });
    return [];
  }

  // Join by number
  const byNum = buildNumberMap(cards);
  const observations = [];
  let matched = 0;

  for (const item of all) {
    const num = String(item?.number ?? '').trim();
    if (!num) continue;
    const card = byNum.get(num);
    if (!card?.id) continue;

    matched++;

    const obs = extractObservations(card.id, item);
    if (obs.length) observations.push(...obs);
  }

  log.info('set:done', {
    setCode,
    usedSetId: usedId,
    fetched: all.length,
    matched,
    observations: observations.length,
    ms: Date.now() - t0,
  });

  return observations;
}

export default { fetchSetPricesFallback };
