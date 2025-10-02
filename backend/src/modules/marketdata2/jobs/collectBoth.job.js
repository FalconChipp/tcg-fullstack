// src/modules/marketdata2/jobs/collectBoth.job.js
// Convenience job: ingest set then collect prices. Streams sub-job progress.

import IngestSet from './ingestSet.job.js';
import CollectPrices from './collectPrices.job.js';

function nowISO(){ return new Date().toISOString(); }

export default {
  /**
   * @param {{ setCode: string, runId?: string, io?: import('socket.io').Server }} param0
   */
  async run({ setCode, runId = null, io = null } = {}) {
    const startedAt = nowISO();
    const errors = [];
    let ingestRes = null;
    let priceRes = null;

    try {
      ingestRes = await IngestSet.run({ setCode, runId: `${runId || 'both'}`, io });
      if (!ingestRes?.ok) errors.push(...(ingestRes?.errors || []));
    } catch (e) { errors.push(String(e?.message || e)); }

    try {
      priceRes = await CollectPrices.run({ setCode, runId: `${runId || 'both'}`, io });
      if (!priceRes?.ok) errors.push(...(priceRes?.errors || []));
    } catch (e) { errors.push(String(e?.message || e)); }

    return {
      ok: errors.length === 0,
      setCode,
      counts: { ...(ingestRes?.counts || {}), observations: priceRes?.counts?.observations || 0 },
      errors,
      startedAt,
      finishedAt: nowISO(),
      scope: { setCode, runId },
    };
  },
};
