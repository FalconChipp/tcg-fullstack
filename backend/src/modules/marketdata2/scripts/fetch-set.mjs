// backend/modules/marketdata2/scripts/fetch-set.mjs
// PURPOSE
// - Simple CLI wrapper to fetch a set: metadata-only, pricing-only, or both.
// - Delegates to jobs in marketdata2 (ingestSet / collectPrices / collectBoth).
//
// Usage:
//   node modules/marketdata2/scripts/fetch-set.mjs --set=sv08              # default mode=both
//   node modules/marketdata2/scripts/fetch-set.mjs --set=sv08 --mode=set
//   node modules/marketdata2/scripts/fetch-set.mjs --set=sv08 --mode=pricing
//   node modules/marketdata2/scripts/fetch-set.mjs --set=sv08 --mode=both --lang=en
//
// Exit codes: 0 ok, 1 usage, 2 runtime.
//
// NOTES:
// - This is separate from modules/marketdata2/ingest-set.mjs; both are handy.
// - Adjust the bootstrap import below if your env/models init differently.

import process from 'node:process';

// Ensure app env/models are initialized (adjust path to your project bootstrap if needed)
import '../../../src/bootstrap.js';

import ingestSetJob from '../jobs/ingestSet.job.js';
import collectPricesJob from '../jobs/collectPrices.job.js';
import collectBothJob from '../jobs/collectBoth.job.js';

function parseArgs(argv) {
  const out = { setCode: '', mode: 'both', lang: process.env.MD2_LANG || 'en' };
  const a = argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    const arg = a[i];
    if (arg.startsWith('--set=')) out.setCode = arg.slice(6).trim();
    else if (arg === '--set') out.setCode = (a[i + 1] || '').trim(), i++;
    else if (arg.startsWith('--mode=')) out.mode = arg.slice(7).trim().toLowerCase();
    else if (arg === '--mode') out.mode = (a[i + 1] || '').trim().toLowerCase(), i++;
    else if (arg.startsWith('--lang=')) out.lang = arg.slice(7).trim();
    else if (arg === '--lang') out.lang = (a[i + 1] || '').trim(), i++;
  }
  return out;
}

function ensureMode(mode) {
  const allowed = new Set(['set', 'pricing', 'both']);
  if (!allowed.has(mode)) throw new Error(`Invalid --mode "${mode}". Use: set | pricing | both`);
}

async function main() {
  const { setCode, mode, lang } = parseArgs(process.argv);

  if (!setCode) {
    console.error('Usage: node modules/marketdata2/scripts/fetch-set.mjs --set=<setCode> [--mode=set|pricing|both] [--lang=en]');
    process.exit(1);
  }
  ensureMode(mode);

  const runId = `cli:${mode}:${setCode}:${Date.now()}`;
  const startedAt = new Date().toISOString();

  const summary = {
    ok: true,
    runId,
    setCode,
    mode,
    lang,
    startedAt,
    finishedAt: null,
    result: null,
  };

  try {
    let res;
    if (mode === 'both') {
      res = await collectBothJob.run({ setCode, runId, lang });
    } else if (mode === 'set') {
      res = await ingestSetJob.run({ setCode, runId, lang });
    } else {
      res = await collectPricesJob.run({ setCode, runId, lang });
    }
    summary.result = res;
    summary.ok = !!res?.ok;
    summary.finishedAt = new Date().toISOString();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.ok ? 0 : 2);
  } catch (err) {
    summary.ok = false;
    summary.error = String(err?.message || err);
    summary.finishedAt = new Date().toISOString();
    console.error(JSON.stringify(summary, null, 2));
    process.exit(2);
  }
}

main();
