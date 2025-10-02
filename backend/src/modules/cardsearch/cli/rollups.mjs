#!/usr/bin/env node
// src/modules/cardsearch/cli/rollups.mjs
// Rebuild 1/7/30/90 rollups (global, by set, or for one card/variant).
// Examples:
//   node rollups.mjs                 # global
//   node rollups.mjs --set sv08      # by set
//   node rollups.mjs --card sv08-123 --variant normal
//   node rollups.mjs --asOf 2025-10-01 --batch 500

import { fileURLToPath } from "node:url";
import path from "node:path";
import { priceRollup } from "../jobs/priceRollup.job.js";
import { getLogger } from "../services/logging.service.js";

const __filename = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  const out = {
    set: null,
    card: null,
    variant: null,
    asOf: null,
    batch: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--set" && argv[i + 1]) { out.set = argv[++i]; continue; }
    if (a === "--card" && argv[i + 1]) { out.card = argv[++i]; continue; }
    if (a === "--variant" && argv[i + 1]) { out.variant = argv[++i]; continue; }
    if (a === "--asOf" && argv[i + 1]) { out.asOf = argv[++i]; continue; }
    if ((a === "--batch" || a === "--batch-size") && argv[i + 1]) { out.batch = parseInt(argv[++i], 10); continue; }
    if (a === "--help" || a === "-h") { out.help = true; break; }
  }
  return out;
}

function usage() {
  console.log(`Usage:
  node ${path.basename(__filename)} [--set <abbr|tcgdex|ptcg|name>]
                                   [--card <set-number>] [--variant <key>]
                                   [--asOf YYYY-MM-DD] [--batch <n>]
Notes:
  • If --card is provided, that scope wins; otherwise --set; else global.
`);
}

(async () => {
  const args = parseArgs(process.argv);
  if (args.help) { usage(); process.exit(0); }

  const logger = getLogger("cardsearch").child({ cli: "rollups" });

  try {
    let res;
    if (args.card) {
      res = await priceRollup({
        cardId: args.card,
        variant: args.variant || "normal",
        asOf: args.asOf || undefined,
        batchSize: Number.isFinite(args.batch) ? args.batch : undefined,
        logger,
      });
    } else if (args.set) {
      res = await priceRollup({
        set: args.set,
        asOf: args.asOf || undefined,
        batchSize: Number.isFinite(args.batch) ? args.batch : undefined,
        logger,
      });
    } else {
      res = await priceRollup({
        asOf: args.asOf || undefined,
        batchSize: Number.isFinite(args.batch) ? args.batch : undefined,
        logger,
      });
    }

    console.log(JSON.stringify({ ok: true, input: args, result: res }, null, 2));
    process.exit(0);
  } catch (err) {
    logger.error(err);
    console.error(JSON.stringify({ ok: false, error: err?.message || String(err) }, null, 2));
    process.exit(2);
  }
})();
