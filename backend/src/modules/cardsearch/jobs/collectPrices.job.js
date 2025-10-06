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

import { Op } from "sequelize";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sequelize, m_Set, m_Card, m_CardVariant, m_PriceObservation, m_PriceLatest, m_PriceRollup } from "../../../models/index.js";
import { resolveSet, resolveToTcgdex } from "../services/setMapping.service.js";

import { fetchPricesTCGdex } from "../adapters/priceAdapter.tcgdex.service.js";
import { fetchPricesPTCGIO } from "../adapters/priceAdapter.ptcgio.service.js";
import { fetchPricesPPT } from "../adapters/priceAdapter.ppt.service.js";

import { toGBP, getFx } from "../services/fx.service.js";
import { fxDaily } from "./fxDaily.job.js";
import { normalizeAlertOptions } from "../../alerts/priceAlert.config.js";
import { evaluatePriceAlerts } from "../../../tasks/evaluatePriceAlerts.js";
import { rebuildRollupsForSet } from "../services/rollup.service.js";

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
 * @property {number}  [alertPctUp] - Optional override for percentage increase alerts
 * @property {number}  [alertPctDown] - Optional override for percentage decrease alerts
 * @property {boolean} [triggerAlerts=true] - Disable to skip alert evaluation
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

  const triggerAlerts = opts?.triggerAlerts !== false;
  const alertThresholds = normalizeAlertOptions({
    pctUp: opts?.alertPctUp,
    pctDown: opts?.alertPctDown,
  });

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
      alerts: null,
      ms: Date.now() - started,
      notes: { fxDate, providersTried: [], alertPctUp: alertThresholds.pctUp, alertPctDown: alertThresholds.pctDown },
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
  const rollupHints = await buildVendorRollupHints(observationsFiltered, { fxDate, toGBP });
  const latestPriceByKey = computeLatestPricesByKey(dailyAgg);

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
      alerts: null,
      ms: Date.now() - started,
      notes: { fxDate, providersTried, alertPctUp: alertThresholds.pctUp, alertPctDown: alertThresholds.pctDown },
    };
  }

  // === WRITE path: upsert observations + latest ==============================
  const written = await sequelize.transaction(async (t) => {
    // CHANGED: persist aggregated samples + latest snapshot in one helper
    if (!dailyAgg.length) {
      return { wrote: 0, latest: 0 };
    }

    let wrote = 0;
    const latestKeys = new Set();

    for (const row of dailyAgg) {
      const price = row.market ?? row.mid ?? row.amount_gbp ?? null;
      const rounded = price != null ? round2(price) : null;

      await savePriceSample({
        cardId: row.card_id,
        variant: row.variant,
        currency: "GBP",
        low: null,
        mid: rounded,
        high: null,
        market: rounded,
        provider: row.source || "blend",
        observedAt: row.day,
      }, { transaction: t });

      wrote += 1;
      latestKeys.add(`${row.card_id}::${row.variant}`);
    }

    if (rollupHints.size) {
      const nowIso = new Date().toISOString();
      for (const [key, windows] of rollupHints) {
        const [cardId, variantKey] = key.split('::');
        const latestEntry = latestPriceByKey.get(key);
        const lastValue = latestEntry ? latestEntry.value : null;
        for (const [days, avgValue] of windows) {
          if (avgValue == null) continue;
          await m_PriceRollup.upsert({
            card_id: cardId,
            variant: variantKey,
            days,
            avg_gbp: avgValue,
            min_gbp: null,
            max_gbp: null,
            last_gbp: lastValue,
            computed_at: nowIso,
          }, { transaction: t });
        }
      }
    }

    return { wrote, latest: latestKeys.size };
  });

  const coveragePct = dailyCoveragePct(ids, dailyAgg);

  let rollupInfo = null;
  if (!dryRun) {
    try {
      rollupInfo = await rebuildRollupsForSet(tcgdexCode, { asOf: fxDate });
    } catch (err) {
      logger.warn?.(`collectPrices: rollup rebuild failed: ${err?.message || err}`);
    }
  }

  let alertSummary = null;
  if (!dryRun && triggerAlerts) {
    try {
      const cardIdList = cards.map((c) => c.get('id'));
      if (cardIdList.length) {
        const evaluation = await evaluatePriceAlerts({
          cardIds: cardIdList,
          pctUp: alertThresholds.pctUp,
          pctDown: alertThresholds.pctDown,
        });
        alertSummary = { ...evaluation, thresholds: alertThresholds };
      }
    } catch (err) {
      logger.warn?.(`collectPrices: alert evaluation failed: ${err?.message || err}`);
    }
  }

  return {
    ok: true,
    setCode: tcgdexCode,
    counts: {
      cards: cards.length,
      variants: varRows.length,
      observations: { collected: converted.length, written: written.wrote, byCardPct: coveragePct },
      latest: written.latest,
    },
    alerts: alertSummary,
    rollups: rollupInfo,
    ms: Date.now() - started,
    notes: { fxDate, providersTried, alertPctUp: alertThresholds.pctUp, alertPctDown: alertThresholds.pctDown },
  };
}

/* ========================================================================== *
 * Helpers
 * ========================================================================== */

// NEW: append observations and latest snapshots consistently
async function savePriceSample({
  cardId,
  variant,
  currency,
  low,
  mid,
  high,
  market,
  provider,
  observedAt,
}, { transaction } = {}) {
  const v = String(variant || "normal").toLowerCase();
  const observed = observedAt ? new Date(observedAt) : new Date();
  const amount = market ?? mid ?? low ?? high ?? null;
  if (amount == null) return;

  await m_PriceObservation.create({
    card_id: cardId,
    variant: v,
    source: provider || "unknown",
    currency: (currency || "GBP").toUpperCase(),
    amount,
    amount_gbp: amount,
    observed_at: observed,
  }, { transaction });

  const now = new Date();
  await m_PriceLatest.upsert({
    card_id: cardId,
    variant: v,
    price_gbp: amount,
    median_gbp: mid ?? amount,
    p10_gbp: low ?? (mid ?? amount),
    p90_gbp: high ?? (mid ?? amount),
    updated_at: now,
  }, { transaction });
}

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
    const rounded = round2(avg);
    out.push({ card_id, variant, day, amount_gbp: avg, mid: rounded, market: rounded, source: "blend" });
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

async function buildVendorRollupHints(observations, { fxDate, toGBP }) {
  const out = new Map();
  if (!Array.isArray(observations) || observations.length === 0) return out;
  for (const obs of observations) {
    const windows = await extractObservationRollupWindows(obs, { fxDate, toGBP });
    if (!windows || windows.size === 0) continue;
    const key = `${obs.card_id}::${obs.variant}`;
    let entry = out.get(key);
    if (!entry) {
      entry = new Map();
      out.set(key, entry);
    }
    for (const [days, value] of windows) {
      if (!entry.has(days) && value != null) {
        entry.set(days, value);
      }
    }
  }
  return out;
}

async function extractObservationRollupWindows(obs, { fxDate, toGBP }) {
  const meta = obs?.meta;
  if (!meta || typeof meta !== 'object') return null;
  const currency = (obs?.currency || 'USD').toUpperCase();
  const source = String(obs?.source || '').toLowerCase();
  const day = (obs?.observed_at || '').slice(0, 10) || fxDate;
  if (!day) return null;
  const windows = new Map();

  async function addWindow(days, ...keys) {
    for (const key of keys) {
      if (!key) continue;
      const raw = meta[key];
      if (raw == null) continue;
      const num = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(num)) continue;
      const gbp = await toGBP(num, currency, { date: day, round: 4 });
      if (gbp == null) continue;
      windows.set(days, round2(gbp));
      break;
    }
  }

  if (source.includes('cardmarket')) {
    const suffix = resolveCardmarketSuffix(meta, obs?.variant);
    await addWindow(1, suffix ? `avg1${suffix}` : 'avg1');
    await addWindow(7, suffix ? `avg7${suffix}` : 'avg7');
    await addWindow(30, suffix ? `avg30${suffix}` : 'avg30', suffix ? `avg${suffix}` : 'avg', suffix ? `trend${suffix}` : 'trend');
    await addWindow(90, suffix ? `avg90${suffix}` : 'avg90', suffix ? `avg${suffix}` : 'avg', suffix ? `trend${suffix}` : 'trend');
  } else if (source.includes('tcgplayer')) {
    await addWindow(1, 'market', 'low', 'directLow');
    await addWindow(7, 'avg7', 'market');
    await addWindow(30, 'avg30', 'market');
    await addWindow(90, 'avg90', 'avg30', 'market');
  } else if (source.includes('ppt')) {
    await addWindow(1, 'day1', 'today', 'market');
    await addWindow(7, 'day7', 'avg7');
    await addWindow(30, 'day30', 'avg30');
    await addWindow(90, 'day90', 'avg90');
  }

  return windows.size ? windows : null;
}

function resolveCardmarketSuffix(meta, variant) {
  const v = String(variant || '').toLowerCase();
  if (!v || v === 'normal') return '';
  const candidates = {
    reverse: ['-holo', '-reverse'],
    holo: ['-holo'],
    foil: ['-foil'],
    firstedition: ['-firstEdition', '-firstedition', '-1stedition'],
  };
  const options = candidates[v] || [];
  for (const suffix of options) {
    if (cardmarketHasMetaKey(meta, suffix)) return suffix;
  }
  return options[0] || '';
}

function cardmarketHasMetaKey(meta, suffix) {
  if (!suffix) return false;
  const baseKeys = ['avg', 'avg1', 'avg7', 'avg30', 'avg90', 'trend'];
  return baseKeys.some((key) => meta[`${key}${suffix}`] != null);
}

function computeLatestPricesByKey(rows) {
  const out = new Map();
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    const key = `${row.card_id}::${row.variant}`;
    const prev = out.get(key);
    const currentDay = row.day || null;
    if (!prev || (currentDay || '') > (prev.day || '')) {
      const value = row.market ?? row.mid ?? row.amount_gbp ?? null;
      out.set(key, { day: currentDay, value: value != null ? round2(value) : null });
    }
  }
  return out;
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
    const alertUpArg = process.argv.find((a) => a.startsWith("--alert-pct-up="));
    const alertDownArg = process.argv.find((a) => a.startsWith("--alert-pct-down="));
    const noAlerts = process.argv.includes("--no-alerts");
    const since = sinceArg ? sinceArg.split("=")[1] : undefined;
    const dryRun = process.argv.includes("--dry");
    if (!arg) {
      console.error("Usage: node collectPrices.job.js <abbr|tcgdex|ptcg> [--since=YYYY-MM-DD] [--dry] [--alert-pct-up=N] [--alert-pct-down=N] [--no-alerts]");
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
