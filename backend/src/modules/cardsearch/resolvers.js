// src/modules/cardsearch/resolvers.js
// GraphQL resolvers for Card Search wired to shared services.
// - Pulls cards/sets/variants from m_* tables
// - Uses CardPriceCache -> m_PriceLatest as fallback for latest prices
// - Uses computeRollupsSnapshot -> m_PriceRollup fallback for rollups
// - Exposes admin job runners that call the actual jobs
// - NEW: cardsearchBulkAddToCollection for batch adding cards to a user's collection

import { Op, fn, col } from "sequelize";

import {
  m_Set,
  m_Card,
  m_PriceLatest,
  m_PriceRollup, // note: rename here if your model is plural
  m_CardVariant,
  CardPriceCache,
  CardPriceHistory,
} from "../../models/index.js";

// UPDATED:
// - Import the full models namespace so we can safely access Collection without fragile named imports
import * as models from "../../models/index.js";

// UPDATED:
// - Define Collection from exports (fixes "Collection is not defined")
const Collection = models.Collection;

import qb from "./services/queryBuilder.service.js";
import { computeRollupsSnapshot } from "./services/rollup.service.js";
import { fetchPriceHistory } from "./services/history.service.js";
import { getAbbrForTcgdex } from "./services/setMapping.service.js";

// --- Admin jobs (used in mutations) ---
import { ingestSet } from "./jobs/ingestSet.job.js";
import { collectPrices } from "./jobs/collectPrices.job.js";
import { collectBoth } from "./jobs/collectBoth.job.js";
import { rebuildPriceRollups as jobPriceRollup } from "./jobs/priceRollup.job.js";
import { fxDaily } from "./jobs/fxDaily.job.js";

/* ---------------- image helpers ---------------- */

function buildHighResImageUrl(raw) {
  if (!raw) return null;
  let url = String(raw).trim();
  if (!url) return null;
  url = url.replace(/\\/g, "/").replace(/\/+$/, "");
  if (url.toLowerCase().endsWith("/high.webp")) return url;
  url = url.replace(/\.(png|jpe?g|webp)$/i, "");
  return url + "/high.webp";
}

function buildCardImages(row) {
  let source =
    row?.images?.large ??
    row?.images?.small ??
    row?.image_large ??
    row?.image_small;

  if (!source) {
    const setCode = row?.setCode ?? row?.set_code ?? null;
    const number = row?.number ?? row?.cardNumber ?? null;
    if (setCode && number) {
      const family =
        setCode.replace(/[^a-z]/gi, "").toLowerCase() || setCode.toLowerCase();
      const normalizedSet = setCode.toLowerCase();
      source = `https://assets.tcgdex.net/en/${family}/${normalizedSet}/${number}`;
    }
  }
  const highRes = buildHighResImageUrl(source);

  if (!highRes) return { small: null, large: null };
  return { small: null, large: highRes };
}

/* ---------------- helpers ---------------- */

// Normalize variant inputs so lookups match storage shape
function normalizeVariant(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const c = trimmed.toLowerCase().replace(/[\s_-]+/g, "");
  if (c === "holofoil" || c === "holo_foil") return "holo";
  if (c === "reverseholo" || c === "reverseholofoil") return "reverse";
  if (c === "firstedition") return "firstEdition";
  return c;
}

// -------- price extraction helpers (tolerant to schema differences) --------
function num(x) {
  if (x === null || x === undefined) return null;
  const n =
    typeof x === "number" ? x : Number(String(x).replace(/[, ]+/g, ""));
  return Number.isFinite(n) ? n : null;
}
function gt0(x) {
  const n = num(x);
  return n != null && n > 0 ? n : null;
}
function firstDefined(obj, fields) {
  for (const f of fields) {
    if (!f) continue;
    if (Object.prototype.hasOwnProperty.call(obj, f) && obj[f] != null)
      return obj[f];
  }
  return null;
}
function hasMeaningfulPrice(row) {
  return (
    gt0(row.gbp) != null ||
    gt0(row.market) != null ||
    gt0(row.mid) != null ||
    gt0(row.low) != null ||
    gt0(row.high) != null
  );
}

// Primary/alt candidates for common provider schemas
const PRICE_FIELDS_PRIMARY = ["gbp", "market", "mid"];
const PRICE_FIELDS_ALTS = [
  "price_gbp",
  "price",
  "value",
  "last_gbp",
  "last",
  "avg_gbp",
  "average_gbp",
  "avg",
  "mean",
  "median",
  "latest_gbp",
  "latest_market",
  "latest_mid",
];
const LOW_FIELDS = ["low", "floor", "min", "min_gbp", "low_gbp"];
const HIGH_FIELDS = ["high", "ceiling", "max", "max_gbp", "high_gbp"];
const UPDATED_AT_FIELDS = [
  "updatedAt",
  "updated_at",
  "timestamp",
  "observed_at",
  "computed_at",
  "date",
];

// Derive values safely from a Card-like object
function deriveSetCode(parent) {
  if (parent?.setCode) return String(parent.setCode);
  if (parent?.set_code) return String(parent.set_code);
  const id = parent?.cardId || parent?.id;
  if (typeof id === "string" && id.includes("-")) return id.split("-")[0];
  return null;
}
function deriveNumber(parent) {
  if (parent?.number) return String(parent.number);
  const id = parent?.cardId || parent?.id;
  if (typeof id === "string" && id.includes("-"))
    return id.split("-").slice(1).join("-");
  return null;
}

const resolvers = {
  Query: {
    async cardsearchSearchCards(_, { input }) {
      const { where, order, limit, offset, include } =
        await qb.buildCardQuery(input);

      const total = await m_Card.count({ where });
      const rows = await m_Card.findAll({
        where,
        order,
        limit,
        offset,
        include,
      });

      const items = rows.map((r) => {
        const row = r.get();
        return {
          id: `${row.set_code}-${row.number}`,
          cardId: `${row.set_code}-${row.number}`,
          setCode: row.set_code,
          number: row.number,
          name: row.name,
          rarity: row.rarity ?? null,
          supertype: row.supertype ?? null,
          subtype: row.subtype ?? null,
          regulationMark: row.regulation_mark ?? null,
          illustrator: row.illustrator ?? null,
          images: buildCardImages(row),
        };
      });

      return { total, limit, offset, items };
    },

    async cardsearchCardById(_, { cardId }) {
      if (!cardId || typeof cardId !== "string" || !cardId.includes("-"))
        return null;

      const [set_code, ...rest] = cardId.split("-");
      const number = rest.join("-");
      const row = await m_Card.findOne({ where: { set_code, number } });
      if (!row) return null;

      const r = row.get();
      return {
        id: `${r.set_code}-${r.number}`,
        cardId: `${r.set_code}-${r.number}`,
        setCode: r.set_code,
        number: r.number,
        name: r.name,
        rarity: r.rarity ?? null,
        supertype: r.supertype ?? null,
        subtype: r.subtype ?? null,
        regulationMark: r.regulation_mark ?? null,
        illustrator: r.illustrator ?? null,
        images: buildCardImages(r),
      };
    },

    // NOTE: kept as an internal query for admin/tools; schema exposes CardsearchCard.latestPrices instead.
    async cardsearchPriceLatest(_, { cardId, variant }) {
      const where = { card_id: cardId };
      if (variant) where.variant = normalizeVariant(variant);

      // Prefer cache if present
      if (CardPriceCache) {
        const cacheAttrs = CardPriceCache.rawAttributes || {};
        const has = (k) => !!cacheAttrs[k];

        const rows = await CardPriceCache.findAll({
          where: {
            [has("cardId") ? "cardId" : "card_id"]: cardId,
            ...(variant
              ? {
                  [
                    has("variation")
                      ? "variation"
                      : has("variant")
                      ? "variant"
                      : "variation"
                  ]: normalizeVariant(variant),
                }
              : {}),
          },
          order: [[has("updatedAt") ? "updatedAt" : "updated_at", "DESC"]],
          raw: true,
        });

        const vCol = has("variation")
          ? "variation"
          : has("variant")
          ? "variant"
          : "variation";
        const uCol = has("updatedAt") ? "updatedAt" : "updated_at";

        const shaped = rows
          .map((x) => ({
            cardId,
            variant: x[vCol] ?? null,
            currency: x.currency ?? "GBP",
            low: gt0(x.low),
            mid: gt0(x.mid),
            high: gt0(x.high),
            market: gt0(x.market ?? x.gbp ?? x.mid),
            updatedAt: x[uCol] ? new Date(x[uCol]).toISOString() : null,
            provider: x.provider ?? null,
            gbp: gt0(x.gbp ?? x.price_gbp),
          }))
          .filter(hasMeaningfulPrice);

        if (shaped.length) return shaped;
      }

      // Fallback: m_PriceLatest
      const rows = await m_PriceLatest.findAll({
        where,
        order: [["updated_at", "DESC"]],
        raw: true,
      });

      return rows
        .map((x) => ({
          cardId: x.card_id,
          variant: x.variant,
          currency: x.currency ?? "GBP",
          low: gt0(x.low ?? x.low_gbp),
          mid: gt0(x.mid),
          high: gt0(x.high ?? x.high_gbp),
          market: gt0(x.market ?? x.gbp ?? x.mid),
          updatedAt: x.updated_at,
          provider: x.provider ?? null,
          gbp: gt0(x.gbp ?? x.price_gbp),
        }))
        .filter(hasMeaningfulPrice);
    },

    async cardsearchPriceRollups(_, { cardId, variant, windows }) {
      if (!cardId) return null;
      return loadPriceRollups(cardId, variant, { windows });
    },

    async cardsearchPriceRollupsAll(_, { cardId, variants, windows }) {
      if (!cardId) return [];

      let variantList =
        Array.isArray(variants) && variants.length
          ? variants
              .map((v) => String(v).trim().toLowerCase())
              .filter(Boolean)
          : [];

      if (!variantList.length) {
        try {
          const rows = await m_CardVariant.findAll({
            where: { card_id: cardId },
            attributes: ["variant"],
            raw: true,
          });
          variantList = rows.length
            ? rows.map((row) => String(row.variant || "normal").toLowerCase())
            : ["normal"];
        } catch {
          variantList = ["normal"];
        }
      }

      const seen = new Set();
      const unique = [];
      for (const key of variantList) {
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(key);
      }
      if (!unique.length) unique.push("normal");

      const opts = { windows };
      const out = [];
      for (const variantKey of unique) {
        const rollup = await loadPriceRollups(cardId, variantKey, opts);
        if (rollup) out.push(rollup);
      }
      return out;
    },

    async cardsearchPriceObservations(
      _,
      { cardId, variant, startDate, endDate, limit = 365, offset = 0 }
    ) {
      if (!cardId) return [];
      const history = await fetchPriceHistory(cardId, {
        variant,
        startDate,
        endDate,
        limit: Math.max(1, Math.min(1000, Number(limit))),
        offset: Math.max(0, Number(offset)),
      });

      return history
        .map((row) => ({
          cardId,
          variant:
            row.variant ??
            (variant ? String(variant).trim().toLowerCase() : null),
          date: row.date ?? null,
          currency: row.currency ?? "GBP",
          low: gt0(row.low ?? row.low_gbp),
          mid: gt0(row.mid),
          high: gt0(row.high ?? row.high_gbp),
          market: gt0(row.market ?? row.gbp ?? row.mid),
          provider: row.provider ?? null,
        }))
        .filter(hasMeaningfulPrice);
    },

    async cardsearchSetByCode(_, { code }) {
      const row = await m_Set.unscoped().findOne({ where: { code } });
      if (!row) return null;
      const r = row.get();
      return {
        code: r.code,
        abbr: r.abbr ?? null,
        name: r.name,
        series: r.series ?? null,
        releasedAt: r.released_at ?? r.release_date ?? null,
        total: r.total ?? null,
        lang: r.lang ?? null,
      };
    },

    async cardsearchSets(_, { query, limit = 100, offset = 0 }) {
      const where = qb.buildSetWhere({ query });

      const rows = await m_Set.unscoped().findAll({
        where,
        order: [["code", "ASC"]],
        limit: Math.max(1, Math.min(500, Number(limit))),
        offset: Math.max(0, Number(offset)),
      });

      return rows.map((r) => {
        const x = r.get();
        return {
          code: x.code,
          abbr: x.abbr ?? x.abbreviation ?? getAbbrForTcgdex(x.code) ?? null,
          name: x.name,
          series: x.series ?? null,
          releasedAt: x.released_at ?? x.release_date ?? null,
          total: x.total ?? null,
          lang: x.lang ?? null,
        };
      });
    },
  },

  Mutation: {
    async cardsearchAdminRunJob(_, { input }) {
      const startedAt = new Date().toISOString();
      try {
        const { kind, set, era, budget } = input || {};
        let stats = null;

        switch (kind) {
          case "ingestSet":
            stats = await ingestSet({
              input: set,
              refresh: true,
              logger: console,
            });
            break;
          case "collectPrices":
            stats = await collectPrices({ set, logger: console });
            break;
          case "collectBoth":
            stats = await collectBoth({
              sets: set ? [set] : [],
              refreshSet: true,
              logger: console,
            });
            break;
          case "priceRollup":
            stats = await jobPriceRollup({ set, logger: console });
            break;
          case "fxDaily":
            stats = await fxDaily({ logger: console });
            break;
          case "patchGaps":
            stats = {
              ok: false,
              message: "patchGaps not implemented",
              era,
              budget,
            };
            break;
          default:
            throw new Error(`Unknown job kind: ${kind}`);
        }

        return {
          ok: true,
          message: "Job completed",
          stats,
          startedAt,
          finishedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          ok: false,
          message: err?.message || String(err),
          stats: null,
          startedAt,
          finishedAt: new Date().toISOString(),
        };
      }
    },

    async cardsearchAdminToggleSet(_, { code, enabled }) {
      const row = await m_Set.findOne({ where: { code } });
      if (!row) throw new Error(`Set not found: ${code}`);
      const r = row.get();
      return {
        set: {
          code: r.code,
          abbr: r.abbr ?? null,
          name: r.name,
          series: r.series ?? null,
          releasedAt: r.released_at ?? r.release_date ?? null,
          total: r.total ?? null,
          lang: r.lang ?? null,
        },
        hasCache: false,
        lastIngestAt: null,
        lastPriceCollectAt: null,
        lastRollupAt: null,
        cardCount: null,
        variantCount: null,
        latestCoveragePct: null,
        observationsCount: null,
        staleDays: null,
        enabled: !!enabled,
      };
    },

    async cardsearchAdminRebuildRollups(_, { set }) {
      const startedAt = new Date().toISOString();
      try {
        const stats = await jobPriceRollup({ set, logger: console });
        return {
          ok: true,
          message: "Rollups rebuilt",
          stats,
          startedAt,
          finishedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          ok: false,
          message: err?.message || String(err),
          stats: null,
          startedAt,
          finishedAt: new Date().toISOString(),
        };
      }
    },

    // -------------------------------------------------------------------------
    // NEW: Bulk add to Collection used by /search Batch Add workbench
    // -------------------------------------------------------------------------
    async cardsearchBulkAddToCollection(_, { input }, ctx) {
      if (!input || !Array.isArray(input.items) || input.items.length === 0) {
        return { ok: false, message: "No items provided", items: [] };
      }

      const userId =
        input.userId ||
        ctx?.user?.id ||
        ctx?.userId ||
        ctx?.auth?.userId ||
        null;

      if (!userId) {
        return {
          ok: false,
          message: "Missing userId — pass input.userId or expose it on context",
          items: input.items.map((it) => ({
            cardId: it?.cardId ?? null,
            quantity: Number(it?.quantity ?? 0),
            created: false,
            previousQuantity: null,
            newQuantity: null,
            error: "No userId",
          })),
        };
      }

      // UPDATED:
      // - Collection is now defined at top-level from models exports
      if (!Collection || !Collection.sequelize) {
        return {
          ok: false,
          message:
            "Collection model not available (check models/index.js export)",
          items: input.items.map((it) => ({
            cardId: it?.cardId ?? null,
            quantity: Number(it?.quantity ?? 0),
            created: false,
            previousQuantity: null,
            newQuantity: null,
            error: "Collection model unavailable",
          })),
        };
      }

      const tx = await Collection.sequelize.transaction();
      const results = [];

      try {
        for (const raw of input.items) {
          const cardId = raw?.cardId ? String(raw.cardId) : null;
          const quantity = Number(raw?.quantity ?? 0);

          if (!cardId) {
            results.push({
              cardId: null,
              quantity,
              created: false,
              previousQuantity: null,
              newQuantity: null,
              error: "Missing cardId",
            });
            continue;
          }

          if (!Number.isFinite(quantity) || quantity <= 0) {
            results.push({
              cardId,
              quantity,
              created: false,
              previousQuantity: null,
              newQuantity: null,
              error: "Quantity must be > 0",
            });
            continue;
          }

          try {
            // UPDATED:
            // - DO NOT use `col("Collection.userId")` / sqlWhere/sqlAnd
            // - Use model attribute names so Sequelize maps columns correctly
            // - Include variation in uniqueness if provided (matches your unique index)
            const whereClause = {
              userId,
              cardId,
              ...(raw?.variation != null && raw.variation !== ""
                ? { variation: String(raw.variation) }
                : {}),
            };

            const existing = await Collection.findOne({
              where: whereClause,
              transaction: tx,
              lock: tx.LOCK.UPDATE,
            });

            if (!existing) {
              const createdRow = await Collection.create(
                {
                  userId,
                  cardId,
                  quantity,
                  variation:
                    raw?.variation != null && raw.variation !== ""
                      ? String(raw.variation)
                      : null,
                  condition:
                    raw?.condition != null && raw.condition !== ""
                      ? String(raw.condition)
                      : null,
                  wishlist: false,
                },
                { transaction: tx }
              );

              results.push({
                cardId,
                quantity,
                created: true,
                previousQuantity: 0,
                newQuantity: Number(createdRow?.quantity ?? quantity),
                error: null,
              });
            } else {
              const prev = Number(existing.quantity ?? 0);
              const next = prev + quantity;

              existing.quantity = next;

              // Optional fields: only update if passed
              if (raw?.variation != null && "variation" in existing) {
                existing.variation =
                  raw.variation !== "" ? String(raw.variation) : null;
              }
              if (raw?.condition != null && "condition" in existing) {
                existing.condition =
                  raw.condition !== "" ? String(raw.condition) : null;
              }

              await existing.save({ transaction: tx });

              results.push({
                cardId,
                quantity,
                created: false,
                previousQuantity: prev,
                newQuantity: next,
                error: null,
              });
            }
          } catch (err) {
            results.push({
              cardId,
              quantity,
              created: false,
              previousQuantity: null,
              newQuantity: null,
              error: err?.message || String(err),
            });
          }
        }

        await tx.commit();

        const hasError = results.some((r) => r.error);
        return {
          ok: !hasError,
          message: hasError ? "Completed with some errors" : "All items added",
          items: results,
        };
      } catch (err) {
        await tx.rollback();
        return { ok: false, message: err?.message || String(err), items: [] };
      }
    },
  },

  CardsearchCard: {
    setCode(parent) {
      return deriveSetCode(parent);
    },
    number(parent) {
      return deriveNumber(parent);
    },

    images(parent) {
      if (parent?.images && (parent.images.large || parent.images.small))
        return parent.images;
      const setCode = deriveSetCode(parent);
      const number = deriveNumber(parent);
      if (!setCode || !number) return { small: null, large: null };
      return buildCardImages({ setCode, number });
    },

    async set(parent) {
      const code = deriveSetCode(parent);
      if (!code) return null;
      const row = await m_Set.unscoped().findOne({ where: { code } });
      if (!row) return null;
      const r = row.get();
      return {
        code: r.code,
        abbr: r.abbr ?? null,
        name: r.name,
        series: r.series ?? null,
        releasedAt: r.released_at ?? r.release_date ?? null,
        total: r.total ?? null,
        lang: r.lang ?? null,
      };
    },

    async variants(parent) {
      const rows = await m_CardVariant.findAll({
        where: { card_id: parent.cardId || parent.id },
        order: [["variant", "ASC"]],
      });

      if (!rows.length) {
        return [{ key: "normal", label: "Normal", default: true }];
      }

      return rows.map((r) => {
        const row = r.get();
        const key = row.variant ?? "normal";
        const label = row.display_name ?? row.variant ?? key;
        return {
          key,
          label: label
            ? label.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            : key,
          default: key === "normal",
        };
      });
    },

    async latestPrices(parent, { variant } = {}) {
      const cardId = parent.cardId || parent.id || null;
      if (!cardId) return [];

      const normalizedVariant = normalizeVariant(variant);

      const cacheAttrs = CardPriceCache?.rawAttributes || {};
      const nameFor = (candidates) =>
        candidates.find((c) => cacheAttrs[c]) || null;

      const colCardId = nameFor(["cardId", "card_id"]) || "cardId";
      const colVar = nameFor(["variation", "variant"]) || "variation";
      const colUpdated = nameFor(["updatedAt", "updated_at"]) || "updatedAt";
      const colCurrency = nameFor(["currency"]) || "currency";
      const colProvider = nameFor(["provider"]) || "provider";
      const colMarket = nameFor(["market"]) || "market";
      const colMid = nameFor(["mid"]) || "mid";
      const colLow = nameFor(["low"]) || "low";
      const colHigh = nameFor(["high"]) || "high";
      const colGbp = nameFor(["gbp"]) || "gbp";

      const shape = (r) => {
        const variation = (r[colVar] || normalizedVariant || "normal")
          .toString()
          .toLowerCase();
        const primary = firstDefined(r, [
          colGbp,
          colMarket,
          colMid,
          ...PRICE_FIELDS_PRIMARY,
        ]);
        const alt = firstDefined(r, PRICE_FIELDS_ALTS);
        const best = gt0(primary != null ? primary : alt);
        const low = gt0(firstDefined(r, [colLow, ...LOW_FIELDS]));
        const high = gt0(firstDefined(r, [colHigh, ...HIGH_FIELDS]));
        const updatedRaw = firstDefined(r, [colUpdated, ...UPDATED_AT_FIELDS]);
        const updatedAt = updatedRaw ? new Date(updatedRaw).toISOString() : null;

        return {
          provider: r[colProvider] ?? null,
          currency: r[colCurrency] ?? "GBP",
          gbp: best,
          market: gt0(r[colMarket]) ?? best,
          mid: gt0(r[colMid]) ?? best,
          low,
          high,
          variation,
          updatedAt,
        };
      };

      // 1) Try cache (with and without variant)
      let cacheRows = [];
      if (CardPriceCache) {
        const whereWithVar = {
          [colCardId]: cardId,
          ...(normalizedVariant ? { [colVar]: normalizedVariant } : {}),
        };
        cacheRows = await CardPriceCache.findAll({
          where: whereWithVar,
          order: [[colUpdated, "DESC"]],
          limit: normalizedVariant ? 50 : 100,
          raw: true,
        });
        if (normalizedVariant && !cacheRows.length) {
          cacheRows = await CardPriceCache.findAll({
            where: { [colCardId]: cardId },
            order: [[colUpdated, "DESC"]],
            limit: 100,
            raw: true,
          });
        }
      }

      // 2) Fallback to m_PriceLatest
      let latestRows = [];
      if (!cacheRows.length) {
        const whereLatest = {
          card_id: cardId,
          ...(normalizedVariant ? { variant: normalizedVariant } : {}),
        };
        const mRows = await m_PriceLatest.findAll({
          where: whereLatest,
          order: [["updated_at", "DESC"]],
          limit: normalizedVariant ? 50 : 100,
          raw: true,
        });

        latestRows = mRows.map((r) => ({
          [colCardId]: r.card_id,
          [colVar]: r.variant,
          [colCurrency]: r.currency ?? "GBP",
          [colMarket]: r.market,
          [colMid]: r.mid,
          [colLow]: r.low ?? r.low_gbp,
          [colHigh]: r.high ?? r.high_gbp,
          [colProvider]: r.provider,
          [colUpdated]: r.updated_at,
          [colGbp]: r.gbp ?? r.price_gbp,
          ...r,
        }));

        if (normalizedVariant && !latestRows.length) {
          const mRowsAll = await m_PriceLatest.findAll({
            where: { card_id: cardId },
            order: [["updated_at", "DESC"]],
            limit: 100,
            raw: true,
          });

          latestRows = mRowsAll.map((r) => ({
            [colCardId]: r.card_id,
            [colVar]: r.variant,
            [colCurrency]: r.currency ?? "GBP",
            [colMarket]: r.market,
            [colMid]: r.mid,
            [colLow]: r.low ?? r.low_gbp,
            [colHigh]: r.high ?? r.high_gbp,
            [colProvider]: r.provider,
            [colUpdated]: r.updated_at,
            [colGbp]: r.gbp ?? r.price_gbp,
            ...r,
          }));
        }
      }

      const combined = (cacheRows.length ? cacheRows : latestRows)
        .map(shape)
        .filter(hasMeaningfulPrice);

      if (!combined.length) return [];

      // De-dupe to latest per (provider, variation)
      const pick = new Map();
      for (const r of combined) {
        const v = (r.variation || "normal").toString().toLowerCase();
        const p = r.provider || "unknown";
        const key = `${p}|${v}`;
        const cur = pick.get(key);
        if (!cur) {
          pick.set(key, r);
          continue;
        }
        const tNew = new Date(r.updatedAt || 0).getTime();
        const tCur = new Date(cur.updatedAt || 0).getTime();
        if (tNew > tCur) pick.set(key, r);
      }
      return Array.from(pick.values());
    },

    async priceRollups(parent, { window } = {}) {
      const cardId = parent.cardId || parent.id || null;
      if (!cardId) return [];

      const normalizedWindow =
        typeof window === "string" && window.trim()
          ? window.trim().toLowerCase()
          : "30d";

      const match = normalizedWindow.match(/^(\d+)d$/);
      const windowDays = match
        ? parseInt(match[1], 10)
        : { "7d": 7, "30d": 30, "90d": 90 }[normalizedWindow] || 30;

      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

      const where = { cardId, updatedAt: { [Op.gte]: since } };

      const [agg] = await CardPriceHistory.findAll({
        where,
        attributes: [
          [fn("MIN", col("gbp")), "min"],
          [fn("MAX", col("gbp")), "max"],
          [fn("AVG", col("gbp")), "avg"],
        ],
        raw: true,
      });

      const latestRow = await CardPriceHistory.findOne({
        where: { cardId },
        order: [["updatedAt", "DESC"]],
      });

      const lastValue = latestRow
        ? latestRow.gbp ?? latestRow.market ?? latestRow.mid ?? null
        : null;

      const updatedAt = latestRow?.updatedAt
        ? new Date(latestRow.updatedAt).toISOString()
        : null;

      return [
        {
          window: normalizedWindow,
          min: agg?.min != null ? Number(agg.min) : null,
          max: agg?.max != null ? Number(agg.max) : null,
          avg: agg?.avg != null ? Number(agg.avg) : null,
          last: lastValue != null ? Number(lastValue) : null,
          updatedAt,
        },
      ];
    },

    async priceRollupsAll(parent, { variants, windows }) {
      const cardId = parent.cardId || parent.id || null;
      if (!cardId) return [];

      let variantList =
        Array.isArray(variants) && variants.length
          ? variants
              .map((v) => String(v).trim().toLowerCase())
              .filter(Boolean)
          : [];

      if (!variantList.length && Array.isArray(parent.variants) && parent.variants.length) {
        variantList = parent.variants
          .map((v) => (typeof v === "string" ? v : v.key || v.variant))
          .filter(Boolean)
          .map((v) => String(v).toLowerCase());
      }

      if (!variantList.length) {
        try {
          const resolved = await resolvers.CardsearchCard.variants(parent);
          variantList = resolved.map((v) =>
            String(v.key || v.variant || "normal").toLowerCase()
          );
        } catch {
          variantList = [];
        }
      }

      if (!variantList.length) variantList = ["normal"];

      const seen = new Set();
      const unique = [];
      for (const key of variantList) {
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(key);
      }
      if (!unique.length) unique.push("normal");

      const opts = { windows };
      const out = [];
      for (const variantKey of unique) {
        const rollup = await loadPriceRollups(cardId, variantKey, opts);
        if (rollup) out.push(rollup);
      }
      return out;
    },

    setName: async (parent) => {
      if (parent?.set?.name) return parent.set.name;
      if (typeof parent.setName === "string") return parent.setName;
      try {
        const resolved = await resolvers.CardsearchCard.set(parent);
        return resolved?.name ?? null;
      } catch {
        return null;
      }
    },

    image: (parent) => {
      const imgs = resolvers.CardsearchCard.images(parent);
      return imgs?.large || imgs?.small || parent.image || null;
    },

    variations: async (parent, args, ctx, info) => {
      if (Array.isArray(parent.variants) && parent.variants.length) return parent.variants;
      return resolvers.CardsearchCard.variants(parent, args, ctx, info);
    },

    async prices(parent, args, ctx, info) {
      return resolvers.CardsearchCard.latestPrices(parent, args, ctx, info);
    },
  },
};

/* ---------------- shared helpers for rollups ---------------- */

function normalizeWindowList(value) {
  if (value == null) return null;
  const arr = Array.isArray(value) ? value : [value];
  const parsed = arr
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!parsed.length) return null;
  return Array.from(new Set(parsed)).sort((a, b) => a - b);
}

async function loadRollupsFromTable(cardId, variant, requestedWindows) {
  try {
    const rows = await m_PriceRollup.findAll({
      where: { card_id: cardId, variant },
      order: [
        ["days", "ASC"],
        ["computed_at", "DESC"],
      ],
      raw: true,
    });
    if (!rows || !rows.length) return null;

    const seen = new Set();
    const out = [];
    for (const row of rows) {
      const windowDays = Number(row.days ?? row.window ?? 0);
      if (!Number.isFinite(windowDays) || windowDays <= 0) continue;
      if (requestedWindows && requestedWindows.length && !requestedWindows.includes(windowDays))
        continue;
      if (seen.has(windowDays)) continue;
      seen.add(windowDays);
      out.push({
        window: windowDays,
        days: windowDays,
        startDate: null,
        endDate: null,
        count: Number(row.count ?? 0),
        min: toNumber(row.min_gbp),
        max: toNumber(row.max_gbp),
        avg: toNumber(row.avg_gbp),
        change: toNumber(row.change_gbp ?? null),
        changePct: toNumber(row.change_pct ?? null),
        latest: toNumber(row.last_gbp ?? row.latest_gbp ?? null),
        latestDate: row.computed_at
          ? new Date(row.computed_at).toISOString().slice(0, 10)
          : null,
        computedAt: row.computed_at ?? null,
      });
    }
    return out;
  } catch (err) {
    console.warn?.(
      `priceRollups: table fallback failed for ${cardId}/${variant}: ${err?.message || err}`
    );
    return null;
  }
}

function mapComputedRollupRow(row) {
  const windowDays = Number(row.window ?? row.days ?? 0);
  if (!Number.isFinite(windowDays) || windowDays <= 0) return null;
  return {
    window: windowDays,
    days: windowDays,
    startDate: row.startDate ?? null,
    endDate: row.endDate ?? null,
    count: row.count ?? 0,
    min: toNumber(row.min),
    max: toNumber(row.max),
    avg: toNumber(row.avg),
    change: toNumber(row.change),
    changePct: toNumber(row.changePct),
    latest: toNumber(row.latest),
    latestDate: row.latestDate ?? null,
    computedAt: row.computedAt ?? null,
  };
}

async function loadPriceRollups(cardId, variant, { windows } = {}) {
  if (!cardId) return null;
  const requestedWindows = normalizeWindowList(windows);

  let resolvedVariant = variant ? String(variant).trim().toLowerCase() : null;
  if (!resolvedVariant) {
    try {
      const row = await m_CardVariant.findOne({
        where: { card_id: cardId },
        attributes: ["variant"],
        raw: true,
      });
      resolvedVariant = row ? String(row.variant || "normal").toLowerCase() : "normal";
    } catch {
      resolvedVariant = "normal";
    }
  }

  let rows = null;
  try {
    const computed = await computeRollupsSnapshot(
      cardId,
      resolvedVariant,
      requestedWindows ? { windows: requestedWindows } : {}
    );
    if (Array.isArray(computed) && computed.length) {
      const mapped = computed.map(mapComputedRollupRow).filter(Boolean);
      const hasMeaningfulHistory = mapped.some(
        (r) => (r.count ?? 0) > 1 || (r.avg != null && (r.count ?? 0) > 0)
      );
      const hasLatest = mapped.some((r) => r.latest != null);
      if (mapped.length && (hasMeaningfulHistory || hasLatest)) rows = mapped;
    }
  } catch (err) {
    console.warn?.(
      `priceRollups: compute failed for ${cardId}/${resolvedVariant}: ${err?.message || err}`
    );
  }

  if (!rows || !rows.length) {
    rows = (await loadRollupsFromTable(cardId, resolvedVariant, requestedWindows)) ?? [];
  }

  if (!rows.length) return null;

  if (requestedWindows && requestedWindows.length) {
    rows = rows.filter((r) => requestedWindows.includes(Number(r.window ?? r.days ?? 0)));
    if (!rows.length) return null;
  }

  return assembleRollup(cardId, resolvedVariant, rows);
}

function toNumber(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function assembleRollup(cardId, variant, rows) {
  if (!rows || !rows.length) return null;

  const normalizedVariant = String(variant || rows[0]?.variant || "normal").toLowerCase();

  const out = {
    cardId,
    variant: normalizedVariant,
    currency: "GBP",
    latest: null,
    d1: null,
    d7: null,
    d30: null,
    d90: null,
  };

  let latestCandidate = null;
  let latestDate = null;

  for (const r of rows) {
    const windowDays = Number(r.window ?? r.days ?? 0);
    const min = toNumber(r.min ?? r.min_gbp);
    const max = toNumber(r.max ?? r.max_gbp);
    const avg = toNumber(r.avg ?? r.avg_gbp);
    const change = toNumber(r.change ?? r.change_gbp);
    const changePct = toNumber(r.changePct ?? r.change_pct);
    const startDate = r.startDate ?? r.start_date ?? null;
    const endDate = r.endDate ?? r.end_date ?? null;
    const count = r.count ?? 0;

    const windowObj = { startDate, endDate, count, min, max, avg, change, changePct };

    const rLatest = toNumber(r.latest ?? r.last_gbp ?? r.latest_market ?? r.latest_mid ?? avg);
    const rLatestDate =
      r.latestDate ??
      r.latest_date ??
      endDate ??
      startDate ??
      (r.computed_at ? new Date(r.computed_at).toISOString().slice(0, 10) : null);

    if (latestCandidate == null && rLatest != null) {
      latestCandidate = rLatest;
      latestDate = rLatestDate;
    }

    const key = String(windowDays);
    if (key === "1" && !out.d1) out.d1 = windowObj;
    else if (key === "7" && !out.d7) out.d7 = windowObj;
    else if (key === "30" && !out.d30) out.d30 = windowObj;
    else if (key === "90" && !out.d90) out.d90 = windowObj;
  }

  if (!out.latest && latestCandidate != null) {
    out.latest = {
      date: latestDate ?? null,
      low: null,
      mid: latestCandidate,
      high: null,
      market: latestCandidate,
    };
  }

  return out;
}

export default resolvers;
