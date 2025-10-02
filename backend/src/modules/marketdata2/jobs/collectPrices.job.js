// src/modules/marketdata2/jobs/collectPrices.job.js
// Collect prices from providers, normalize GBP, insert observations, update latest, and record run.

import { sequelize, m_Card } from '../../../models/index.js';
import createLogger from '../services/logger.js';
import { fetchSetPrices as tcgdexFetch } from '../services/priceAdapter.tcgdex.service.js';
import { getFxRatesGBP } from '../services/fx.service.js';
import { ingestObservations } from '../services/ingest.service.js';
import { recordSetRun } from '../services/setIndex.service.js';

const log = createLogger('md2:prices');

function nowISO() { return new Date().toISOString(); }
function emit(io, scope, level, msg, extra = {}) { try { io?.emit('md2:log', { scope, level, msg, ...extra }); } catch {} }

async function loadCardsForSet(setCode) {
  const rows = await m_Card.findAll({ attributes: ['id', 'set_code', 'local_id', 'rarity'], where: { set_code: setCode } });
  return rows.map(r => r.toJSON());
}

function round2(n) { return n == null ? null : Math.round(Number(n) * 100) / 100; }

// CHANGED: fx rates are GBP-centric. fx.USD = USD per 1 GBP; to get GBP we divide.
function normalizeToGbp(raw, fx) {
  const out = [];
  const usdPerGbp = Number(fx?.USD) > 0 ? Number(fx.USD) : null;
  const eurPerGbp = Number(fx?.EUR) > 0 ? Number(fx.EUR) : null;

  for (const o of raw) {
    let price_gbp = null;
    if (o.currency === 'USD' && usdPerGbp) price_gbp = round2(o.price_native / usdPerGbp);
    if (o.currency === 'EUR' && eurPerGbp) price_gbp = round2(o.price_native / eurPerGbp);

    out.push({
      ...o,
      price_gbp,
    });
  }
  return out;
}

export default {
  /**
   * @param {{ setCode: string, runId?: string, io?: import('socket.io').Server }} param0
   */
  async run({ setCode, runId = null, io = null } = {}) {
    const startedAt = nowISO();
    const scope = `prices:${setCode}${runId ? '.' + runId : ''}`;
    const errors = [];
    const child = log.child(scope);

    try {
      emit(io, scope, 'info', 'start');
      child.info('start', { setCode });

      const cards = await loadCardsForSet(setCode);
      if (!cards.length) throw new Error(`No cards found in DB for set ${setCode} — run ingest first.`);

      const fx = await getFxRatesGBP().catch(() => ({}));
      const raw = await tcgdexFetch(setCode); // primary
      const n = normalizeToGbp(raw, fx);

      const ingest = await ingestObservations(n);
      emit(io, scope, 'info', 'ingested', ingest);
      child.info('ingested', { setCode, ...ingest });

      await recordSetRun({
        setCode,
        kind: 'prices',
        ok: true,
        startedAt,
        finishedAt: nowISO(),
        counts: ingest,
        errors: [],
      });

      return {
        ok: true,
        setCode,
        counts: ingest,
        errors,
        startedAt,
        finishedAt: nowISO(),
        scope: { setCode, runId },
      };
    } catch (e) {
      const msg = e?.message || String(e);
      errors.push(msg);
      emit(io, scope, 'err', msg);
      child.error('error', e);

      await recordSetRun({
        setCode,
        kind: 'prices',
        ok: false,
        startedAt,
        finishedAt: nowISO(),
        counts: {},
        errors,
      });

      return { ok: false, setCode, counts: {}, errors, startedAt, finishedAt: nowISO(), scope: { setCode, runId } };
    }
  },
};
