// src/modules/alerts/resolvers.js
// NEW: CRUD for alerts (auth via requireAuth)

import { PriceAlert } from '../../models/index.js';
import { requireAuth } from '../collection/helpers.js';

const resolvers = {
  Query: {
    myPriceAlerts: async (_, __, { token }) => {
      const me = requireAuth(token);
      const rows = await PriceAlert.findAll({
        where: { userId: me.id },
        order: [['updatedAt', 'DESC']],
      });
      return rows;
    },
  },

  Mutation: {
    upsertPriceAlert: async (_, { input }, { token }) => {
      const me = requireAuth(token);

      if (input.id) {
        const row = await PriceAlert.findByPk(input.id);
        if (!row || row.userId !== me.id) throw new Error('Alert not found');
        await row.update({
          cardId: input.cardId,
          variation: input.variation ?? row.variation,
          condition: input.condition,
          value: input.value,
          windowHours: input.windowHours ?? row.windowHours,
          isActive: input.isActive ?? row.isActive,
          cooldownHours: input.cooldownHours ?? row.cooldownHours,
          currency: input.currency ?? row.currency,
        });
        return row;
      }

      return await PriceAlert.create({
        userId: me.id,
        cardId: input.cardId,
        variation: input.variation ?? null,
        condition: input.condition,
        value: input.value,
        windowHours: input.windowHours ?? 24,
        isActive: input.isActive ?? true,
        cooldownHours: input.cooldownHours ?? 12,
        currency: input.currency ?? 'GBP',
      });
    },

    deletePriceAlert: async (_, { id }, { token }) => {
      const me = requireAuth(token);
      const row = await PriceAlert.findByPk(id);
      if (!row || row.userId !== me.id) return false;
      await row.destroy();
      return true;
    },

    togglePriceAlert: async (_, { id, active }, { token }) => {
      const me = requireAuth(token);
      const row = await PriceAlert.findByPk(id);
      if (!row || row.userId !== me.id) return false;
      await row.update({ isActive: !!active });
      return true;
    },
  },
};

export default resolvers;
