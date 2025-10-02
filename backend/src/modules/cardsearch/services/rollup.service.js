// src/modules/cardsearch/services/rollup.service.js
// Price rollup service: compute 1/7/30/90 day aggregates from m_PriceObservation
// and upsert into m_PriceRollup.
//
// Windows: 1, 7, 30, 90 days (inclusive of `asOf`)
// Aggregates per (card_id, variant):
//   - count, min, max, avg
//   - change (last - first), change_pct
//   - latest_* snapshot (date + mid/high/low/market; here we fill latest_mid and leave others null)
// Schema assumptions (based on your models):
//   m_PriceObservation: { card_id, variant, observed_at (timestamptz) OR date (date), amount_gbp }
//   m_PriceRollup:      { card_id, variant, window, start_date, end_date, count, min, max, avg,
//                         change, change_pct, latest_date, latest_mid, latest_low, latest_high,
//                         latest_market, updated_at }
//
// Notes:
// - We treat the "price" as a single GBP value per day (amount_gbp). If you later store low/mid/high,
//   you can extend the query to roll those independently, then set latest_low/high/market accordingly.
// - This file uses Postgres-friendly SQL (DATE/::date). If you need cross-DB support, we can add
//   dialect checks and swap casts as needed.

import { Op, QueryTypes } from "sequelize";
import { sequelize, m_Card, m_CardVariant, m_PriceObservation, m_PriceRollup } from "../../../models/index.js";

/* ========================================================================== *
 * Public API
 * ========================================================================== */

/**
 * Rebuild rollups for a single (card_id, variant).
 * @param {string} cardId
 * @param {string} variant   normalized variant key (e.g., 'normal', 'reverse', 'holo', ...)
 * @param {{ asOf?: string }} [opts]  ISO date 'YYYY-MM-DD' (defaults to today UTC)
 * @returns {Promise<{ ok: boolean, upserted: number, windows: number[], ms: number }>}
 */
export async function rebuildRollupsForVariant(cardId, variant, opts = {}) {
  const started = Date.now();
  const asOf = isoDay(opts.asOf) || todayISO();
  const windows = [1, 7, 30, 90];

  const rows = await computeRollupRows(cardId, variant, windows, asOf);
  await upsertRollupRows(rows);

  return { ok: true, upserted: rows.length, windows, ms: Date.now() - started };
}

/**
 * Rebuild rollups for *all* variants of a single card.
 * @param {string} cardId
 * @param {{ asOf?: string }} [opts]
 */
export async function rebuildRollupsForCard(cardId, opts = {}) {
  const started = Date.now();
  const asOf = isoDay(opts.asOf) || todayISO();
  const windows = [1, 7, 30, 90];

  // Find all variants for this card
  const vars = await m_CardVariant.findAll({
    where: { card_id: cardId },
    attributes: ["variant"],
  });
  const variants = Array.from(new Set(vars.map(v => String(v.get("variant")).toLowerCase())));

  let upserted = 0;
  for (const v of variants) {
    const rows = await computeRollupRows(cardId, v, windows, asOf);
    if (rows.length) {
      await upsertRollupRows(rows);
      upserted += rows.length;
    }
  }
  return { ok: true, upserted, variants: variants.length, ms: Date.now() - started };
}

/**
 * Rebuild rollups for every card in a set (all variants).
 * @param {string} setCode   tcgdex set code (e.g., 'sv08')
 * @param {{ asOf?: string, batchSize?: number }} [opts]
 */
export async function rebuildRollupsForSet(setCode, opts = {}) {
  const started = Date.now();
  const asOf = isoDay(opts.asOf) || todayISO();
  const batchSize = Number.isInteger(opts.batchSize) ? Math.max(1, opts.batchSize) : 500;

  // Get all card IDs for the set
  const cards = await m_Card.findAll({
    where: { set_code: setCode },
    attributes: ["id"],
    order: [["number", "ASC"]],
  });
  const ids = cards.map(c => c.get("id"));
  let upserted = 0;

  // Process in batches to keep memory and SQL manageable
  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const varRows = await m_CardVariant.findAll({
      where: { card_id: { [Op.in]: chunk } },
      attributes: ["card_id", "variant"],
    });

    // Group variants per card and compute
    const byCard = new Map();
    for (const r of varRows) {
      const card_id = r.get("card_id");
      const variant = String(r.get("variant")).toLowerCase();
      (byCard.get(card_id) || byCard.set(card_id, [])).push(variant);
    }

    // Compute + upsert
    const windows = [1, 7, 30, 90];
    const toWrite = [];
    for (const [cardId, variants] of byCard.entries()) {
      for (const v of variants) {
        const rows = await computeRollupRows(cardId, v, windows, asOf);
        toWrite.push(...rows);
      }
    }
    if (toWrite.length) {
      await upsertRollupRows(toWrite);
      upserted += toWrite.length;
    }
  }

  return { ok: true, upserted, cards: ids.length, ms: Date.now() - started };
}

/**
 * Rebuild rollups for every observed (card_id, variant).
 * @param {{ asOf?: string, batchSize?: number }} [opts]
 */
export async function rebuildRollupsAll(opts = {}) {
  const started = Date.now();
  const asOf = isoDay(opts.asOf) || todayISO();
  const batchSize = Number.isInteger(opts.batchSize) ? Math.max(1, opts.batchSize) : 2000;

  // Get distinct keys that have observations (faster than walking all variants)
  const keys = await distinctObservedKeys();
  let upserted = 0;

  for (let i = 0; i < keys.length; i += batchSize) {
    const chunk = keys.slice(i, i + batchSize);
    const windows = [1, 7, 30, 90];
    const toWrite = [];

    for (const { card_id, variant } of chunk) {
      const rows = await computeRollupRows(card_id, variant, windows, asOf);
      toWrite.push(...rows);
    }

    if (toWrite.length) {
      await upsertRollupRows(toWrite);
      upserted += toWrite.length;
    }
  }

  return { ok: true, upserted, pairs: keys.length, ms: Date.now() - started };
}

/* ========================================================================== *
 * Core computation
 * ========================================================================== */

/**
 * Compute rollup rows for a single (card_id, variant) over given day windows.
 * @param {string} cardId
 * @param {string} variant
 * @param {number[]} windows
 * @param {string} asOf    YYYY-MM-DD inclusive end date
 * @returns {Promise<Array<any>>}
 */
async function computeRollupRows(cardId, variant, windows, asOf) {
  // We compute per-window so we can calculate change from first->last within the window.
  const out = [];
  for (const w of windows) {
    const { start, end } = windowBounds(asOf, w);
    const agg = await aggregateWindow(cardId, variant, start, end);
    if (!agg) {
      // No data in this window; we still upsert a zero-count row so resolvers can show empty
      out.push(emptyRow(cardId, variant, w, start, end));
      continue;
    }
    out.push({
      card_id: cardId,
      variant,
      window: String(w),
      start_date: start,
      end_date: end,
      count: agg.count,
      min: agg.min,
      max: agg.max,
      avg: agg.avg,
      change: agg.change,
      change_pct: agg.change_pct,
      latest_date: agg.latest_date,
      latest_mid: agg.latest,          // store into *_mid; resolvers read latest_mid
      latest_low: null,
      latest_high: null,
      latest_market: null,
      updated_at: new Date().toISOString(),
    });
  }
  return out;
}

/**
 * Aggregate a single window for (card, variant) between [start, end] inclusive.
 * Returns null if no observations in range.
 */
async function aggregateWindow(cardId, variant, start, end) {
  // We calculate per-day representative price by taking the last observation of that day,
  // then aggregate across days to avoid overweighting days with many entries.
  //
  // Steps (Postgres-friendly SQL):
  // 1) Base rows filtered by card/variant and day in [start,end].
  // 2) For each day, pick the latest observation (max observed_at or by PK order).
  // 3) Aggregate across those per-day prices.

  const sql = `
    WITH base AS (
      SELECT
        card_id,
        variant,
        COALESCE(date, (observed_at AT TIME ZONE 'UTC')::date) AS day,
        amount_gbp,
        observed_at
      FROM ${m_PriceObservation.getTableName()}
      WHERE card_id = :card_id
        AND variant = :variant
        AND COALESCE(date, (observed_at AT TIME ZONE 'UTC')::date) BETWEEN :start::date AND :end::date
    ),
    day_last AS (
      SELECT DISTINCT ON (day)
        day,
        amount_gbp,
        observed_at
      FROM base
      ORDER BY day, observed_at DESC NULLS LAST
    ),
    agg AS (
      SELECT
        COUNT(*)::int AS count,
        MIN(amount_gbp) AS min,
        MAX(amount_gbp) AS max,
        AVG(amount_gbp) AS avg
      FROM day_last
    ),
    ends AS (
      SELECT
        (SELECT amount_gbp FROM day_last ORDER BY day ASC  LIMIT 1) AS first_price,
        (SELECT amount_gbp FROM day_last ORDER BY day DESC LIMIT 1) AS last_price,
        (SELECT day         FROM day_last ORDER BY day DESC LIMIT 1) AS last_day
    )
    SELECT
      agg.count,
      agg.min,
      agg.max,
      agg.avg,
      (ends.last_price - ends.first_price)            AS change,
      CASE
        WHEN ends.first_price IS NULL OR ends.first_price = 0 THEN NULL
        ELSE ((ends.last_price - ends.first_price) / ends.first_price) * 100.0
      END                                             AS change_pct,
      ends.last_day                                   AS latest_date,
      ends.last_price                                 AS latest
    FROM agg, ends;
  `;

  /** @type {Array<{count:number|null,min:number|null,max:number|null,avg:number|null,change:number|null,change_pct:number|null, latest_date:string|null, latest:number|null}>} */
  const rows = await sequelize.query(sql, {
    replacements: { card_id: cardId, variant, start, end },
    type: QueryTypes.SELECT,
  });

  const r = rows[0];
  if (!r || !Number.isFinite(r.count) || r.count === 0) return null;

  return {
    count: r.count | 0,
    min: safeNum(r.min),
    max: safeNum(r.max),
    avg: safeNum(r.avg),
    change: safeNum(r.change),
    change_pct: safeNum(r.change_pct),
    latest_date: r.latest_date ? String(r.latest_date) : end,
    latest: safeNum(r.latest),
  };
}

/* ========================================================================== *
 * Writes
 * ========================================================================== */

/**
 * Bulk upsert rollup rows.
 * @param {Array<any>} rows
 */
async function upsertRollupRows(rows) {
  if (!rows || rows.length === 0) return;

  await m_PriceRollup.bulkCreate(rows, {
    ignoreDuplicates: false,
    updateOnDuplicate: [
      "start_date",
      "end_date",
      "count",
      "min",
      "max",
      "avg",
      "change",
      "change_pct",
      "latest_date",
      "latest_mid",
      "latest_low",
      "latest_high",
      "latest_market",
      "updated_at",
    ],
  });
}

/* ========================================================================== *
 * Utilities
 * ========================================================================== */

function emptyRow(card_id, variant, w, start, end) {
  return {
    card_id,
    variant,
    window: String(w),
    start_date: start,
    end_date: end,
    count: 0,
    min: null,
    max: null,
    avg: null,
    change: null,
    change_pct: null,
    latest_date: null,
    latest_mid: null,
    latest_low: null,
    latest_high: null,
    latest_market: null,
    updated_at: new Date().toISOString(),
  };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isoDay(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function windowBounds(asOf, days) {
  // inclusive window ending at asOf; start = asOf - (days-1)
  const end = asOf;
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  const start = d.toISOString().slice(0, 10);
  return { start, end };
}

async function distinctObservedKeys() {
  // Use raw SQL for speed; fallback to Sequelize findAll if needed.
  const sql = `
    SELECT DISTINCT card_id, variant
    FROM ${m_PriceObservation.getTableName()}
  `;
  /** @type {Array<{card_id:string, variant:string}>} */
  const rows = await sequelize.query(sql, { type: QueryTypes.SELECT });
  return rows.map(r => ({ card_id: r.card_id, variant: String(r.variant).toLowerCase() }));
}

function safeNum(x) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

/* ========================================================================== *
 * Default export
 * ========================================================================== */

export default {
  rebuildRollupsForVariant,
  rebuildRollupsForCard,
  rebuildRollupsForSet,
  rebuildRollupsAll,
};
