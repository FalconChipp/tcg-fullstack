#!/usr/bin/env node
// src/modules/cardsearch/cli/ingest-set.mjs
// Ingest a set from TCGdex into local DB (m_Set, m_Card, m_CardVariant).
// Examples:
//   node ingest-set.mjs --set sv08
//   node ingest-set.mjs --set SSP --refresh
//   node ingest-set.mjs --set sv08 --dry

import { fileURLToPath } from "node:url";
import path from "node:path";
import { ingestSet } from "../jobs/ingestSet.job.js";
import { getLogger } from "../services/logging.service.js";

const __filename = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  const out = { set: null, refresh: false, dry: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--set" && argv[i + 1]) { out.set = argv[++i]; continue; }
    if (a === "--refresh") { out.refresh = true; continue; }
    if (a === "--dry" || a === "--dry-run") { out.dry = true; continue; }
    if (a === "--help" || a === "-h") { out.help = true; break; }
  }
  return out;
}

function usage() {
  console.log(`Usage:
  node ${path.basename(__filename)} --set <abbr|tcgdex|ptcg|name> [--refresh] [--dry]
`);
}

(async () => {
  const args = parseArgs(process.argv);
  if (args.help || !args.set) { usage(); process.exit(args.help ? 0 : 1); }

  const logger = getLogger("cardsearch").child({ cli: "ingest-set" });

  try {
    const res = await ingestSet({
      input: args.set,
      refresh: !!args.refresh,
      dryRun: !!args.dry,
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
