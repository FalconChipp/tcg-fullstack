// src/modules/marketdata2/ingest-set.mjs
// NEW: CLI convenience for first-run ingest from live TCGdex (and optional pricing).
//
// Usage examples:
//   node modules/marketdata2/ingest-set.mjs --set=sv08                 # default mode = both
//   node modules/marketdata2/ingest-set.mjs --set=sv08 --mode=set      # metadata/cards only (cache create/update)
//   node modules/marketdata2/ingest-set.mjs --set=sv08 --mode=pricing  # pricing only (requires cache exists)
//   node modules/marketdata2/ingest-set.mjs --set=sv08 --mode=both     # ingest then pricing
//
// Notes:
// - No live provider calls occur here directly; we delegate to jobs/services.
// - “Set” mode hits TCGdex (via setAdapter) and writes/updates the per-set JSON cache
//   under data\marketdata\sets\<era>\<setCode>.json (matching your existing structure).
// - “Pricing” mode runs the TCGdex → PTCG.io → PPT pipeline for that set,
//   writes observations (day-unique), updates latest, and runs rollups.
// - Prints a concise JSON result to STDOUT for CI logs.
//
// Exit codes:
//   0 = ok, 1 = usage error, 2 = runtime error.
//
// IMPORTANT: Adjust the bootstrap import path if your app initializes models/env differently.

import path from 'node:path';
import process from 'node:process';

// Ensure environment + Sequelize models are bootstrapped.
// If your project uses a different bootstrap path, update this import accordingly.
import '../../src/bootstrap.js';

// Jobs for set ingest and pricing (new module-local jobs)
import { default as ingestSetJob } from './jobs/ingestSet.job.js';
import { default as collectPricesJob } from './jobs/collectPrices.job.js';

function parseArgs(argv) {
  const out = { setCode: '', mode: 'both' };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--set=')) out.setCode = arg.slice(6).trim();
    else if (arg.startsWith('--mode=')) out.mode = arg.slice(7).trim().toLowerCase();
    else if (arg === '-s') out.setCode = argv[argv.indexOf(arg) + 1] || out.setCode;
    else if (arg === '-m') out.mode = (argv[argv.indexOf(arg) + 1] || out.mode).toLowerCase();
  }
  return out;
}

function ensureMode(mode) {
  const allowed = new Set(['set', 'pricing', 'both']);
  if (!allowed.has(mode)) {
    throw new Error(`Invalid --mode value: "${mode}". Allowed: set | pricing | both`);
  }
}

async function main() {
  const { setCode, mode } = parseArgs(process.argv);

  if (!setCode) {
    console.error('Usage: node modules/marketdata2/ingest-set.mjs --set=<setCode> [--mode=set|pricing|both]');
    process.exit(1);
  }
  ensureMode(mode);

  const startedAt = new Date().toISOString();
  const runId = `ingest:${setCode}:${Date.now()}`;

  const summary = {
    ok: true,
    runId,
    setCode,
    mode,
    startedAt,
    finishedAt: null,
    steps: [],
  };

  try {
    if (mode === 'set' || mode === 'both') {
      // STEP 1: Ingest/refresh set metadata + cards from live TCGdex;
      //         create/update the per-set JSON cache and index.
      const r = await ingestSetJob.run({ setCode, runId });
      summary.steps.push({ step: 'ingestSet', ...r });
    }

    if (mode === 'pricing' || mode === 'both') {
      // STEP 2: Pricing pipeline (TCGdex → PTCG.io → PPT) using cached card list;
      //         writes observations (day-unique), updates latest, runs rollups.
      const r = await collectPricesJob.run({ setCode, runId });
      summary.steps.push({ step: 'collectPrices', ...r });
    }

    summary.finishedAt = new Date().toISOString();
    // Pretty-print for CI logs
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  } catch (err) {
    summary.ok = false;
    summary.error = String(err?.message || err);
    summary.finishedAt = new Date().toISOString();
    console.error(JSON.stringify(summary, null, 2));
    process.exit(2);
  }
}

main();
