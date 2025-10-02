#!/usr/bin/env node
// src/modules/cardsearch/cli/patch-gaps.mjs
// Patch observation gaps by re-querying the PPT adapter (or your chosen gap filler)
// and upserting any missing points. This is a thin wrapper over collectPrices,
// running it in "gap-fill" mode focusing on PPT.
// Examples:
//   node patch-gaps.mjs --set sv08
//   node patch-gaps.mjs --set SSP --since 2025-08-01 --backfill-fx-days 7

import { fileURLToPath } from "node:url";
import path from "node:path";
import { collectPrices } from "../jobs/collectPrices.job.js";
import { getLogger } from "../services/logging.service.js";

const __filename = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  const out = {
    set: null,
    since: null,
    backfillFxDays: undefined,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--set" && argv[i + 1]) { out.set = argv[++i]; continue; }
    if (a === "--since" && argv[i + 1]) { out.since = argv[++i]; continue; }
    if ((a === "--backfill-fx-days" || a === "--fx-days") && argv[i + 1]) {
      out.backfillFxDays = parseInt(argv[++i], 10);
      continue;
    }
    if (a === "--help" || a === "-h") { out.help = true; break; }
  }
  return out;
}

function usage() {
  console.log(`Usage:
  node ${path.basename(__filename)} --set <abbr|tcgdex|ptcg|name> [--since YYYY-MM-DD] [--backfill-fx-days <n>]
Notes:
  • This CLI runs collectPrices in gap-fill mode, prioritising the PPT adapter.
`);
}

(async () => {
  const args = parseArgs(process.argv);
  if (args.help || !args.set) { usage(); process.exit(args.help ? 0 : 1); }

  const logger = getLogger("cardsearch").child({ cli: "patch-gaps" });

  try {
    // We call collectPrices with gapFillOnly + providers=['ppt'].
    // If your job signature differs, adjust accordingly in one place here.
    const res = await collectPrices({
      set: args.set,
      since: args.since || null,
      prewarmFx: true,
      backfillFxDays: Number.isFinite(args.backfillFxDays) ? args.backfillFxDays : undefined,
      gapFillOnly: true,
      providers: ["ppt"],
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
