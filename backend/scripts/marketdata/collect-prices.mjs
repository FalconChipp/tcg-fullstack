#!/usr/bin/env node
// CHANGED: added small UX niceties to see speed & totals; no behavior break.
//           (Your job module API stays the same.)

import "dotenv/config";

import process from "node:process";
import { collectPricesForSet, collectPricesForEra } from "../../src/modules/marketdata/jobs/priceCollect.job.js";

const args = process.argv.slice(2);
const setFlag = (args.find(a => a.startsWith("--set=")) || "").split("=")[1] || null;
const eraFlag = (args.find(a => a.startsWith("--era=")) || "").split("=")[1] || null;

if (!setFlag && !eraFlag) {
  console.error("Usage:\n  node scripts/marketdata/collect-prices.mjs --set=<code>\n  node scripts/marketdata/collect-prices.mjs --era=<era>");
  process.exit(1);
}

(async () => {
  try {
    const t0 = Date.now();
    if (setFlag) {
      console.log(`• Collecting prices for set ${setFlag}…`);
      const res = await collectPricesForSet({ setCode: setFlag });
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      // CHANGED: show quick summary + still print full JSON for your pipeline
      console.log(`✔ Set ${setFlag}: scanned=${res?.scanned ?? 0}, inserted=${res?.inserted ?? 0}, time=${dt}s`);
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    }
    if (eraFlag) {
      console.log(`• Collecting prices for ERA ${eraFlag.toUpperCase()}…`);
      const results = await collectPricesForEra({ era: eraFlag });
      const totalInserted = results.reduce((n, r) => n + (r.inserted || 0), 0);
      const totalScanned  = results.reduce((n, r) => n + (r.scanned  || 0), 0);
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`✔ Done. Sets=${results.length}, scanned=${totalScanned}, inserted≈${totalInserted}, time=${dt}s`);
      process.exit(0);
    }
  } catch (e) {
    console.error("✖ Collect failed:", e?.message || e);
    process.exit(1);
  }
})();
