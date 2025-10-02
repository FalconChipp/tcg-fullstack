#!/usr/bin/env node
// src/modules/cardsearch/cli/collect-prices.mjs
// Run the Collect Prices job for a given set (TCGdex/abbr/ptcg/name).
// Examples:
//   node collect-prices.mjs --set sv08
//   node collect-prices.mjs --set SSP --since 2025-09-01 --prewarm-fx --backfill-fx-days 30 --pause-ms 250
//   node collect-prices.mjs --set sv08 --dry

import { fileURLToPath } from "node:url";
import path from "node:path";
import { collectPrices } from "../jobs/collectPrices.job.js";
import { getLogger } from "../services/logging.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const out = {
    set: null,
    since: null,
    prewarmFx: true,
    backfillFxDays: undefined,
    pauseMs: undefined,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--set" && argv[i + 1]) { out.set = argv[++i]; continue; }
    if (a === "--since" && argv[i + 1]) { out.since = argv[++i]; continue; }
    if (a === "--prewarm-fx") { out.prewarmFx = true; continue; }
    if (a === "--no-prewarm-fx") { out.prewarmFx = false; continue; }
    if ((a === "--backfill-fx-days" || a === "--fx-days") && argv[i + 1]) {
      out.backfillFxDays = parseInt(argv[++i], 10);
      continue;
    }
    if ((a === "--pause-ms" || a === "--delay") && argv[i + 1]) {
      out.pauseMs = parseInt(argv[++i], 10);
      continue;
    }
    if (a === "--dry" || a === "--dry-run") { out.dryRun = true; continue; }
    if (a === "--help" || a === "-h") { out.help = true; break; }
  }
  return out;
}

function usage() {
  console.log(`Usage:
  node ${path.basename(__filename)} --set <abbr|tcgdex|ptcg|name> [--since YYYY-MM-DD]
                                    [--prewarm-fx|--no-prewarm-fx]
                                    [--backfill-fx-days <n>] [--pause-ms <n>] [--dry]
`);
}

(async () => {
  const args = parseArgs(process.argv);
  if (args.help || !args.set) { usage(); process.exit(args.help ? 0 : 1); }

  const logger = getLogger("cardsearch").child({ cli: "collect-prices" });

  try {
    const res = await collectPrices({
      set: args.set,
      since: args.since || null,
      prewarmFx: args.prewarmFx,
      backfillFxDays: Number.isFinite(args.backfillFxDays) ? args.backfillFxDays : undefined,
      pauseMs: Number.isFinite(args.pauseMs) ? args.pauseMs : undefined,
      dryRun: !!args.dryRun,
      logger,
    });
    console.log(JSON.stringify({ ok: true, input: args, result: res }, null, 2));
    process.exit(0);
  } catch (err) {
    logger.error(err);
    console.error(JSON.stringify({ ok: false, error: err?.message || String(err) }, null, 2));
    process.exit(2);
  }
})();
