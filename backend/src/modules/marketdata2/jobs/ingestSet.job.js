// src/modules/marketdata2/jobs/ingestSet.job.js
// Fetch a set from TCGdex and write caches, upsert DB cards/variants, and stream progress.

import fs from 'node:fs/promises';
import path from 'node:path';
import { sequelize, m_Card, m_CardVariant } from '../../../models/index.js';
import createLogger from '../services/logger.js';
import { fetchSetAndCards } from '../services/setAdapter.tcgdex.service.js'; // CHANGED: single adapter orchestrator
import {
  paths,
  recordSetRun,
  upsertSetIndexEntry,
  refreshCountsFromSetCache,
  writeSetCache,         // ADDED
} from '../services/setIndex.service.js';

const log = createLogger('md2:ingest');

function nowISO() { return new Date().toISOString(); }

function emit(io, scope, level, msg, extra = {}) {
  try { io?.emit('md2:log', { scope, level, msg, ...extra }); } catch {}
}

/**
 * Transform TCGdex card JSON → DB rows for m_cards and m_card_variants
 */
function shapeCardsForDb(setCode, cardsJson) {
  const rows = [];
  const variants = [];

  for (const c of cardsJson) {
    // CHANGED: robust id build with zero-padded number fallback
    const num = String(c?.localId ?? c?.number ?? '').padStart(3, '0');
    const card_id = c?.id || `${setCode}-${num}`;

    const base = {
      id: card_id,
      set_code: setCode,
      local_id: c?.localId ?? c?.number ?? null,
      name: c?.name ?? null,
      rarity: c?.rarity ?? null,
      supertype: c?.supertype ?? null,
      types: Array.isArray(c?.types) ? JSON.stringify(c.types) : null,
      subtypes: Array.isArray(c?.subtypes) ? JSON.stringify(c.subtypes) : null,
      // Keep extra JSON for future proofing
      meta_json: JSON.stringify({
        tcgdexId: c?.id ?? null,
        evolvesFrom: c?.evolvesFrom ?? null,
        regulationMark: c?.regulation ?? null,
      }),
    };
    rows.push(base);

    // CHANGED: normalize variant list, default at least "normal"
    const rawVariants = Array.isArray(c?.variants) && c.variants.length
      ? c.variants
      : (c?.rarity && /holo/i.test(c.rarity) ? ['holo'] : ['normal']);

    const uniq = Array.from(new Set(rawVariants.map(v => String(v).toLowerCase())));
    uniq.forEach(variant => variants.push({ card_id, variant }));
  }

  return { rows, variants };
}

export default {
  /**
   * @param {{ setCode: string, runId?: string, io?: import('socket.io').Server }} param0
   */
  async run({ setCode, runId = null, io = null } = {}) {
    const startedAt = nowISO();
    const scope = `ingest:${setCode}${runId ? '.' + runId : ''}`;
    const errors = [];
    const child = log.child(scope);

    try {
      emit(io, scope, 'info', 'start');
      child.info('start', { setCode });

      // 1) Fetch full set + cards (TCGdex)
      const { setMeta, cards } = await fetchSetAndCards(setCode); // FIXED: single, resilient fetch
      if (!cards.length) throw new Error(`No cards returned for set ${setCode}`);

      // 2) Write JSON cache (set + cards)
      await writeSetCache(setCode, { set: setMeta, cards }); // ADDED unified write

      // 3) Upsert into DB in a single transaction
      const t = await sequelize.transaction();
      try {
        const { rows, variants } = shapeCardsForDb(setCode, cards);

        // Upsert m_cards
        for (const r of rows) {
          await m_Card.upsert(r, { transaction: t }); // CHANGED: idempotent card insert/update
        }

        // Upsert m_card_variants
        for (const v of variants) {
          await m_CardVariant.upsert(v, { transaction: t }); // CHANGED: idempotent variant insert/update
        }

        await t.commit();
      } catch (err) {
        await t.rollback();
        throw err;
      }

      // 4) Update set index (cache + db counts for admin/UI)
      await upsertSetIndexEntry({ setCode, setMeta });
      const counts = await refreshCountsFromSetCache(setCode);

      // 5) Record successful run (for history/panel)
      await recordSetRun({
        setCode,
        kind: 'ingest',
        ok: true,
        startedAt,
        finishedAt: nowISO(),
        counts,
        errors: [],
      });

      emit(io, scope, 'ok', 'done', counts);
      child.info('done', { setCode, counts });
      return {
        ok: true,
        setCode,
        counts,
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
        kind: 'ingest',
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
