#!/usr/bin/env node
// scripts/marketdata/add-set.mjs
// NEW: One-shot pipeline: ingest -> collect -> rollup -> latest.
// Usage: node scripts/marketdata/add-set.mjs --set=sv08 [--no-collect] [--no-rollup]

import process from "node:process";
import minimist from "minimist";
import { sequelize, m_Set } from "../../src/models/index.js";
import { ingestSet } from "../../src/modules/marketdata/jobs/ingestSet.job.js";
import { collectPricesForSet } from "../../src/modules/marketdata/jobs/priceCollect.job.js";
import { rollupDaily, computeWindowsAndLatest } from "../../src/modules/marketdata/services/pricing.service.js";

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const argv = minimist(process.argv.slice(2));
  const setCode = argv.set || argv.s;
  if (!setCode) {
    console.error("ERROR: --set=<code> is required (e.g. sv08, sv10.5w)");
    process.exit(1);
  }
  const doCollect = argv.collect !== false && argv["no-collect"] !== true;
  const doRollup  = argv.rollup  !== false && argv["no-rollup"]  !== true;

  console.log(`[add-set] Ingesting set ${setCode}…`);
  const ing = await ingestSet({ setCode });
  console.log(`[add-set] Ingested summary:`, ing?.summary ?? ing);

  const row = await m_Set.findOne({ where: { code: setCode }, raw: true });
  if (!row) {
    console.error("[add-set] FATAL: m_sets row missing after ingest; scheduler cannot include it.");
    process.exit(2);
  }

  if (doCollect) {
    console.log(`[add-set] Collecting prices for ${setCode}…`);
    const col = await collectPricesForSet({ setCode });
    console.log(`[add-set] Collect summary:`, col);
  }

  if (doRollup) {
    const asOf = new Date();
    console.log(`[add-set] Rolling up ${asOf.toISOString().slice(0,10)}…`);
    await rollupDaily(asOf);
    const upd = await computeWindowsAndLatest(asOf);
    console.log(`[add-set] Latest updated rows: ${upd}`);
  }

  console.log(`[add-set] Done.`);
  await sleep(50);
  await sequelize.close();
}

main().catch((e) => {
  console.error("[add-set] ERROR:", e);
  process.exit(1);
});
