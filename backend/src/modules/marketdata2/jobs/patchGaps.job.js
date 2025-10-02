// src/modules/marketdata2/jobs/patchGaps.job.js
// Find stale cards (no observations in N hours) and try PPT/PTCGIO to patch.

import { Op, literal } from 'sequelize';
import { m_PriceLatest, m_PriceObservation } from '../../../models/index.js';
import { fetchSetPricesFallback as ptcgioFetch } from '../services/priceAdapter.ptcgio.service.js';
import { fetchSetPricesPatch as pptFetch } from '../services/priceAdapter.ppt.service.js';

function nowISO() { return new Date().toISOString(); }

export default {
  async run({ setCode = null, staleHours = 72, limit = 300 } = {}) {
    const startedAt = nowISO();
    const errors = [];
    try {
      // Candidates: rows with stale=true or updated_at older than threshold
      const since = new Date(Date.now() - staleHours * 3600 * 1000);
      const where = setCode ? { updated_at: { [Op.lt]: since }, stale: { [Op.or]: [true, null] }, card_id: { [Op.like]: `${setCode}-%` } } :
                              { updated_at: { [Op.lt]: since }, stale: { [Op.or]: [true, null] } };
      const candidates = await m_PriceLatest.findAll({
        where,
        order: [['updated_at', 'ASC']],
        limit,
        raw: true,
      });

      // Map to { card_id, variants: [...] }
      const byCard = new Map();
      for (const row of candidates) {
        const key = row.card_id;
        (byCard.get(key) || byCard.set(key, { card_id: key, variants: [] })).variants.push(row.variant);
      }

      const cards = Array.from(byCard.values());
      const ptcgio = await ptcgioFetch(setCode || 'all', cards);
      const ppt = await pptFetch(setCode || 'all', cards);

      // Persist observations
      const all = [...ptcgio, ...ppt];
      if (all.length) {
        await m_PriceObservation.bulkCreate(all, { ignoreDuplicates: true });
        // Mark latest rows updated (simple last_gbp from newly observed)
        for (const o of all) {
          await m_PriceLatest.upsert({
            card_id: o.card_id,
            variant: o.variant,
            price_gbp: o.amount_gbp,
            updated_at: new Date(),
            stale: false,
          });
        }
      }

      return {
        ok: true,
        counts: { candidates: candidates.length, patched: all.length },
        errors,
        startedAt,
        finishedAt: nowISO(),
        scope: { setCode, staleHours, limit },
      };
    } catch (e) {
      errors.push(String(e?.message || e));
      return { ok: false, counts: {}, errors, startedAt, finishedAt: nowISO(), scope: { setCode, staleHours, limit } };
    }
  },
};
