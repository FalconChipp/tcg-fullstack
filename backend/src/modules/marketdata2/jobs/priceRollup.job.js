// src/modules/marketdata2/jobs/priceRollup.job.js
// CHANGED: Added to satisfy index.js import. Supports both "allSets" and "setCode" modes.
// Calls rollup.service to materialize 1/7/30/90 day aggregates from m_price_observations.

import createLogger from '../services/logger.js';
import { computeRollupsAll, computeRollupsForSet } from '../services/rollup.service.js';

const log = createLogger('md2:rollup');

function nowISO() { return new Date().toISOString(); }

export default {
  /**
   * Run price rollups.
   * @param {{ allSets?: boolean, setCode?: string, days?: number[] }} opts
   * - If allSets=true, computes rollups for every card/variant in observations.
   * - Else if setCode is provided, limits rollups to that set (e.g. sv08).
   * - days defaults to [1,7,30,90].
   */
  async run(opts = {}) {
    const { allSets = false, setCode = null, days = [1, 7, 30, 90] } = opts;
    const startedAt = nowISO();
    const errors = [];

    try {
      const result = allSets
        ? await computeRollupsAll({ windows: days })      // ADDED: all-sets mode for index.js’ /rollups/rebuild
        : await computeRollupsForSet({ setCode, windows: days });

      log.info('rollup:done', { scope: allSets ? 'ALL' : setCode, byWindow: result.byWindow });
      return { ok: true, result, errors, startedAt, finishedAt: nowISO() };
    } catch (e) {
      const msg = e?.message || String(e);
      errors.push(msg);
      log.error('rollup:error', e);
      return { ok: false, result: {}, errors, startedAt, finishedAt: nowISO() };
    }
  },
};
