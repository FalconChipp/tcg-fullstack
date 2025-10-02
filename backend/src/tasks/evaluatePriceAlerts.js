// src/tasks/evaluatePriceAlerts.js — ESM
// Evaluates active alerts against CardPriceHistory and posts notifications.

/* ===========================
   Imports (kept for defaults)
   =========================== */
import { Op } from 'sequelize';
import { PriceAlert, CardPriceHistory } from '../models/index.js';
import { notifyUser } from '../utils/notifications.js';

/* ===========================
   Pure utilities (TESTABLE)
   =========================== */

// NEW: export to unit-test percent math directly
export function pctChange(from, to) {
  if (from == null || from === 0) return null;
  return ((to - from) / from) * 100;
}

// NEW: produce a cooldown checker bound to an injected clock
export function makeCooldownOk(nowFn = () => new Date()) {
  return function cooldownOk(row) {
    if (!row?.lastFiredAt) return true;
    const next = new Date(new Date(row.lastFiredAt).getTime() + row.cooldownHours * 60 * 60 * 1000);
    return nowFn() >= next;
  };
}

// NEW: produce a window loader bound to injected models + clock
export function makeWindowEndpoints(models, nowFn = () => new Date()) {
  if (!models?.CardPriceHistory?.findAll) throw new Error('models.CardPriceHistory.findAll missing');

  return async function windowEndpoints({ cardId, variation, hours }) {
    const to = nowFn();
    const from = new Date(to.getTime() - hours * 60 * 60 * 1000);

    const rows = await models.CardPriceHistory.findAll({
      where: {
        cardId,
        fetchedAt: { [Op.between]: [from, to] },
        ...(variation ? { variation } : {}),
      },
      attributes: ['gbp', 'fetchedAt'],
      order: [['fetchedAt', 'ASC']],
      raw: true,
    });

    if (!rows.length) return null;
    const first = rows[0]?.gbp == null ? null : Number(rows[0].gbp);
    const last = rows[rows.length - 1]?.gbp == null ? null : Number(rows[rows.length - 1].gbp);
    return { first, last };
  };
}

/* ==========================================
   Main evaluator factory (SUPER TESTABLE)
   ========================================== */

// NEW: build an evaluator with injected deps for clean tests
export function makeEvaluator({
  models,
  notify = notifyUser,
  now = () => new Date(),
} = {}) {
  if (!models?.PriceAlert?.findAll) throw new Error('models.PriceAlert.findAll missing');

  const cooldownOk = makeCooldownOk(now);
  const loadWindow = makeWindowEndpoints(models, now);

  // Return the actual runner so tests can call it
  return async function evaluatePriceAlerts() {
    const alerts = await models.PriceAlert.findAll({ where: { isActive: true } });

    for (const a of alerts) {
      if (!cooldownOk(a)) continue;

      const window = await loadWindow({
        cardId: a.cardId,
        variation: a.variation || null,
        hours: a.windowHours,
      });
      if (!window || window.last == null) continue;

      let hit = false;
      let message = '';

      if (a.condition === 'pct_up' || a.condition === 'pct_down') {
        const pct = pctChange(window.first ?? window.last, window.last);
        if (pct == null) continue;
        if (a.condition === 'pct_up' && pct >= a.value) {
          hit = true; message = `↑ ${pct.toFixed(1)}% in last ${a.windowHours}h`;
        }
        if (a.condition === 'pct_down' && pct <= -a.value) {
          hit = true; message = `↓ ${Math.abs(pct).toFixed(1)}% in last ${a.windowHours}h`;
        }
      } else if (a.condition === 'above') {
        if (window.last >= a.value) { hit = true; message = `≥ £${a.value.toFixed(2)} (now £${window.last.toFixed(2)})`; }
      } else if (a.condition === 'below') {
        if (window.last <= a.value) { hit = true; message = `≤ £${a.value.toFixed(2)} (now £${window.last.toFixed(2)})`; }
      }

      if (!hit) continue;

      // Send notification (injected -> easy to spy in tests)
      await notify({
        userId: a.userId,
        type: 'price_alert',
        title: `Price alert: ${a.cardId}${a.variation ? ` · ${a.variation}` : ''}`,
        body: message,
        meta: {
          cardId: a.cardId,
          variation: a.variation,
          windowHours: a.windowHours,
          condition: a.condition,
          value: a.value,
          last: window.last,
          first: window.first,
        },
      });

      // Update cooldown timestamp using injected clock
      await a.update({ lastFiredAt: now() });
    }
  };
}

/* ===================================================
   Back-compat default runner using real app services
   =================================================== */

// CHANGED: default export still works with real models + notifier
export async function evaluatePriceAlerts() {
  const run = makeEvaluator({
    models: { PriceAlert, CardPriceHistory },  // real models
    notify: notifyUser,                        // real notifier
    now: () => new Date(),                     // real clock
  });
  return run();
}

export default evaluatePriceAlerts;

/* ===========================
   CLI entry (unchanged UX)
   =========================== */

// CHANGED: robust ESM CLI check while keeping your original guard
const invokedDirectly =
  (typeof import.meta !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) ||
  (process.argv[1] && process.argv[1].endsWith('evaluatePriceAlerts.js'));

if (invokedDirectly) {
  evaluatePriceAlerts()
    .then(() => {
      console.log('[alerts] evaluation completed');
      process.exit(0);
    })
    .catch((e) => {
      console.error('[alerts] evaluation failed', e);
      process.exit(1);
    });
}
