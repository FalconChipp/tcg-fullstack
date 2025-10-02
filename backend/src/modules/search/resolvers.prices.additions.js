// src/modules/search/resolvers.prices.additions.js
// CHANGED: exposes makePriceSeriesResolvers({ CardPriceHistory }) for testability

import { Op, fn, col } from 'sequelize';
import { CardPriceHistory } from '../../models/index.js';

export function makePriceSeriesResolvers({ CardPriceHistory: Model }) {
  return {
    Query: {
      async cardPriceSeries(_, { cardId, variation = null, days = 30 }) {
        const since = new Date(Date.now() - Math.min(days, 90) * 24 * 60 * 60 * 1000);

        const rows = await Model.findAll({
          where: {
            cardId,
            fetchedAt: { [Op.gte]: since },
            ...(variation ? { variation } : {}),
          },
          attributes: [[fn('DATE', col('fetchedAt')), 'd'], 'gbp'],
          order: [['fetchedAt', 'ASC']],
          raw: true,
        });

        // Consolidate to one point per day (last wins)
        const byDay = new Map();
        for (const r of rows) byDay.set(r.d, r.gbp == null ? null : Number(r.gbp));
        return Array.from(byDay.entries()).map(([d, gbp]) => ({ at: d, gbp }));
      },
    },
  };
}

// Default export using real model
export default makePriceSeriesResolvers({ CardPriceHistory });
