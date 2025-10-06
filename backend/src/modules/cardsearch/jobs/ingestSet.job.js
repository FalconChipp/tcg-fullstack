// src/modules/cardsearch/jobs/ingestSet.job.js
// Ingest a single set from TCGdex into local DB (m_Set, m_Card, m_CardVariant).

import { Sequelize, Op } from "sequelize";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  sequelize,
  m_Set,
  m_Card,
  m_CardVariant,
} from "../../../models/index.js";
import {
  fetchSetAndCards,
  refreshSetAndCards,
} from "../adapters/setAdapter.tcgdex.service.js";
import {
  resolveSet,
  resolveToTcgdex,
} from "../services/setMapping.service.js";

/* ============================================================================ */

export async function ingestSet(opts) {
  const started = Date.now();
  const logger = opts?.logger ?? console;
  const refresh = !!opts?.refresh;
  const dryRun = !!opts?.dryRun;
  const input = String(opts?.input ?? "").trim();

  if (!input) throw new Error("ingestSet: 'input' is required.");

  const mapping =
    resolveSet(input) || { abbr: input.toUpperCase(), tcgdex: resolveToTcgdex(input) || input };
  const tcgdexCode = mapping.tcgdex;
  if (!tcgdexCode)
    throw new Error(
      `ingestSet: Unable to resolve to a TCGdex code from input='${input}'`
    );

  const fetched = refresh
    ? await refreshSetAndCards(tcgdexCode)
    : await fetchSetAndCards(tcgdexCode);

  const normSet = fetched.set;
  const normCards = fetched.cards;
  const variantsByCardId = fetched.variantsByCardId || {};
  const abbr = mapping.abbr || normSet.abbreviation || null;

  const result = {
    ok: true,
    setCode: normSet.code,
    abbr,
    counts: {
      cards: { scanned: normCards.length, inserted: 0, updated: 0, deleted: 0, totalAfter: 0 },
      variants: { upserted: 0, deletedStale: 0, totalAfter: 0 },
    },
    cache: fetched.cachePaths,
    ms: 0,
  };

  if (dryRun) {
    const { cardDiff, variantPlan } = await planDiffs(
      normSet.code,
      normCards,
      variantsByCardId
    );
    result.counts.cards.inserted = cardDiff.toInsert.length;
    result.counts.cards.updated = cardDiff.toUpdate.length;
    result.counts.cards.deleted = cardDiff.toDelete.length;
    result.counts.cards.totalAfter = cardDiff.afterCount;
    result.counts.variants.upserted = variantPlan.toUpsert.length;
    result.counts.variants.deletedStale = variantPlan.toDelete.length;
    result.counts.variants.totalAfter = variantPlan.afterCount;
    result.ms = Date.now() - started;
    logger.log(
      `[ingestSet DRY] ${normSet.code}: scanned=${normCards.length} inserted=${result.counts.cards.inserted} updated=${result.counts.cards.updated} variants+${result.counts.variants.upserted} variants-${result.counts.variants.deletedStale}`
    );
    return result;
  }

  await sequelize.transaction(async (t) => {
    await upsertSet(normSet, t);

    const cardDiff = await computeCardDiff(normSet.code, normCards, t);
    if (cardDiff.toDelete.length) {
      const deleteIds = cardDiff.toDelete;
      await m_CardVariant.destroy({
        where: { card_id: { [Op.in]: deleteIds } },
        transaction: t,
      });
      await m_Card.destroy({
        where: { id: { [Op.in]: deleteIds } },
        transaction: t,
      });
    }

    if (cardDiff.toInsert.length) {
      await m_Card.bulkCreate(cardDiff.toInsert, {
        transaction: t,
        ignoreDuplicates: false,
        updateOnDuplicate: [
          "name",
          "rarity",
          "supertype",
          "subtype",
          "regulation_mark",
          "image_small",
          "image_large",
          "set_code",
          "number",
        ],
      });
    }
    if (cardDiff.toUpdate.length) {
      await m_Card.bulkCreate(cardDiff.toUpdate, {
        transaction: t,
        ignoreDuplicates: false,
        updateOnDuplicate: [
          "name",
          "rarity",
          "supertype",
          "subtype",
          "regulation_mark",
          "image_small",
          "image_large",
          "set_code",
          "number",
        ],
      });
    }

    const variantPlan = await computeVariantPlan(
      normSet.code,
      variantsByCardId,
      t
    );

    if (variantPlan.toUpsert.length) {
      await m_CardVariant.bulkCreate(variantPlan.toUpsert, {
        transaction: t,
        ignoreDuplicates: false,
        updateOnDuplicate: ["variant", "card_id", "display_name"],
      });
    }

    if (variantPlan.toDelete.length) {
      const chunks = chunk(variantPlan.toDelete, 1000);
      for (const batch of chunks) {
        await m_CardVariant.destroy({
          where: {
            [Op.or]: batch.map(({ card_id, variant }) => ({ card_id, variant })),
          },
          transaction: t,
        });
      }
    }

    result.counts.cards.inserted = cardDiff.toInsert.length;
    result.counts.cards.updated = cardDiff.toUpdate.length;
    result.counts.cards.deleted = cardDiff.toDelete.length;
    result.counts.cards.totalAfter = cardDiff.afterCount;

    result.counts.variants.upserted = variantPlan.toUpsert.length;
    result.counts.variants.deletedStale = variantPlan.toDelete.length;
    result.counts.variants.totalAfter = variantPlan.afterCount;
  });

  result.ms = Date.now() - started;
  return result;
}

/* ============================================================================ */

function toStrAbbr(v) {
  if (v == null) return null;
  if (Array.isArray(v)) return v.join("/");
  if (typeof v === "object") {
    if (v.en) return String(v.en);
    const first = Object.values(v)[0];
    return first != null ? String(first) : null;
  }
  return String(v);
}

async function upsertSet(s, t) {
  const existing = await m_Set.findOne({
    where: { code: s.code },
    transaction: t,
  });
  if (!existing) {
    const toCreate = { ...s, abbreviation: toStrAbbr(s.abbreviation) };
    await m_Set.create(toCreate, { transaction: t });
    return;
  }

  const next = {
    abbreviation: toStrAbbr(s.abbreviation) ?? null,
    name: s.name ?? null,
    era: s.era ?? null,
    release_date: s.release_date ?? null,
    total_cards: s.total_cards ?? null,
    set_logo: s.set_logo ?? null,
    set_symbol: s.set_symbol ?? null,
    source_at: s.source_at ?? null,
    generator_version: s.generator_version ?? null,
  };

  const cur = existing.get();
  let dirty = false;
  for (const [k, v] of Object.entries(next)) {
    if ((cur[k] ?? null) !== v) {
      dirty = true;
      existing.set(k, v);
    }
  }
  if (dirty) await existing.save({ transaction: t });
}

async function planDiffs(setCode, cards, variantsByCardId) {
  const cardDiff = await computeCardDiff(setCode, cards, null);
  const variantPlan = await computeVariantPlan(setCode, variantsByCardId, null);
  return { cardDiff, variantPlan };
}

async function computeCardDiff(setCode, desiredCards, t) {
  const existingRows = await m_Card.findAll({
    where: { set_code: setCode },
    attributes: [
      "id",
      "set_code",
      "number",
      "name",
      "rarity",
      "supertype",
      "subtype",
      "regulation_mark",
      "image_small",
      "image_large",
    ],
    transaction: t,
  });

  const existingById = new Map(existingRows.map((r) => [r.get("id"), r.get()]));
  const toInsert = [];
  const toUpdate = [];
  const desiredIds = new Set();

  for (const c of desiredCards) {
    if (!c?.id) continue;
    desiredIds.add(c.id);
    const isExisting = existingById.get(c.id);
    if (!isExisting) {
      toInsert.push(c);
    } else if (!sameCard(isExisting, c)) {
      toUpdate.push(c);
    }
  }

  const toDelete = [];
  for (const id of existingById.keys()) {
    if (!desiredIds.has(id)) toDelete.push(id);
  }

  const allowDeletes = desiredIds.size > 0 || !existingRows.length;
  const effectiveDeletes = allowDeletes ? toDelete : [];
  const afterCount = existingRows.length - effectiveDeletes.length + toInsert.length;
  return { toInsert, toUpdate, toDelete: effectiveDeletes, afterCount };
}

async function computeVariantPlan(setCode, variantsByCardId, t) {
  const cardIds = Object.keys(variantsByCardId).filter((id) =>
    id.startsWith(`${setCode}-`)
  );
  if (cardIds.length === 0) {
    const afterCount = await countVariantsForSet(setCode, t);
    return { toUpsert: [], toDelete: [], afterCount };
  }

  const desired = [];
  for (const card_id of cardIds) {
    const list = variantsByCardId[card_id] || [];
    for (const v of list) {
      desired.push({
        card_id,
        variant: String(v.variant).trim().toLowerCase(),
        display_name: v.display_name ?? v.variant,
      });
    }
  }

  const existingRows = await m_CardVariant.findAll({
    where: { card_id: { [Op.in]: cardIds } },
    attributes: ["card_id", "variant"],
    transaction: t,
  });

  const existingSet = new Set(
    existingRows.map((r) => `${r.get("card_id")}::${r.get("variant")}`)
  );
  const desiredSet = new Set(desired.map((v) => `${v.card_id}::${v.variant}`));

  const toUpsert = desired;

  const toDeleteKeys = diffSet(existingSet, desiredSet);
  const toDelete = Array.from(toDeleteKeys).map((k) => {
    const [card_id, variant] = k.split("::");
    return { card_id, variant };
  });

  const afterCount = existingRows.length - toDelete.length + toUpsert.length;
  return { toUpsert, toDelete, afterCount };
}

async function countVariantsForSet(setCode, t) {
  const cardIds = await m_Card.findAll({
    where: { set_code: setCode },
    attributes: ["id"],
    transaction: t,
  });
  if (cardIds.length === 0) return 0;
  const ids = cardIds.map((r) => r.get("id"));
  return await m_CardVariant.count({
    where: { card_id: { [Op.in]: ids } },
    transaction: t,
  });
}

/* ============================================================================ */

function sameCard(a, b) {
  const norm = (x) => (x == null ? null : String(x).trim());
  return (
    a.set_code === b.set_code &&
    a.number === b.number &&
    norm(a.name) === norm(b.name) &&
    norm(a.rarity) === norm(b.rarity) &&
    norm(a.supertype) === norm(b.supertype) &&
    norm(a.subtype) === norm(b.subtype) &&
    norm(a.regulation_mark) === norm(b.regulation_mark) &&
    norm(a.image_small) === norm(b.image_small) &&
    norm(a.image_large) === norm(b.image_large)
  );
}

function diffSet(A, B) {
  const out = new Set();
  for (const k of A) if (!B.has(k)) out.add(k);
  return out;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default { ingestSet };
