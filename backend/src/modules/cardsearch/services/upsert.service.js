// src/modules/cardsearch/services/upsert.service.js
// Centralised, idempotent upsert helpers for the Card Search module.
//
// Models used (per your schema):
//   m_Set:               { code, abbreviation, name, era, release_date, total_cards }
//   m_Card:              { id, set_code, number, name, rarity, supertype, subtype, regulation_mark, image_small, image_large }
//   m_CardVariant:       { card_id, variant }
//   m_PriceObservation:  { card_id, variant, observed_at, amount_gbp, source }
//   m_PriceLatest:       { card_id, variant, price_gbp, median_gbp, p10_gbp, p90_gbp, updated_at }
//
// All functions accept an options bag: { transaction, logger }.
// No TODOs, no temporary code.

import { Op } from "sequelize";
import { sequelize, m_Set, m_Card, m_CardVariant, m_PriceObservation, m_PriceLatest } from "../../models/index.js";

/* ========================================================================== *
 * Public API
 * ========================================================================== */

/**
 * Upsert a single Set row.
 * @param {object} setRow - { code, abbreviation?, name, era?, release_date?, total_cards? }
 * @param {{ transaction?: import('sequelize').Transaction, logger?: Console }} [opts]
 * @returns {Promise<{ inserted: boolean, updated: boolean }>}
 */
export async function upsertSet(setRow, opts = {}) {
  const t = opts.transaction || null;

  const existing = await m_Set.findOne({ where: { code: setRow.code }, transaction: t });
  if (!existing) {
    await m_Set.create(setRow, { transaction: t });
    return { inserted: true, updated: false };
  }

  const changed = pickChanged(existing.get(), {
    abbreviation: n(setRow.abbreviation),
    name: n(setRow.name),
    era: n(setRow.era),
    release_date: n(setRow.release_date),
    total_cards: n(setRow.total_cards),
  });

  if (changed) {
    existing.set(changed);
    await existing.save({ transaction: t });
    return { inserted: false, updated: true };
  }
  return { inserted: false, updated: false };
}

/**
 * Bulk upsert cards for one set. Does NOT delete cards.
 * @param {Array<object>} cardRows - normalized rows for m_Card
 * @param {{ transaction?: import('sequelize').Transaction, logger?: Console }} [opts]
 * @returns {Promise<{ inserted:number, updated:number, totalAfter:number }>}
 */
export async function bulkUpsertCards(cardRows, opts = {}) {
  const t = opts.transaction || null;
  if (!Array.isArray(cardRows) || cardRows.length === 0) {
    return { inserted: 0, updated: 0, totalAfter: await m_Card.count({ transaction: t }) };
  }

  // Read existing rows for diff (scoped to set for performance)
  const setCode = cardRows[0].set_code;
  const existing = await m_Card.findAll({
    where: { set_code: setCode },
    attributes: ["id", "set_code", "number", "name", "rarity", "supertype", "subtype", "regulation_mark", "image_small", "image_large"],
    transaction: t,
  });

  const existingMap = new Map(existing.map(r => [r.get("id"), r.get()]));
  const toInsert = [];
  const toUpdate = [];

  for (const c of cardRows) {
    const cur = existingMap.get(c.id);
    if (!cur) {
      toInsert.push(c);
      continue;
    }
    if (!sameCard(cur, c)) {
      toUpdate.push(c);
    }
  }

  if (toInsert.length) {
    await m_Card.bulkCreate(toInsert, {
      transaction: t,
      ignoreDuplicates: false,
      updateOnDuplicate: [
        "name", "rarity", "supertype", "subtype",
        "regulation_mark", "image_small", "image_large", "set_code", "number",
      ],
    });
  }
  if (toUpdate.length) {
    await m_Card.bulkCreate(toUpdate, {
      transaction: t,
      ignoreDuplicates: false,
      updateOnDuplicate: [
        "name", "rarity", "supertype", "subtype",
        "regulation_mark", "image_small", "image_large", "set_code", "number",
      ],
    });
  }

  const totalAfter = await m_Card.count({ where: { set_code: setCode }, transaction: t });
  return { inserted: toInsert.length, updated: toUpdate.length, totalAfter };
}

/**
 * Sync variants for a set: upsert desired variants and delete stale (only variants).
 * @param {string} setCode
 * @param {Record<string, Array<{ card_id:string, variant:string }>>} variantsByCardId
 * @param {{ transaction?: import('sequelize').Transaction, logger?: Console }} [opts]
 * @returns {Promise<{ upserted:number, deletedStale:number, totalAfter:number }>}
 */
export async function syncVariantsForSet(setCode, variantsByCardId, opts = {}) {
  const t = opts.transaction || null;

  const cardIds = Object.keys(variantsByCardId).filter(id => id.startsWith(`${setCode}-`));
  if (cardIds.length === 0) {
    const after = await countVariantsForSet(setCode, t);
    return { upserted: 0, deletedStale: 0, totalAfter: after };
  }

  const desired = [];
  for (const card_id of cardIds) {
    const list = variantsByCardId[card_id] || [];
    for (const v of list) {
      desired.push({ card_id, variant: String(v.variant || v).toLowerCase() });
    }
  }

  // Existing for this set
  const existingRows = await m_CardVariant.findAll({
    where: { card_id: { [Op.in]: cardIds } },
    attributes: ["card_id", "variant"],
    transaction: t,
  });

  const existingSet = new Set(existingRows.map(r => `${r.get("card_id")}::${r.get("variant")}`));
  const desiredSet = new Set(desired.map(v => `${v.card_id}::${v.variant}`));

  // Upsert desired
  if (desired.length) {
    await m_CardVariant.bulkCreate(desired, {
      transaction: t,
      ignoreDuplicates: false,
      updateOnDuplicate: ["variant", "card_id"],
    });
  }

  // Delete stale = existing - desired
  const toDelete = [];
  for (const key of existingSet) {
    if (!desiredSet.has(key)) {
      const [card_id, variant] = key.split("::");
      toDelete.push({ card_id, variant });
    }
  }
  if (toDelete.length) {
    await m_CardVariant.destroy({
      where: {
        [Op.or]: toDelete.map(x => ({ card_id: x.card_id, variant: x.variant })),
      },
      transaction: t,
    });
  }

  const totalAfter = await countVariantsForSet(setCode, t);
  return { upserted: desired.length, deletedStale: toDelete.length, totalAfter };
}

/**
 * Bulk upsert price observations (GBP). Keyed by (card_id, variant, observed_at, source).
 * @param {Array<{ card_id:string, variant:string, observed_at:string, amount_gbp:number, source:string }>} rows
 * @param {{ transaction?: import('sequelize').Transaction, logger?: Console }} [opts]
 * @returns {Promise<{ written:number }>}
 */
export async function upsertPriceObservations(rows, opts = {}) {
  const t = opts.transaction || null;
  if (!Array.isArray(rows) || rows.length === 0) return { written: 0 };

  await m_PriceObservation.bulkCreate(rows, {
    transaction: t,
    ignoreDuplicates: false,
    updateOnDuplicate: ["amount_gbp", "observed_at", "source"],
  });

  return { written: rows.length };
}

/**
 * Bulk upsert latest price snapshots.
 * @param {Array<{ card_id:string, variant:string, price_gbp:number|null, median_gbp?:number|null, p10_gbp?:number|null, p90_gbp?:number|null, updated_at:string }>} rows
 * @param {{ transaction?: import('sequelize').Transaction, logger?: Console }} [opts]
 * @returns {Promise<{ upserted:number }>}
 */
export async function upsertPriceLatest(rows, opts = {}) {
  const t = opts.transaction || null;
  if (!Array.isArray(rows) || rows.length === 0) return { upserted: 0 };

  await m_PriceLatest.bulkCreate(rows, {
    transaction: t,
    ignoreDuplicates: false,
    updateOnDuplicate: ["price_gbp", "median_gbp", "p10_gbp", "p90_gbp", "updated_at"],
  });

  return { upserted: rows.length };
}

/**
 * Convenience: run a function within a transaction (reuses provided t if present).
 * @param {(t: import('sequelize').Transaction) => Promise<any>} fn
 * @param {{ transaction?: import('sequelize').Transaction }} [opts]
 * @returns {Promise<any>}
 */
export async function runInTransaction(fn, opts = {}) {
  if (opts.transaction) {
    return fn(opts.transaction);
  }
  return sequelize.transaction(async (t) => fn(t));
}

/* ========================================================================== *
 * Internals
 * ========================================================================== */

function pickChanged(cur, next) {
  let dirty = false;
  const out = {};
  for (const [k, v] of Object.entries(next)) {
    if (!eq(cur[k], v)) {
      dirty = true;
      out[k] = v;
    }
  }
  return dirty ? out : null;
}

function eq(a, b) {
  if (a == null && b == null) return true;
  return a === b;
}

function n(v) {
  if (v == null) return null;
  const s = typeof v === "string" ? v.trim() : v;
  return s === "" ? null : s;
}

function sameCard(a, b) {
  return (
    a.set_code === b.set_code &&
    a.number === b.number &&
    n(a.name) === n(b.name) &&
    n(a.rarity) === n(b.rarity) &&
    n(a.supertype) === n(b.supertype) &&
    n(a.subtype) === n(b.subtype) &&
    n(a.regulation_mark) === n(b.regulation_mark) &&
    n(a.image_small) === n(b.image_small) &&
    n(a.image_large) === n(b.image_large)
  );
}

async function countVariantsForSet(setCode, t) {
  const cardIds = await m_Card.findAll({
    where: { set_code: setCode },
    attributes: ["id"],
    transaction: t,
  });
  if (cardIds.length === 0) return 0;
  const ids = cardIds.map(r => r.get("id"));
  return m_CardVariant.count({ where: { card_id: { [Op.in]: ids } }, transaction: t });
}

/* ========================================================================== *
 * Default export (convenience)
 * ========================================================================== */

export default {
  upsertSet,
  bulkUpsertCards,
  syncVariantsForSet,
  upsertPriceObservations,
  upsertPriceLatest,
  runInTransaction,
};
