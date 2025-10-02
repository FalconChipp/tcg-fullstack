// src/modules/marketdata2/services/rollup.service.js
// CHANGED: New service used by priceRollup.job.js. Computes rolling aggregates
// (1/7/30/90 days) from m_price_observations into m_price_rollups.

import { sequelize } from '../../../models/index.js';

const WINDOWS = [1, 7, 30, 90];

function isoNow() { return new Date().toISOString(); }

/**
 * Upsert aggregates for a given window size.
 * - We first reduce to the *last* observation per (card_id, variant, observed_day) inside the window,
 *   then aggregate those day-level values.
 */
async function upsertRollupsForWindow(days, whereSql, replacements) {
  const sql = `
    INSERT INTO m_price_rollups
      (card_id, variant, days, avg_gbp, min_gbp, max_gbp, last_gbp, computed_at)
    SELECT
      t.card_id,
      t.variant,
      :days AS days,
      AVG(t.price_gbp) AS avg_gbp,
      MIN(t.price_gbp) AS min_gbp,
      MAX(t.price_gbp) AS max_gbp,
      SUBSTRING_INDEX(
        SUBSTRING_INDEX(
          GROUP_CONCAT(CONCAT(t.observed_at_ms, ':', COALESCE(t.price_gbp, 0)) ORDER BY t.observed_at_ms DESC SEPARATOR '|'),
          '|', 1
        ),
        ':', -1
      ) + 0 AS last_gbp,
      UTC_TIMESTAMP() AS computed_at
    FROM (
      SELECT o.card_id, o.variant, o.price_gbp,
             UNIX_TIMESTAMP(o.observed_at) * 1000 AS observed_at_ms,
             o.observed_day
      FROM m_price_observations o
      JOIN (
        SELECT card_id, variant, observed_day, MAX(observed_at) AS last_ts
        FROM m_price_observations
        WHERE observed_at >= (UTC_TIMESTAMP() - INTERVAL :days DAY) ${whereSql ? `AND (${whereSql})` : ''}
        GROUP BY card_id, variant, observed_day
      ) x
      ON o.card_id = x.card_id AND o.variant = x.variant AND o.observed_day = x.observed_day AND o.observed_at = x.last_ts
    ) t
    GROUP BY t.card_id, t.variant
    ON DUPLICATE KEY UPDATE
      avg_gbp     = VALUES(avg_gbp),
      min_gbp     = VALUES(min_gbp),
      max_gbp     = VALUES(max_gbp),
      last_gbp    = VALUES(last_gbp),
      computed_at = VALUES(computed_at)
  `;
  const [res] = await sequelize.query(sql, { replacements: { ...replacements, days } });
  return res?.affectedRows || 0;
}

/** Rollups limited to a single set (card_id LIKE 'sv08-%', etc.) */
export async function computeRollupsForSet({ setCode, windows = WINDOWS } = {}) {
  if (!setCode) throw new Error('computeRollupsForSet: setCode required');
  const whereSql = 'o.card_id LIKE :prefix';
  const replacements = { prefix: `${setCode}-%` };
  let total = 0;
  const byWindow = {};
  for (const w of windows) {
    const n = await upsertRollupsForWindow(w, whereSql, replacements);
    byWindow[w] = n; total += n;
  }
  const now = isoNow();
  return { ok: true, updatedRows: total, byWindow, startedAt: now, finishedAt: now, setCode };
}

/** Rollups across all sets that have observations */
export async function computeRollupsAll({ windows = WINDOWS } = {}) {
  let total = 0;
  const byWindow = {};
  for (const w of windows) {
    const n = await upsertRollupsForWindow(w, null, {});
    byWindow[w] = n; total += n;
  }
  const now = isoNow();
  return { ok: true, updatedRows: total, byWindow, startedAt: now, finishedAt: now };
}

export default { computeRollupsForSet, computeRollupsAll };
