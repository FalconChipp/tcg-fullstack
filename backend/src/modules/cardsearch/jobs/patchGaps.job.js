// src/modules/cardsearch/jobs/patchGaps.job.js
// Patch missing price observations by re-querying the gap-filler provider (PPT by default)
// and upserting any missing points. Thin wrapper over collectPrices with restricted providers.

import { collectPrices } from "./collectPrices.job.js";

/**
 * @typedef {Object} PatchGapsOptions
 * @property {string} set                - ABBR | tcgdex | ptcg (e.g. 'SSP' or 'sv08')
 * @property {string} [since]            - ISO date (YYYY-MM-DD); only patch from this day forward
 * @property {number} [backfillFxDays]   - If provided, run FX backfill for N days before patching
 * @property {Console|{log:Function,warn:Function,error:Function}} [logger]
 */

/**
 * Run gap patching for a single set.
 * Internally calls collectPrices({ providers:['ppt'], gapFillOnly:true, ... }).
 */
export async function patchGaps(opts) {
  if (!opts?.set) throw new Error("patchGaps: 'set' is required");
  const res = await collectPrices({
    set: opts.set,
    since: opts.since || null,
    prewarmFx: true,
    backfillFxDays: Number.isFinite(opts.backfillFxDays) ? opts.backfillFxDays : undefined,
    providers: ["ppt"],
    gapFillOnly: true,
    logger: opts.logger,
  });
  return { ok: true, result: res };
}

export default { patchGaps };
