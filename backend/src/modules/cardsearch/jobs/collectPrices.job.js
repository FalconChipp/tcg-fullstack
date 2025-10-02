// src/modules/cardsearch/jobs/collectPrices.job.js
// Collect latest prices for a set from multiple providers, convert to GBP,
// upsert observations, and refresh the "latest" snapshot.
//
// Providers (priority): tcgdex > ptcgio > ppt
//
// Usage (programmatic):
//   const res = await collectPrices({ set: 'SSP', since: '2025-09-01' });
//   console.log(res);
//
// Returns:
// {
//   ok: true,
//   setCode: 'sv08',
//   counts: {
//     cards: 197,
//     variants: 220,
//     observations: { collected: 1822, written: 1788, byCardPct: 98.1 },
//     latest: 220
//   },
//   ms: 1843,
//   notes: { fxDate, providersTried }
// }

import { Op, Sequelize } from "sequelize";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sequelize, m_Set, m_Card, m_CardVariant } from "../../../models/index.js";
import { resolveSet, resolveToTcgdex } from "../services/setMapping.service.js";

import { fetchPricesTCGdex } from "../adapters/priceAdapter.tcgdex.service.js";
import { fetchPricesPTCGIO } from "../adapters/priceAdapter.ptcgio.service.js";
import { fetchPricesPPT } from "../adapters/priceAdapter.ppt.service.js";

import { toGBP, getFx } from "../services/fx.service.js";
import { fxDaily } from "./fxDaily.job.js";

/* ========================================================================== *
 * Public API
 * ========================================================================== */

/**
 * @typedef {Object} CollectOptions
 * @property {string} set       - ABBR | tcgdex | ptcg (e.g., 'SSP' or 'sv08' or 'sv8')
 * @property {string} [since]   - ISO date-string (YYYY-MM-DD); observations older than this may be skipped
 * @property {boolean} [dryRun] - If true, no DB writes (stats only)
 * @property {boolean} [prewarmFx] - If true, prewarm ECB cache before collecting
 * @property {number}  [backfillFxDays] - If provided, backfill FX per-day for N days
 * @property {('tcgdex'|'ptcgio'|'ppt')[]} [providers] - Limit providers; default ['tcgdex','ptcgio','ppt']
 * @property {boolean} [gapFillOnly] - If true, only query PPT (or providers) to patch gaps
 * @property {Console|{log:Function,warn:Function,error:Function}} [logger]
 */

/**
 * Collect prices for one set and update observations + latest.
 * @param {CollectOptions} opts
 */
export async function collectPrices(opts) {
  const started = Date.now();
  const logger = opts?.logger ?? console;
  const dryRun = !!opts?.dryRun;
  const inputSet = String(opts?.set ?? "").trim();
  if (!inputSet) throw new Error("collectPrices: 'set' is required.");

  // Resolve codes
  const mapping = resolveSet(inputSet);
  const tcgdexCode = mapping?.tcgdex || resolveToTcgdex(inputSet) || inputSet;

  // Optional FX prewarm/backfill to avoid API hammering during conversion
  if (opts?.backfillFxDays != null || opts?.prewarmFx) {
    try {
      await fxDaily({
        backfillDays: Number.isFinite(opts.backfillFxDays) ? opts.backfillFxDays : undefined,
        prewarm90d: opts.backfillFxDays == null,
        logger,
      });
    } catch (e) {
      logger.warn?.(`collectPrices: fxDaily prewarm failed: ${e?.message || e}`);
    }
  }

  // Providers selection
  let providers = Array.isArray(opts?.providers) && opts.providers.length
    ? opts.providers.map(s => String(s).toLowerCase())
    : ["tcgdex","ptcgio","ppt"];
  if (opts?.gapFillOnly && (!opts.providers || !opts.providers.length)) {
    // default gap-fill provider is PPT
    providers = ["ppt"];
  }

  // Preload FX once (will read cache or fetch 90d feed)
  const fx = await getFx({});
  const fxDate = fx.date;

  // Load cards for set
  const cards = await m_Card.findAll({
    where: { set_code: tcgdexCode },
    attributes: ["id", "number"],
    order: [["number", "ASC"]],
  });
  if (cards.length === 0) {
    return {
      ok: true,
      setCode: tcgdexCode,
      counts: {
        cards: 0,
        variants: 0,
        observations: { collected: 0, written: 0, byCardPct: 0 },
        latest: 0,
      },
      ms: Date.now() - started,
      notes: { fxDate, providersTried: [] },
    };
  }

  const numbers = cards.map((r) => r.get("number"));
  const byCardId = new Map(cards.map((r) => [r.get("id"), r]));
  const ids = cards.map((r) => r.get("id"));

  // Load variants for those cards
  const varRows = await m_CardVariant.findAll({
    where: { card_id: { [Op.in]: ids } },
    attributes: ["card_id", "variant"],
  });

  const variantsByNumber = groupVariantsByNumber(varRows);
  const variantsByCardId = groupVariantsByCardId(varRows);

  // --- Fetch from providers (conditional) ------------------------------------
  const providersTried = [];
  let obsDex = [], obsPtcg = [], obsPpt = [];
  if (providers.includes("tcgdex")) {
    providersTried.push("tcgdex");
    obsDex = await fetchPricesTCGdex({ set: tcgdexCode, cardNumbers: numbers, variantsByNumber }).catch(() => []);
  }
  if (providers.includes("ptcgio")) {
    providersTried.push("ptcgio");
    obsPtcg = await fetchPricesPTCGIO({ set: tcgdexCode, cardNumbers: numbers, variantsByNumber }).catch(() => []);
  }
  if (providers.includes("ppt")) {
    providersTried.push("ppt");
    obsPpt = await fetchPricesPPT({ set: tcgdexCode, cardNumbers: numbers, variantsByNumber }).catch(() => []);
  }

  // Normalize to canonical card_id (tcgdexCode-<number>) just in case adapters differed
  const normalizeId = (id) =>
    id.startsWith(`${tcgdexCode}-`) ? id : `${tcgdexCode}-${id.split("-").slice(1).join("-")}`;

  const rawObs = [...obsDex, ...obsPtcg, ...obsPpt].map((o) => ({
    card_id: normalizeId(o.card_id),
    variant: String(o.variant || "normal").toLowerCase(),
    currency: (o.currency || "USD").toUpperCase(),
    amount: o.amount != null ? Number(o.amount) : null,
    observed_at: toISO(o.observed_at),
    source: o.source || "unknown",
    meta: o.meta || null,
  }));

  // Filter to the set’s card IDs only (safety)
  const setIdPrefix = `${tcgdexCode}-`;
  const observations = rawObs.filter((o) => o.card_id.startsWith(setIdPrefix) && Number.isFinite(o.amount));

  // Optional since filter
  const sinceDate = normalizeDateStr(opts?.since);
  const observationsFiltered = sinceDate
    ? observations.filter((o) => (o.observed_at || "").slice(0, 10) >= sinceDate)
    : observations;

  // Convert to GBP and dedupe key: (card_id, variant, day, source)
  const dedupKey = (o) => `${o.card_id}::${o.variant}::${(o.observed_at || "").slice(0, 10)}::${o.source}`;
  const seen = new Set();
  const converted = [];
  for (const o of observationsFiltered) {
    const day = (o.observed_at || "").slice(0, 10) || fxDate;
    const gbp = await toGBP(o.amount, o.currency, { date: day, round: 4 });
    if (gbp == null) continue;
    const k = dedupKey(o);
    if (seen.has(k)) continue;
    seen.add(k);
    converted.push({
      card_id: o.card_id,
      variant: o.variant,
      day,
      amount_gbp: gbp,
      source: o.source,
    });
  }

  // Aggregate per-day per card/variant (market price = simple mean)
  const dailyAgg = aggregateDaily(converted);

  // === DRY-RUN path ==========================================================
  if (dryRun) {
    const coverage = dailyCoveragePct(ids, dailyAgg);
    return {
      ok: true,
      setCode: tcgdexCode,
      counts: {
        cards: cards.length,
        variants: varRows.length,
        observations: {
          collected: converted.length,
          written: 0,
          byCardPct: coverage,
        },
        latest: 0,
      },
      ms: Date.now() - started,
      notes: { fxDate, providersTried },
    };
  }

  // === WRITE path: upsert observations + latest ==============================
  const written = await sequelize.transaction(async (t) => {
    // 1) Upsert observations into m_PriceObservation
    //    Strategy: insert-or-ignore with a unique key on (card_id, variant, date, source)
    const rowsObs = dailyAgg.map(({ card_id, variant, day, price_gbp, source }) => ({
      card_id,
      variant,
      date: day,
      currency: "GBP",
      low: null,
      mid: price_gbp,
      high: null,
      market: price_gbp,
      provider: source,
    }));

    let wrote = 0;
    if (rowsObs.length) {
      await m_PriceObservation.bulkCreate(rowsObs, {
        transaction: t,
        ignoreDuplicates: true,
      });
      // count how many were actually new-ish: approximate by counting all rows we attempted
      wrote = rowsObs.length;
    }

    // 2) Refresh "latest" snapshot (one per card_id/variant)
    //    Strategy: compute the most recent day’s market and write to m_PriceLatest
    const latestByCv = new Map(); // key: card_id::variant
    for (const row of dailyAgg) {
      const k = `${row.card_id}::${row.variant}`;
      const cur = latestByCv.get(k);
      if (!cur || row.day > cur.day) latestByCv.set(k, row);
    }

    const latestRows = [];
    for (const [k, v] of latestByCv) {
      const [card_id, variant] = k.split("::");
      latestRows.push({
        card_id,
        variant,
        price_gbp: round2(v.amount_gbp),
        median_gbp: null,
        p10_gbp: null,
        p90_gbp: null,
        updated_at: new Date().toISOString(),
      });
    }

    if (latestRows.length) {
      await m_PriceLatest.bulkCreate(latestRows, {
        transaction: t,
        ignoreDuplicates: false,
        updateOnDuplicate: ["price_gbp", "median_gbp", "p10_gbp", "p90_gbp", "updated_at"],
      });
    }

    return { wrote, latest: latestRows.length };
  });

  const coveragePct = dailyCoveragePct(ids, dailyAgg);

  return {
    ok: true,
    setCode: tcgdexCode,
    counts: {
      cards: cards.length,
      variants: varRows.length,
      observations: { collected: converted.length, written: written.wrote, byCardPct: coveragePct },
      latest: written.latest,
    },
    ms: Date.now() - started,
    notes: { fxDate, providersTried },
  };
}

/* ========================================================================== *
 * Helpers
 * ========================================================================== */

function normalizeDateStr(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function toISO(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function aggregateDaily(rows) {
  // rows: { card_id, variant, day, amount_gbp, source }
  const map = new Map(); // key: card_id::variant::day
  for (const r of rows) {
    const k = `${r.card_id}::${r.variant}::${r.day}`;
    let list = map.get(k);
    if (!list) { list = []; map.set(k, list); }
    list.push(r.amount_gbp);
  }
  const out = [];
  for (const [k, list] of map) {
    const [card_id, variant, day] = k.split("::");
    const sum = list.reduce((a, b) => a + b, 0);
    const avg = sum / list.length;
    out.push({ card_id, variant, day, amount_gbp: avg, price_gbp: avg, source: "blend" });
  }
  return out;
}

function dailyCoveragePct(cardIds, dailyAgg) {
  const seenCards = new Set(dailyAgg.map((r) => r.card_id));
  const covered = Array.from(seenCards).filter((id) => cardIds.includes(id)).length;
  if (cardIds.length === 0) return 0;
  return Math.round((covered / cardIds.length) * 1000) / 10; // one decimal place
}

function groupVariantsByNumber(varRows) {
  // Input rows: { card_id, variant }, where card_id is like 'sv08-123'
  const byNum = new Map();
  for (const r of varRows) {
    const [set, num] = String(r.card_id).split("-");
    const list = byNum.get(num) || [];
    list.push(r.variant);
    byNum.set(num, list);
  }
  return byNum;
}

function groupVariantsByCardId(varRows) {
  const byId = new Map();
  for (const r of varRows) {
    const id = String(r.card_id);
    const list = byId.get(id) || [];
    list.push(r.variant);
    byId.set(id, list);
  }
  return byId;
}

/* ========================================================================== *
 * Optional CLI entrypoint guard (kept)
 * ========================================================================== */

const isDirect = (() => {
  try {
    const modulePath = fileURLToPath(import.meta.url);
    return process.argv[1] && fileURLToPath(process.argv[1]) === modulePath;
  } catch {
    return false;
  }
})();

if (isDirect) {
  (async () => {
    const arg = process.argv[2];
    const sinceArg = process.argv.find((a) => a.startsWith("--since="));
    const since = sinceArg ? sinceArg.split("=")[1] : undefined;
    const dryRun = process.argv.includes("--dry");
    if (!arg) {
      console.error("Usage: node collectPrices.job.js <abbr|tcgdex|ptcg> [--since=YYYY-MM-DD] [--dry]");
      process.exit(1);
    }
    try {
      const res = await collectPrices({ set: arg, since, dryRun, logger: console });
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    } catch (err) {
      console.error(err?.stack || String(err));
      process.exit(2);
    }
  })();
}

export default { collectPrices };
