// src/modules/marketdata2/services/ppt.budget.service.js
// PURPOSE
// - Centralize PokemonPriceTracker (PPT) daily credit budgeting
// - Persist usage in a tiny JSON file under data/marketdata/index/ppt.budget.json
// - Provide helpers for planning patch calls and committing usage
//
// ENV
// - PPT_DAILY_SOFT_CAP (default 80)  -> daily credits you *want* to spend (soft)
// - MD2_PPT_COST_PER_CARD (default 1)-> cost we assume per by-id call
//
// FILE SHAPE (data/marketdata/index/ppt.budget.json):
// {
//   "version": 1,
//   "resetAtUtc": "2025-09-25T00:00:00.000Z",
//   "usedToday": 12,
//   "cap": 80,
//   "updatedAt": "2025-09-25T12:00:01.234Z"
// }
//
// API
// - getBudgetState() -> { cap, usedToday, remaining, resetAtUtc, updatedAt }
// - getRemainingCredits() -> number
// - planPatch({ gaps:[cardId,...], maxBatch? }) -> { callPlan:[{cardId, by:'id', cost}], budget, willUse }
// - commitUsage(n) -> persist usage delta
//
// NOTES
// - We keep it deliberately simple: every by-id call costs 1 credit unless you change MD2_PPT_COST_PER_CARD.
// - If you later add bulk-by-set in the PPT adapter, you can extend planPatch to schedule a bulk call
//   with a different cost profile.

import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureIndexDir, paths as cachePaths } from './setCache.service.js';

const VERSION = 1;
const STATE_FILE = path.join(cachePaths.INDEX_ROOT, 'ppt.budget.json');

function isoNow() {
  return new Date().toISOString();
}

function todayUtcMidnightIso(d = new Date()) {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  return dt.toISOString();
}

function defaultCap() {
  const cap = Number(process.env.PPT_DAILY_SOFT_CAP || 80);
  return Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 80;
}

function costPerCard() {
  const c = Number(process.env.MD2_PPT_COST_PER_CARD || 1);
  return Number.isFinite(c) && c > 0 ? c : 1;
}

async function atomicWrite(filePath, jsonObj) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = filePath + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(jsonObj, null, 2), 'utf8');
  await fs.rename(tmp, filePath);
}

async function readState() {
  await ensureIndexDir();
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object') throw new Error('bad state');
    return j;
  } catch {
    // Initialize a fresh state for today
    const st = {
      version: VERSION,
      resetAtUtc: todayUtcMidnightIso(), // midnight UTC today
      usedToday: 0,
      cap: defaultCap(),
      updatedAt: isoNow(),
    };
    await atomicWrite(STATE_FILE, st);
    return st;
  }
}

function needsReset(state) {
  // If stored resetAtUtc is before *today* midnight UTC, we reset usage.
  // We store resetAtUtc as *today's* midnight; on the next day we advance it.
  const todayMid = todayUtcMidnightIso();
  return state.resetAtUtc !== todayMid;
}

async function writeState(state) {
  state.updatedAt = isoNow();
  await atomicWrite(STATE_FILE, state);
}

/**
 * Public: read current budget, auto-reset at UTC midnight.
 */
export async function getBudgetState() {
  const s = await readState();

  if (needsReset(s)) {
    // New day -> reset usage and advance resetAtUtc to today's midnight
    const newState = {
      ...s,
      resetAtUtc: todayUtcMidnightIso(),
      usedToday: 0,
      cap: Number.isFinite(s.cap) && s.cap > 0 ? s.cap : defaultCap(),
    };
    await writeState(newState);
    return {
      cap: newState.cap,
      usedToday: newState.usedToday,
      remaining: Math.max(0, newState.cap - newState.usedToday),
      resetAtUtc: newState.resetAtUtc,
      updatedAt: newState.updatedAt,
    };
  }

  return {
    cap: Number.isFinite(s.cap) && s.cap > 0 ? s.cap : defaultCap(),
    usedToday: Number(s.usedToday || 0),
    remaining: Math.max(0, (Number.isFinite(s.cap) && s.cap > 0 ? s.cap : defaultCap()) - Number(s.usedToday || 0)),
    resetAtUtc: s.resetAtUtc,
    updatedAt: s.updatedAt,
  };
}

/**
 * Public: convenience to just get remaining credits.
 */
export async function getRemainingCredits() {
  const st = await getBudgetState();
  return st.remaining;
}

/**
 * Plan a patch run given a list of cardIds that currently lack latest prices.
 * We allocate up to remaining credits (soft cap) and return a call plan.
 *
 * @param {{ gaps:string[], maxBatch?:number }} opts
 * @returns {{ callPlan:Array<{cardId:string, by:'id', cost:number}>, budget:number, willUse:number }}
 */
export async function planPatch({ gaps = [], maxBatch = 100 } = {}) {
  const uniq = Array.from(new Set((Array.isArray(gaps) ? gaps : []).map(String).filter(Boolean)));
  if (uniq.length === 0) {
    return { callPlan: [], budget: 0, willUse: 0 };
  }

  const { remaining } = await getBudgetState();
  if (remaining <= 0) {
    return { callPlan: [], budget: 0, willUse: 0 };
  }

  const per = costPerCard();
  const maxByBudget = Math.max(0, Math.floor(remaining / per));
  const limit = Math.max(0, Math.min(uniq.length, maxBatch, maxByBudget));

  const callPlan = uniq.slice(0, limit).map(cardId => ({
    cardId,
    by: 'id',
    cost: per,
  }));

  return { callPlan, budget: remaining, willUse: callPlan.length * per };
}

/**
 * After executing a PPT patch call, record usage.
 * Accepts either a numeric cost or an array of planned calls.
 */
export async function commitUsage(costOrPlan) {
  const s = await readState();
  if (needsReset(s)) {
    s.resetAtUtc = todayUtcMidnightIso();
    s.usedToday = 0;
    s.cap = Number.isFinite(s.cap) && s.cap > 0 ? s.cap : defaultCap();
  }

  let delta = 0;
  if (Array.isArray(costOrPlan)) {
    delta = costOrPlan.reduce((sum, c) => sum + (Number(c.cost) || 0), 0);
  } else {
    delta = Number(costOrPlan) || 0;
  }

  s.usedToday = Math.max(0, Number(s.usedToday || 0) + delta);
  await writeState(s);

  return {
    ok: true,
    usedToday: s.usedToday,
    cap: s.cap,
    remaining: Math.max(0, s.cap - s.usedToday),
    resetAtUtc: s.resetAtUtc,
    updatedAt: s.updatedAt,
  };
}

/**
 * Optional admin helper: override today's cap (e.g., via a POST toggle).
 */
export async function setDailySoftCap(newCap) {
  const n = Math.floor(Number(newCap) || 0);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Invalid cap');
  }
  const s = await readState();
  s.cap = n;
  await writeState(s);
  return { ok: true, cap: s.cap, usedToday: s.usedToday, remaining: Math.max(0, s.cap - s.usedToday), resetAtUtc: s.resetAtUtc, updatedAt: s.updatedAt };
}

export default {
  getBudgetState,
  getRemainingCredits,
  planPatch,
  commitUsage,
  setDailySoftCap,
};
