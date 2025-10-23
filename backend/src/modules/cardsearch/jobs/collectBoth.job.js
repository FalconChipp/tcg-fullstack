// src/modules/cardsearch/jobs/collectBoth.job.js
// Orchestrate: ingest set (TCGdex) -> collect prices (TCGdex/PTCG.io/PPT) -> done.

import { fileURLToPath } from "node:url";

import { resolveSet, resolveToTcgdex } from "../services/setMapping.service.js";
import { ingestSet } from "./ingestSet.job.js";
import { collectPrices } from "./collectPrices.job.js";
import { fxDaily } from "./fxDaily.job.js";

/**
 * @typedef {Object} CollectBothOptions
 * @property {string|string[]} sets
 * @property {boolean} [refreshSet=false]
 * @property {string}  [since]
 * @property {boolean} [prewarmFx=true]
 * @property {number}  [backfillFxDays]
 * @property {boolean} [dryRun=false]
 * @property {number}  [pauseMs=400]
 * @property {number}  [alertPctUp]
 * @property {number}  [alertPctDown]
 * @property {boolean} [triggerAlerts=true]
 * @property {{log:Function,warn:Function,error:Function}} [logger=console]
 */
export async function collectBoth(opts) {
  const started = Date.now();
  const logger = opts?.logger ?? console;
  const dryRun = !!opts?.dryRun;
  const refreshSet = !!opts?.refreshSet;
  const pauseMs = Number.isFinite(opts?.pauseMs) ? Math.max(0, Number(opts.pauseMs)) : 400;
  const triggerAlerts = opts?.triggerAlerts !== false;
  const alertPctUp = opts?.alertPctUp;
  const alertPctDown = opts?.alertPctDown;

  const inputSets = Array.isArray(opts?.sets) ? opts.sets : [String(opts?.sets ?? "").trim()];
  const cleanSets = inputSets.map((s) => String(s || "").trim()).filter(Boolean);
  if (cleanSets.length === 0) throw new Error("collectBoth: 'sets' is required.");

  let fxInfo = null;
  if (opts?.prewarmFx !== false) {
    try {
      if (Number.isInteger(opts?.backfillFxDays) && opts.backfillFxDays > 0) {
        fxInfo = await fxDaily({ backfillDays: opts.backfillFxDays, logger });
      } else {
        fxInfo = await fxDaily({ prewarm90d: true, logger });
      }
    } catch (err) {
      logger.warn?.(`collectBoth: FX prewarm failed: ${err?.message || String(err)}`);
    }
  }

  const perSet = [];
  let totalCards = 0;
  let totalVariants = 0;
  let totalObsCollected = 0;
  let totalObsWritten = 0;
  let totalLatestUpserts = 0;
  let totalAlertsTriggered = 0;

  for (const raw of cleanSets) {
    const mapping = resolveSet(raw);
    const tcgdexCode = mapping?.tcgdex || resolveToTcgdex(raw) || raw;

    const setStart = Date.now();

    let ingestRes = null; 
    let pricesRes = null; 
    try {
      ingestRes = await ingestSet({
        input: tcgdexCode,
        refresh: refreshSet,
        dryRun,
        logger,
      });
      await sleep(pauseMs);
      pricesRes = await collectPrices({
        set: tcgdexCode,
        since: opts?.since, 
        dryRun,
        alertPctUp, 
        alertPctDown,
        triggerAlerts, 
        logger, 
      }); 
    } catch (err) {
      logger.error?.(`collectBoth: set ${tcgdexCode} failed: ${err?.message || err}`)
    }

    totalCards          += pricesRes?.counts?.cards || 0;
    totalVariants       += pricesRes?.counts?.variants || 0;
    totalObsCollected   += pricesRes?.counts?.observations?.collected || 0;
    totalObsWritten     += pricesRes?.counts?.observations?.written   || 0;
    totalLatestUpserts  += Number(pricesRes?.counts?.latest) || 0;
    totalAlertsTriggered += pricesRes?.alerts?.triggered || 0;

    perSet.push({
      set: tcgdexCode,
      ingest: ingestRes,
      prices: pricesRes,
      alerts: pricesRes.alerts || null,
      ms: Date.now() - setStart,
    });

    await sleep(pauseMs);
  }

  return {
    ok: true,
    ranAt: new Date().toISOString(),
    totals: {
      sets: cleanSets.length,
      cards: totalCards,
      variants: totalVariants,
      obsCollected: totalObsCollected,
      obsWritten: totalObsWritten,
      latestUpserts: totalLatestUpserts,
      alertsTriggered: totalAlertsTriggered,
    },
    fx: fxInfo
      ? {
          mode: fxInfo.mode,
          date: fxInfo.fxDate,
          attempted: fxInfo.counts?.attempted ?? null,
          written: fxInfo.counts?.written ?? null,
        }
      : null,
    perSet,
    ms: Date.now() - started,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- CLI ---
const isDirect = (() => {
  try {
    return (process.argv[1] || "") === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isDirect) {
  (async () => {
    const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
    const sinceArg = process.argv.find((a) => a.startsWith("--since="));
    const alertUpArg = process.argv.find((a) => a.startsWith("--alert-pct-up="));
    const alertDownArg = process.argv.find((a) => a.startsWith("--alert-pct-down="));
    const noAlerts = process.argv.includes("--no-alerts");
    const since = sinceArg ? sinceArg.split("=")[1] : undefined;
    const refresh = process.argv.includes("--refresh");
    const noPrewarm = process.argv.includes("--no-prewarm");
    const backfillArg = process.argv.find((a) => a.startsWith("--backfillFx="));
    const backfillFxDays = backfillArg ? Number(backfillArg.split("=")[1]) : undefined;

    if (args.length === 0) {
      console.error("Usage: node collectBoth.job.js <set...> [--refresh] [--since=YYYY-MM-DD] [--no-prewarm] [--backfillFx=N] [--alert-pct-up=N] [--alert-pct-down=N] [--no-alerts]");
      process.exit(1);
    }

    try {
      const res = await collectBoth({
        sets: args,
        refreshSet: refresh,
        since,
        prewarmFx: !noPrewarm,
        backfillFxDays,
        alertPctUp: alertUpArg ? Number(alertUpArg.split("=")[1]) : undefined,
        alertPctDown: alertDownArg ? Number(alertDownArg.split("=")[1]) : undefined,
        triggerAlerts: !noAlerts,
        logger: console,
      });
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    } catch (err) {
      console.error(err?.stack || String(err));
      process.exit(2);
    }
  })();
}

export default { collectBoth };
