// src/tasks/marketdata2.schedule.js
// Background scheduler for Marketdata2 (cards + prices + patch).
//
// Exports:
//   startMarketdata2Schedule(): () => void      // start loop, returns stop()
//   getMarketdata2ScheduleSnapshot(): object    // last results for admin
//   previewSetSchedule(): array                 // small preview for admin UI
//
// Design notes:
// - Runs metadata and pricing on independent cadences (env-tunable).
// - Adds jitter and in-memory locks to avoid overlap & bursts.
// - Skips pricing tick if providers cache says PTCG.io is rate-limited/down.
// - Uses set index next/last times to pick due sets; each tick limits work.
// - Minimal deps; all state is in-memory + the set index JSON.

import { metadataTick, pricingTick, patchTick } from '../modules/marketdata2/services/scheduler.service.js';
import { listSets, computeNextTimes, upsertSetIndexEntry } from '../modules/marketdata2/services/setIndex.service.js';
import { checkAllCached } from '../modules/marketdata2/services/providers.health.service.js';

// ---------- env tunables ----------
const EVERY_MIN_METADATA = Number(process.env.MD2_EVERY_MIN_METADATA || 30);  // default: 30 min
const EVERY_MIN_PRICING  = Number(process.env.MD2_EVERY_MIN_PRICING  || 60);  // default: 60 min
const EVERY_MIN_PATCH    = Number(process.env.MD2_EVERY_MIN_PATCH    || 1440);// default: daily
const METADATA_PER_TICK  = Number(process.env.MD2_METADATA_PER_TICK  || 2);
const PRICING_PER_TICK   = Number(process.env.MD2_PRICING_PER_TICK   || 2);
const PATCH_STALE_HOURS  = Number(process.env.MD2_PATCH_STALE_HOURS  || 72);
const HEALTH_TTL_MS      = Number(process.env.MD2_HEALTH_TTL_MS      || 300000); // 5m
const JITTER_PCT         = Number(process.env.MD2_SCHED_JITTER_PCT   || 0.2);    // ±20%

// ---------- small utils ----------
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const nowISO = () => new Date().toISOString();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function withJitter(ms) {
  const span = Math.floor(ms * clamp(JITTER_PCT, 0, 0.50));
  const delta = (Math.random() * 2*span) - span; // [-span, +span]
  return Math.max(5_000, ms + delta);
}
function minutes(n) { return n * 60_000; }

// ---------- in-memory locks to prevent overlapping runs ----------
const locks = new Map();
async function runLocked(key, fn) {
  if (locks.get(key)) return { skipped: true, reason: 'busy' };
  locks.set(key, true);
  try { return await fn(); }
  finally { locks.delete(key); }
}

// ---------- snapshot for admin ----------
const snapshot = {
  startedAt: null,
  stoppedAt: null,
  lastMetadata: null,
  lastPricing: null,
  lastPatch: null,
  eras: {},  // placeholder for future per-era stats
  rollup: {}
};

export function getMarketdata2ScheduleSnapshot() {
  return snapshot;
}

// ---------- schedule preview for admin UI ----------
// Shape expected by your /admin page route: array of entries like
// { era, sets: [setCode...], nextFetchAt, nextCollectAt, nextSelection: [codes...] }
export async function previewSetSchedule() {
  const sets = await listSets();
  const out = [];

  // Group by era to make it easier to eyeball
  const byEra = new Map();
  for (const s of sets) {
    const era = (s.era || 'unknown').toString();
    if (!byEra.has(era)) byEra.set(era, []);
    // ensure next times are present (compute from last if missing)
    const nexts = computeNextTimes(s, new Date());
    const row = { ...s, ...nexts };
    byEra.get(era).push(row);
  }

  // For each era, sort by upcoming "prices next" primarily, "cards next" secondarily.
  for (const [era, list] of byEra.entries()) {
    const sorted = list.slice().sort((a, b) => {
      const ap = Date.parse(a.pricesNextScheduledAt || 0) || Infinity;
      const bp = Date.parse(b.pricesNextScheduledAt || 0) || Infinity;
      if (ap !== bp) return ap - bp;
      const ac = Date.parse(a.cardsNextScheduledAt || 0) || Infinity;
      const bc = Date.parse(b.cardsNextScheduledAt || 0) || Infinity;
      return ac - bc;
    });

    const nextSelection = sorted
      .slice(0, PRICING_PER_TICK)
      .map(s => s.setCode);

    out.push({
      era,
      sets: sorted.map(s => s.setCode),
      nextFetchAt: sorted[0]?.cardsNextScheduledAt || null,
      nextCollectAt: sorted[0]?.pricesNextScheduledAt || null,
      nextSelection,
    });
  }

  // Also opportunistically normalize any missing "next" times back to the index
  // (best-effort, non-blocking)
  Promise.resolve().then(async () => {
    for (const s of sets) {
      const nexts = computeNextTimes(s, new Date());
      if (!s.cardsNextScheduledAt || !s.pricesNextScheduledAt) {
        await upsertSetIndexEntry(s.setCode, nexts).catch(() => {});
      }
    }
  });

  return out;
}

// ---------- background loop ----------
export async function startMarketdata2Schedule() {
  if (snapshot.startedAt && !snapshot.stoppedAt) {
    // already running
    return () => {};
  }
  snapshot.startedAt = nowISO();
  snapshot.stoppedAt = null;

  let stopped = false;
  const timers = new Set();

  function scheduleEvery(label, minutesInterval, handler, { runAtStart = false } = {}) {
    let alive = true;

    async function tickLoop() {
      if (!alive || stopped) return;
      const delay = withJitter(minutes(minutesInterval));
      try {
        await runLocked(label, handler);
      } catch (e) {
        // swallow; handler already returns structured data
      } finally {
        if (alive && !stopped) {
          const t = setTimeout(tickLoop, delay);
          timers.add(t);
        }
      }
    }

    // initial kick (optionally)
    const t0 = setTimeout(tickLoop, runAtStart ? 5_000 : withJitter(minutes(minutesInterval)));
    timers.add(t0);

    // return canceller
    return () => { alive = false; };
  }

  // ---- Handlers ----

  const doMetadata = async () => {
    const res = await metadataTick({ limit: METADATA_PER_TICK }).catch(err => ({
      ok: false, errors: [String(err?.message || err)], startedAt: nowISO(), finishedAt: nowISO(), counts: { sets: 0 }
    }));
    snapshot.lastMetadata = res;
    return res;
  };

  const doPricing = async () => {
    // Be gentle: if providers say rate limited or down, skip this cycle.
    let providersOk = true;
    try {
      const { list } = await checkAllCached({ ttlMs: HEALTH_TTL_MS });
      const ptcgio = list.find(p => p.name?.toLowerCase().includes('ptcg'));
      if (ptcgio && (!ptcgio.ok || /429|auth required|rejected|timeout/i.test(ptcgio.message))) {
        providersOk = false;
      }
    } catch {}
    if (!providersOk) {
      const skipped = { ok: true, skipped: true, reason: 'providers-unhealthy', startedAt: nowISO(), finishedAt: nowISO(), counts: { sets: 0 } };
      snapshot.lastPricing = skipped;
      return skipped;
    }

    const res = await pricingTick({ limit: PRICING_PER_TICK }).catch(err => ({
      ok: false, errors: [String(err?.message || err)], startedAt: nowISO(), finishedAt: nowISO(), counts: { sets: 0 }
    }));
    snapshot.lastPricing = res;
    return res;
  };

  const doPatch = async () => {
    const res = await patchTick({ staleHours: PATCH_STALE_HOURS }).catch(err => ({
      ok: false, errors: [String(err?.message || err)], startedAt: nowISO(), finishedAt: nowISO(), counts: { sets: 0 }
    }));
    snapshot.lastPatch = res;
    return res;
  };

  // ---- Schedule the loops ----
  const cancelMeta   = scheduleEvery('tick:metadata', EVERY_MIN_METADATA, doMetadata, { runAtStart: true });
  const cancelPrice  = scheduleEvery('tick:pricing',  EVERY_MIN_PRICING,  doPricing,  { runAtStart: true });
  const cancelPatch  = scheduleEvery('tick:patch',    EVERY_MIN_PATCH,    doPatch,    { runAtStart: false });

  // ---- Stop function ----
  return () => {
    stopped = true;
    snapshot.stoppedAt = nowISO();
    cancelMeta(); cancelPrice(); cancelPatch();
    for (const t of timers) clearTimeout(t);
    timers.clear();
  };
}

export default {
  startMarketdata2Schedule,
  getMarketdata2ScheduleSnapshot,
  previewSetSchedule,
};
