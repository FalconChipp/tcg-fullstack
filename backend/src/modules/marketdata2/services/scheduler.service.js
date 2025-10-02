// src/modules/marketdata2/services/scheduler.service.js
// Scheduler utilities for Marketdata2.
//
// Exports:
//  - metadataTick({ limit })
//  - pricingTick({ limit })    ← now skips sets with no cards ingested
//  - patchTick({ setCode?, staleHours=48, maxCandidates? })
//  - startFallbackLoop()
//
// Keeps the fallback loop and patch tick you already wired.

import createLogger from './logger.js';
import { listSets } from './setIndex.service.js';
import ingestSetJob from '../jobs/ingestSet.job.js';
import collectPricesJob from '../jobs/collectPrices.job.js';

const log = createLogger('sched');

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function parseMs(iso) { const t = Date.parse(iso || ''); return Number.isFinite(t) ? t : null; }

/* ------------------- Metadata (cards) ------------------- */
export async function metadataTick({ limit = 2 } = {}) {
  const startedAt = Date.now();
  const sets = await listSets();

  const pick = sets
    .slice()
    .sort((a, b) => new Date(a.cardsNextScheduledAt) - new Date(b.cardsNextScheduledAt))
    .slice(0, clamp(Number(limit) || 2, 1, 10));

  let ok = true;
  const errors = [];

  for (const s of pick) {
    try {
      log.info('meta:run', { setCode: s.setCode });
      const r = await ingestSetJob.run({ setCode: s.setCode, lang: 'en' });
      if (!r?.ok) { ok = false; errors.push({ set: s.setCode, err: r?.errors || 'failed' }); }
    } catch (e) {
      ok = false; errors.push({ set: s.setCode, err: String(e?.message || e) });
    }
  }

  return {
    ok,
    counts: { sets: pick.length },
    errors,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
  };
}

/* ------------------- Pricing (prices) ------------------- */
export async function pricingTick({ limit = 2 } = {}) {
  const startedAt = Date.now();
  const sets = await listSets();

  // NEW: only consider sets that actually have cards (ingested)
  const eligible = sets.filter(s =>
    (s.cardsCount && s.cardsCount > 0) || !!s.cardsLastFetchedAt
  );

  const pick = eligible
    .slice()
    .sort((a, b) => new Date(a.pricesNextScheduledAt) - new Date(b.pricesNextScheduledAt))
    .slice(0, clamp(Number(limit) || 2, 1, 10));

  let ok = true;
  const errors = [];

  for (const s of pick) {
    try {
      log.info('price:run', { setCode: s.setCode });
      const r = await collectPricesJob.run({ setCode: s.setCode });
      if (!r?.ok) { ok = false; errors.push({ set: s.setCode, err: r?.errors || 'failed' }); }
    } catch (e) {
      ok = false; errors.push({ set: s.setCode, err: String(e?.message || e) });
    }
  }

  return {
    ok,
    counts: { sets: pick.length, eligible: eligible.length, total: sets.length },
    errors,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
  };
}

/* ------------------- Patch stale ------------------- */
export async function patchTick({
  setCode = null,
  staleHours = 48,
  maxCandidates = Number(process.env.MD2_PATCH_MAX_CANDIDATES || 200),
} = {}) {
  const startedAt = Date.now();
  const nowMs = Date.now();
  const cutoffMs = nowMs - Number(staleHours) * 60 * 60 * 1000;

  const sets = await listSets();

  // Only consider sets with cards
  let candidates = sets.filter(s =>
    ((s.cardsCount && s.cardsCount > 0) || !!s.cardsLastFetchedAt)
  );

  if (setCode) {
    const s = candidates.find(x => x.setCode === setCode);
    candidates = s ? [s] : [];
  } else {
    candidates = candidates.filter(s => {
      const last = parseMs(s.pricesLastFetchedAt);
      return last == null || last < cutoffMs;
    });
  }

  candidates.sort((a, b) => {
    const aT = parseMs(a.pricesLastFetchedAt) ?? 0;
    const bT = parseMs(b.pricesLastFetchedAt) ?? 0;
    return aT - bT;
  });
  candidates = candidates.slice(0, clamp(Number(maxCandidates) || 200, 1, 1000));

  let ok = true;
  const errors = [];
  let patched = 0;

  for (const s of candidates) {
    try {
      log.info('patch:run', { setCode: s.setCode });
      const r = await collectPricesJob.run({ setCode: s.setCode });
      if (!r?.ok) { ok = false; errors.push({ set: s.setCode, err: r?.errors || 'failed' }); }
      else patched++;
    } catch (e) {
      ok = false; errors.push({ set: s.setCode, err: String(e?.message || e) });
    }
  }

  return {
    ok,
    counts: { setsTried: candidates.length, patched },
    errors,
    candidates: candidates.map(c => c.setCode),
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
  };
}

/* ------------------- Fallback loop ------------------- */
export function startFallbackLoop() {
  const everyMetaMin = clamp(Number(process.env.MD2_EVERY_MIN_METADATA || 30), 1, 360);
  const everyPriceMin = clamp(Number(process.env.MD2_EVERY_MIN_PRICING || 60), 1, 360);

  log.info('fallback-loop:start', { everyMetaMin, everyPriceMin });

  let metaRunning = false;
  let priceRunning = false;

  const metaTimer = setInterval(async () => {
    if (metaRunning) return;
    metaRunning = true;
    try { await metadataTick({ limit: Number(process.env.MD2_METADATA_PER_TICK || 2) }); }
    catch (e) { log.warn('meta:tick:error', { err: String(e?.message || e) }); }
    finally { metaRunning = false; }
  }, everyMetaMin * 60_000);

  const priceTimer = setInterval(async () => {
    if (priceRunning) return;
    priceRunning = true;
    try { await pricingTick({ limit: Number(process.env.MD2_PRICING_PER_TICK || 2) }); }
    catch (e) { log.warn('price:tick:error', { err: String(e?.message || e) }); }
    finally { priceRunning = false; }
  }, everyPriceMin * 60_000);

  return function stop() {
    clearInterval(metaTimer);
    clearInterval(priceTimer);
    log.info('fallback-loop:stop');
  };
}

export default { metadataTick, pricingTick, patchTick, startFallbackLoop };
