#!/usr/bin/env node
// src/modules/cardsearch/cli/fx-fetch.mjs
// Fetch/Backfill ECB FX and store in local cache/DB as your fx.service expects.
// Examples:
//   node fx-fetch.mjs
//   node fx-fetch.mjs --backfill 30
//   node fx-fetch.mjs --from 2025-07-01 --to 2025-10-01

import { fileURLToPath } from "node:url";
import path from "node:path";
import { fxDaily } from "../jobs/fxDaily.job.js";
import { getLogger } from "../services/logging.service.js";

const __filename = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  const out = { backfill: undefined, from: null, to: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if ((a === "--backfill" || a === "--days") && argv[i + 1]) { out.backfill = parseInt(argv[++i], 10); continue; }
    if (a === "--from" && argv[i + 1]) { out.from = argv[++i]; continue; }
    if (a === "--to" && argv[i + 1]) { out.to = argv[++i]; continue; }
    if (a === "--help" || a === "-h") { out.help = true; break; }
  }
  return out;
}

function usage() {
  console.log(`Usage:
  node ${path.basename(__filename)} [--backfill <days>] [--from YYYY-MM-DD --to YYYY-MM-DD]
Notes:
  • Use --backfill to fetch the last N days from today (UTC).
  • Or specify an explicit range with --from/--to (inclusive).
`);
}

(async () => {
  const args = parseArgs(process.argv);
  if (args.help) { usage(); process.exit(0); }

  const logger = getLogger("cardsearch").child({ cli: "fx-fetch" });

  try {
    const res = await fxDaily({
      backfillDays: Number.isFinite(args.backfill) ? args.backfill : undefined,
      rangeFrom: args.from || undefined,
      rangeTo: args.to || undefined,
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
