// src/modules/cardsearch/services/rollup.service.js
// Compute 1/7/30/90 day aggregates directly from m_PriceObservation.
// No schema changes required on m_price_rollups – results are computed on demand.

import { Op } from "sequelize";
import { m_Card, m_CardVariant, m_PriceObservation } from "../../../models/index.js";

const DEFAULT_WINDOWS = [1, 7, 30, 90];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isoDay(input) {
  if (!input) return null;
  const m = String(input).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function normalizeWindows(value) {
  if (!value) return DEFAULT_WINDOWS;
  const arr = Array.isArray(value) ? value : [value];
  const parsed = arr
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n > 0)
    .map((n) => (n > 365 ? 365 : n));
  const unique = Array.from(new Set(parsed));
  return unique.length ? unique.sort((a, b) => a - b) : DEFAULT_WINDOWS;
}

function initWindowCounts(windows) {
  const out = {};
  for (const w of windows) out[String(w)] = 0;
  return out;
}

function bumpWindowCounts(counts, rows) {
  if (!rows) return;
  for (const r of rows) {
    if (!r || r.count === 0) continue;
    const key = String(r.window);
    if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += 1;
  }
}

function mergeWindowCounts(target, source) {
  if (!source) return;
  for (const [key, value] of Object.entries(source)) {
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      target[key] += value || 0;
    }
  }
}

function windowBounds(asOf, days) {
  const end = asOf;
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  const start = d.toISOString().slice(0, 10);
  return { start, end };
}

function safeNum(x) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

function emptyRollup(card_id, variant, window, bounds) {
  return {
    card_id,
    variant,
    window,
    days: window,
    startDate: bounds.start,
    endDate: bounds.end,
    count: 0,
    min: null,
    max: null,
    avg: null,
    change: null,
    changePct: null,
    latest: null,
  };
}

async function aggregateWindow(cardId, variant, start, end) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);

  const rows = await m_PriceObservation.findAll({
    where: {
      card_id: cardId,
      variant,
      observed_at: {
        [Op.gte]: startDate,
        [Op.lt]: endDate,
      },
    },
    attributes: ["amount_gbp", "observed_at"],
    order: [["observed_at", "ASC"]],
    raw: true,
  });

  if (!rows.length) return null;

  const byDay = new Map();
  for (const row of rows) {
    const whenRaw = row.observed_at ? new Date(row.observed_at) : null;
    if (!whenRaw || Number.isNaN(whenRaw.getTime())) continue;
    const dayKey = whenRaw.toISOString().slice(0, 10);
    const amount = safeNum(row.amount_gbp);
    if (amount == null) continue;

    const existing = byDay.get(dayKey);
    if (!existing || new Date(existing.observed_at).getTime() <= whenRaw.getTime()) {
      byDay.set(dayKey, { observed_at: whenRaw.toISOString(), amount });
    }
  }

  if (!byDay.size) return null;

  const daily = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const prices = daily.map(([, { amount }]) => amount).filter((v) => v != null);
  if (!prices.length) return null;

  const count = prices.length;
  const sum = prices.reduce((acc, value) => acc + value, 0);
  const min = prices.reduce((acc, value) => (value < acc ? value : acc), prices[0]);
  const max = prices.reduce((acc, value) => (value > acc ? value : acc), prices[0]);
  const avg = sum / count;
  const first = prices[0];
  const last = prices[prices.length - 1];
  const change = last - first;
  const changePct = first && first !== 0 ? (change / first) * 100 : null;
  const latestDay = daily[daily.length - 1][0];

  return {
    count,
    min: safeNum(min),
    max: safeNum(max),
    avg: safeNum(avg),
    change: safeNum(change),
    changePct: changePct == null ? null : safeNum(changePct),
    latestDate: latestDay,
    latest: safeNum(last),
  };
}

async function computeRollupRows(cardId, variant, windows, asOf) {
  const out = [];
  for (const w of windows) {
    const bounds = windowBounds(asOf, w);
    const agg = await aggregateWindow(cardId, variant, bounds.start, bounds.end);
    if (!agg) {
      out.push(emptyRollup(cardId, variant, w, bounds));
      continue;
    }
    out.push({
      card_id: cardId,
      variant,
      window: w,
      days: w,
      startDate: bounds.start,
      endDate: bounds.end,
      count: agg.count,
      min: agg.min,
      max: agg.max,
      avg: agg.avg,
      change: agg.change,
      changePct: agg.changePct,
      latestDate: agg.latestDate,
      latest: agg.latest,
    });
  }
  return out;
}

export async function rebuildRollupsForVariant(cardId, variant, opts = {}) {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const asOf = isoDay(opts.asOf) || todayISO();
  const windows = normalizeWindows(opts.windows);
  const countsByWindow = initWindowCounts(windows);

  const rows = await computeRollupRows(cardId, variant, windows, asOf);
  bumpWindowCounts(countsByWindow, rows);

  return {
    ok: true,
    cardId,
    variant,
    windows,
    rows,
    byWindow: countsByWindow,
    startedAt,
    finishedAt: new Date().toISOString(),
    ms: Date.now() - started,
  };
}

export async function rebuildRollupsForCard(cardId, opts = {}) {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const asOf = isoDay(opts.asOf) || todayISO();
  const windows = normalizeWindows(opts.windows);
  const countsByWindow = initWindowCounts(windows);

  const vars = await m_CardVariant.findAll({
    where: { card_id: cardId },
    attributes: ["variant"],
  });
  const variants = Array.from(new Set(vars.map((v) => String(v.get("variant")).toLowerCase())));

  const results = [];
  for (const variant of variants) {
    const rows = await computeRollupRows(cardId, variant, windows, asOf);
    bumpWindowCounts(countsByWindow, rows);
    results.push({ variant, rows });
  }

  return {
    ok: true,
    cardId,
    variants: variants.length,
    windows,
    results,
    byWindow: countsByWindow,
    startedAt,
    finishedAt: new Date().toISOString(),
    ms: Date.now() - started,
  };
}

export async function rebuildRollupsForSet(setCode, opts = {}) {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const asOf = isoDay(opts.asOf) || todayISO();
  const windows = normalizeWindows(opts.windows);
  const countsByWindow = initWindowCounts(windows);
  const batchSize = Number.isInteger(opts.batchSize) ? Math.max(1, opts.batchSize) : 500;

  const cards = await m_Card.findAll({
    where: { set_code: setCode },
    attributes: ["id"],
    order: [["number", "ASC"]],
  });
  const ids = cards.map((c) => c.get("id"));

  const results = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    for (const cardId of chunk) {
      const cardRes = await rebuildRollupsForCard(cardId, { asOf, windows });
      mergeWindowCounts(countsByWindow, cardRes.byWindow);
      results.push(cardRes);
    }
  }

  return {
    ok: true,
    setCode,
    cards: ids.length,
    windows,
    results,
    byWindow: countsByWindow,
    startedAt,
    finishedAt: new Date().toISOString(),
    ms: Date.now() - started,
  };
}

export async function rebuildRollupsAll(opts = {}) {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const asOf = isoDay(opts.asOf) || todayISO();
  const windows = normalizeWindows(opts.windows);
  const countsByWindow = initWindowCounts(windows);
  const batchSize = Number.isInteger(opts.batchSize) ? Math.max(1, opts.batchSize) : 2000;

  const vars = await m_PriceObservation.findAll({
    attributes: [["card_id", "card_id"], ["variant", "variant"]],
    group: ["card_id", "variant"],
    raw: true,
  });

  const pairs = vars.map((row) => ({ card_id: row.card_id, variant: String(row.variant).toLowerCase() }));
  const results = [];
  for (let i = 0; i < pairs.length; i += batchSize) {
    const chunk = pairs.slice(i, i + batchSize);
    for (const { card_id, variant } of chunk) {
      const res = await rebuildRollupsForVariant(card_id, variant, { asOf, windows });
      mergeWindowCounts(countsByWindow, res.byWindow);
      results.push(res);
    }
  }

  return {
    ok: true,
    pairs: pairs.length,
    windows,
    results,
    byWindow: countsByWindow,
    startedAt,
    finishedAt: new Date().toISOString(),
    ms: Date.now() - started,
  };
}

export async function computeRollupsSnapshot(cardId, variant, opts = {}) {
  const res = await rebuildRollupsForVariant(cardId, variant, opts);
  return res.rows;
}

export default {
  rebuildRollupsForVariant,
  rebuildRollupsForCard,
  rebuildRollupsForSet,
  rebuildRollupsAll,
  computeRollupsSnapshot,
};
