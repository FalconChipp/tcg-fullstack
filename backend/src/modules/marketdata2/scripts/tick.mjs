// backend/modules/marketdata2/scripts/tick.mjs
// PURPOSE
// - Trigger a single scheduler tick manually (useful for CI or admin tooling).
// - Modes: metadata | pricing | patch
// - Patch can optionally be scoped to a set via --set=<code>.
//
// Usage examples:
//   node modules/marketdata2/scripts/tick.mjs --mode=metadata
//   node modules/marketdata2/scripts/tick.mjs --mode=pricing
//   node modules/marketdata2/scripts/tick.mjs --mode=patch
//   node modules/marketdata2/scripts/tick.mjs --mode=patch --set=sv08
//   node modules/marketdata2/scripts/tick.mjs --mode=patch --stale=72 --max=300
//
// Exit codes:
//   0 = ok, 1 = usage error, 2 = runtime error
//
// Notes:
// - This script delegates to services/scheduler.service.js tick functions.
// - It bootstraps your app (env/models) just like other CLIs in the repo.
// - Output is a single JSON object summary printed to STDOUT.

import process from 'node:process';

// Ensure app env/models are initialized (adjust path to your project bootstrap if needed)
import '../../../src/bootstrap.js';

import {
  metadataTick,
  pricingTick,
  patchTick,
} from '../services/scheduler.service.js';

function parseArgs(argv) {
  const out = {
    mode: 'metadata',   // metadata | pricing | patch
    setCode: null,      // for patch mode
    stale: null,        // hours for staleness in patch mode
    max: null,          // candidate cap in patch mode
    lang: process.env.MD2_LANG || 'en',
  };

  const a = argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    const arg = a[i];

    if (arg.startsWith('--mode=')) out.mode = arg.slice(7).trim().toLowerCase();
    else if (arg === '--mode') out.mode = (a[++i] || '').trim().toLowerCase();

    else if (arg.startsWith('--set=')) out.setCode = arg.slice(6).trim();
    else if (arg === '--set') out.setCode = (a[++i] || '').trim();

    else if (arg.startsWith('--stale=')) out.stale = Number(a[i].split('=')[1]);
    else if (arg === '--stale') out.stale = Number(a[++i] || '');

    else if (arg.startsWith('--max=')) out.max = Number(a[i].split('=')[1]);
    else if (arg === '--max') out.max = Number(a[++i] || '');

    else if (arg.startsWith('--lang=')) out.lang = arg.slice(7).trim();
    else if (arg === '--lang') out.lang = (a[++i] || '').trim();
  }

  return out;
}

function ensureMode(mode) {
  const allowed = new Set(['metadata', 'pricing', 'patch']);
  if (!allowed.has(mode)) throw new Error(`Invalid --mode "${mode}". Use: metadata | pricing | patch`);
}

async function main() {
  const args = parseArgs(process.argv);
  const { mode, setCode, stale, max, lang } = args;

  try {
    ensureMode(mode);
  } catch (e) {
    console.error('Usage: node modules/marketdata2/scripts/tick.mjs --mode=metadata|pricing|patch [--set=<code>] [--stale=<hours>] [--max=<n>] [--lang=en]');
    process.exit(1);
  }

  const startedAt = new Date().toISOString();
  const runId = `tick:${mode}:${setCode || 'global'}:${Date.now()}`;

  const summary = {
    ok: true,
    runId,
    mode,
    setCode: setCode || null,
    lang,
    startedAt,
    finishedAt: null,
    result: null,
  };

  try {
    let res;
    if (mode === 'metadata') {
      // metadataTick uses env-configured batch size; lang is passed through for provider locale
      res = await metadataTick({ lang });
    } else if (mode === 'pricing') {
      res = await pricingTick({ lang });
    } else {
      // patch mode: optionally scoped to a set, with overrides
      const opts = {};
      if (setCode) opts.setCode = setCode;
      if (Number.isFinite(stale) && stale > 0) opts.staleHours = stale;
      if (Number.isFinite(max) && max > 0) opts.maxCandidates = max;
      res = await patchTick(opts);
    }

    summary.result = res;
    summary.ok = !!res?.ok;
    summary.finishedAt = new Date().toISOString();

    // Print concise JSON summary (full results still included under "result")
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
