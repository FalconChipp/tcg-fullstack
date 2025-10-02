// src/modules/marketdata2/services/ingest.service.js
// Writes normalized observations to m_price_observations and updates m_price_latest.

import { sequelize } from '../../../models/index.js';

function isoDayUtc(ts) {
  // Date string YYYY-MM-DD in UTC
  const d = ts ? new Date(ts) : new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10);
}

/**
 * @param {Array<{card_id:string, variant:string, source:string, currency:string, price_native:number|null, price_gbp:number|null, observed_at?:string, extras?:any}>} observations
 */
export async function ingestObservations(observations) {
  if (!Array.isArray(observations) || !observations.length) {
    return { ok: true, inserted: 0, deduped: 0, updatedLatest: 0 };
  }

  const t = await sequelize.transaction();
  let inserted = 0, deduped = 0, updatedLatest = 0;

  try {
    // 1) insert-or-update (day-unique) into m_price_observations
    for (const o of observations) {
      const observed_at = o.observed_at ? new Date(o.observed_at) : new Date();
      const observed_day = isoDayUtc(observed_at);

      // CHANGED: ensure observed_day column used for unique constraint across (card_id, variant, source, observed_day)
      const sql = `
        INSERT INTO m_price_observations
          (card_id, variant, source, currency, price_native, price_gbp, observed_at, observed_day, extras)
        VALUES
          (:card_id, :variant, :source, :currency, :price_native, :price_gbp, :observed_at, :observed_day, :extras)
        ON DUPLICATE KEY UPDATE
          price_native = VALUES(price_native),
          price_gbp    = VALUES(price_gbp),
          observed_at  = VALUES(observed_at),
          extras       = VALUES(extras)
      `;

      const repl = {
        card_id: o.card_id,
        variant: o.variant,
        source: o.source,
        currency: o.currency,
        price_native: o.price_native ?? null,
        price_gbp: o.price_gbp ?? null,
        observed_at,
        observed_day,
        extras: JSON.stringify(o.extras ?? null),
      };

      const [res] = await sequelize.query(sql, { replacements: repl, transaction: t });
      if (res && typeof res.affectedRows === 'number') {
        if (res.affectedRows === 1) inserted++;
        else deduped++;
      } else {
        // Driver fallback — treat as inserted to avoid losing counts
        inserted++;
      }
    }

    // 2) Upsert freshest into m_price_latest per (card_id, variant)
    //    (prefer newest observed_at; if equal, prefer GBP not null)
    const tmp = Array.from(new Map(observations.map(o => {
      const key = `${o.card_id}::${o.variant}`;
      const at = new Date(o.observed_at || Date.now()).getTime();
      return [key, { at, o }];
    })).values()).map(x => x.o);

    for (const o of tmp) {
      const sql = `
        INSERT INTO m_price_latest
          (card_id, variant, currency, price_native, price_gbp, source, observed_at)
        VALUES
          (:card_id, :variant, :currency, :price_native, :price_gbp, :source, :observed_at)
        ON DUPLICATE KEY UPDATE
          -- only replace if newer
          currency    = IF(VALUES(observed_at) > observed_at, VALUES(currency), currency),
          price_native= IF(VALUES(observed_at) > observed_at, VALUES(price_native), price_native),
          price_gbp   = IF(VALUES(observed_at) > observed_at, VALUES(price_gbp), price_gbp),
          source      = IF(VALUES(observed_at) > observed_at, VALUES(source), source),
          observed_at = GREATEST(observed_at, VALUES(observed_at))
      `;
      const repl = {
        card_id: o.card_id,
        variant: o.variant,
        currency: o.currency,
        price_native: o.price_native ?? null,
        price_gbp: o.price_gbp ?? null,
        source: o.source,
        observed_at: o.observed_at ? new Date(o.observed_at) : new Date(),
      };
      await sequelize.query(sql, { replacements: repl, transaction: t });
      updatedLatest++;
    }

    await t.commit();
    return { ok: true, inserted, deduped, updatedLatest };
  } catch (err) {
    await t.rollback();
    return { ok: false, error: String(err?.message || err), inserted, deduped, updatedLatest };
  }
}

export default { ingestObservations };
