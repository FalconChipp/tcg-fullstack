#!/usr/bin/env node
// Run the price daily rollup + latest snapshot refresh.
// Usage:
//   node scripts/marketdata/price-daily-rollup.mjs [--date=YYYY-MM-DD]

import "dotenv/config";
import process from "node:process";

import { priceDailyRollup } from "../../src/modules/marketdata/jobs/priceDailyRollup.job.js";
import { sequelize } from "../../src/models/index.js";

const args = process.argv.slice(2);
const dateArg = args.find((a) => a.startsWith("--date="));
const dateISO = dateArg ? dateArg.split("=")[1] : null;

(async () => {
  try {
    const res = await priceDailyRollup({ dateISO });
    console.log(JSON.stringify({ ok: true, ...res }, null, 2));
  } catch (err) {
    console.error("priceDailyRollup failed", err?.message || err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
