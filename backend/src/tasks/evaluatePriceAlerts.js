// src/tasks/evaluatePriceAlerts.js
// Evaluates active alerts against CardPriceHistory and posts notifications.

import { Op } from 'sequelize';
import { PriceAlert, m_PriceObservation } from '../models/index.js';
import { notifyUser } from '../utils/notifications.js';
import { resolvePercentThreshold, normalizeAlertOptions } from '../modules/alerts/priceAlert.config.js';

export function pctChange(from, to) {
  if (from == null || from === 0) return null;
  return ((to - from) / from) * 100;
}

export function makeCooldownOk(nowFn = () => new Date()) {
  return function cooldownOk(row) {
    if (!row?.lastFiredAt) return true;
    const next = new Date(new Date(row.lastFiredAt).getTime() + row.cooldownHours * 60 * 60 * 1000);
    return nowFn() >= next;
  };
}

export function makeWindowEndpoints(models, nowFn = () => new Date()) {
  if (!models?.m_PriceObservation?.findAll) throw new Error('models.m_PriceObservation.findAll missing');

  return async function windowEndpoints({ cardId, variation, hours }) {
    const to = nowFn();
    const from = new Date(to.getTime() - hours * 60 * 60 * 1000);

    const rows = await models.m_PriceObservation.findAll({
      where: {
        card_id: cardId,
        observed_at: { [Op.between]: [from, to] },
        ...(variation ? { variation } : {}),
      },
      attributes: ['amount_gbp', 'observed_at'],
      order: [['observed_at', 'ASC']],
      raw: true,
    });

    if (!rows.length) return null;
    const first = rows[0]?.amount_gbp == null ? null : Number(rows[0].amount_gbp);
    const last = rows[rows.length - 1]?.amount_gbp == null ? null : Number(rows[rows.length - 1].amount_gbp);
    return { first, last };
  };
}

export function makeEvaluator({
  models,
  notify = notifyUser,
  now = () => new Date(),
} = {}) {
  if (!models?.PriceAlert?.findAll) throw new Error('models.PriceAlert.findAll missing');

  const cooldownOk = makeCooldownOk(now);
  const loadWindow = makeWindowEndpoints(models, now);

  return async function evaluatePriceAlerts(options = {}) {
    const { cardIds, pctUp, pctDown } = options;
    const thresholds = normalizeAlertOptions({ pctUp, pctDown });

    const where = { isActive: true };
    if (Array.isArray(cardIds) && cardIds.length) {
      const unique = Array.from(new Set(cardIds.map((id) => String(id))));
      where.cardId = { [Op.in]: unique };
    }

    const alerts = await models.PriceAlert.findAll({ where });
    let triggered = 0;

    for (const alert of alerts) {
      if (!cooldownOk(alert)) continue;

      const window = await loadWindow({
        cardId: alert.cardId,
        variation: alert.variation || null,
        hours: alert.windowHours,
      });
      if (!window || window.last == null) continue;

      const condition = alert.condition;
      let hit = false;
      let message = '';
      let effectiveValue = alert.value;

      if (condition === 'pct_up' || condition === 'pct_down') {
        const pct = pctChange(window.first ?? window.last, window.last);
        if (pct == null) continue;
        effectiveValue = resolvePercentThreshold(
          condition,
          effectiveValue ?? (condition === 'pct_up' ? thresholds.pctUp : thresholds.pctDown)
        );
        if (!Number.isFinite(effectiveValue) || effectiveValue <= 0) continue;
        if (condition === 'pct_up' && pct >= effectiveValue) {
          hit = true;
          message = 'UP ' + pct.toFixed(1) + '% in last ' + alert.windowHours + 'h';
        }
        if (condition === 'pct_down' && pct <= -effectiveValue) {
          hit = true;
          message = 'DOWN ' + Math.abs(pct).toFixed(1) + '% in last ' + alert.windowHours + 'h';
        }
      } else if (condition === 'above') {
        if (Number.isFinite(effectiveValue) && window.last >= effectiveValue) {
          hit = true;
          message = '>= �' + effectiveValue.toFixed(2) + ' (now �' + window.last.toFixed(2) + ')';
        }
      } else if (condition === 'below') {
        if (Number.isFinite(effectiveValue) && window.last <= effectiveValue) {
          hit = true;
          message = '<= �' + effectiveValue.toFixed(2) + ' (now �' + window.last.toFixed(2) + ')';
        }
      }

      if (!hit) continue;

      await notify({
        userId: alert.userId,
        type: 'price_alert',
        title: 'Price alert: ' + alert.cardId + (alert.variation ? ' - ' + alert.variation : ''),
        body: message,
        meta: {
          cardId: alert.cardId,
          variation: alert.variation,
          windowHours: alert.windowHours,
          condition: alert.condition,
          value: effectiveValue,
          last: window.last,
          first: window.first,
        },
      });

      await alert.update({ lastFiredAt: now() });
      triggered += 1;
    }

    return { alertsEvaluated: alerts.length, triggered };
  };
}

export async function evaluatePriceAlerts(options = {}) {
  const run = makeEvaluator({
    models: { PriceAlert, m_PriceObservation },
    notify: notifyUser,
    now: () => new Date(),
  });
  return run(options);
}

export default evaluatePriceAlerts;

const invokedDirectly =
  (typeof import.meta !== 'undefined' && Array.isArray(process.argv) && process.argv[1] && import.meta.url === `file://${process.argv[1]}`) ||
  (Array.isArray(process.argv) && process.argv[1] && process.argv[1].endsWith('evaluatePriceAlerts.js'));

if (invokedDirectly) {
  evaluatePriceAlerts()
    .then((summary) => {
      const triggered = summary?.triggered ?? 0;
      console.log(`[alerts] evaluation completed (triggered=${triggered})`);
      process.exit(0);
    })
    .catch((e) => {
      console.error('[alerts] evaluation failed', e);
      process.exit(1);
    });
}
