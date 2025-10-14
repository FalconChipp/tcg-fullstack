// src/modules/alerts/resolvers.js
// NEW: CRUD for alerts (auth via requireAuth)

import { PriceAlert } from '../../models/index.js';
import { requireAuth } from '../collection/helpers.js';
import { resolvePercentThreshold } from './priceAlert.config.js';


function resolveAlertValue(condition, incoming, fallback) {
  if (condition === 'pct_up' || condition === 'pct_down') {
    return resolvePercentThreshold(condition, incoming ?? fallback);
  }
  const source = incoming ?? fallback;
  const numeric = Number(source);
  if (!Number.isFinite(numeric)) {
    throw new Error(`value is required for condition ${condition}`);
  }
  return numeric;
}

const VARIANT_ALIASES = {
  normal: "normal",
  standard: "normal",
  holo: "holo",
  holofoil: "holo",
  reverse: "reverse",
  reverseholo: "reverse",
  "reverse holo": "reverse",
  reverse_holo: "reverse",
  reverseholofoil: "reverse",
  "reverse holofoil": "reverse",
  firstedition: "firstEdition",
  first_edition: "firstEdition",
  "first edition": "firstEdition",
  foil: "foil",
};

function normalizeVariation(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const key = trimmed.replace(/[\s_-]+/g, "").toLowerCase();
  return VARIANT_ALIASES[key] ?? trimmed;
}

const resolvers = {
  Query: {
    myPriceAlerts: async (_, args, { token }) => {
      const me = requireAuth(token);
      const where = { userId: me.id };
      if (args?.cardId) {
        where.cardId = String(args.cardId);
      }
      if (Object.prototype.hasOwnProperty.call(args ?? {}, "variation")) {
        const raw = args.variation;
        const normalized = raw == null || raw === "" ? null : String(raw).trim().toLowerCase();
        where.variation = normalized;
      }
      const rows = await PriceAlert.findAll({
        where,
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

        const nextCondition = input.condition ?? row.condition;
        const nextValue = resolveAlertValue(nextCondition,
          input.value !== undefined ? input.value : undefined,
          row.value
        );

        await row.update({
          cardId: input.cardId ?? row.cardId,
          variation: normalizeVariation(input.variation ?? row.variation),
          condition: nextCondition,
          value: nextValue,
          windowHours: input.windowHours ?? row.windowHours,
          isActive: input.isActive ?? row.isActive,
          cooldownHours: input.cooldownHours ?? row.cooldownHours,
          currency: input.currency ?? row.currency,
        });
        return row;
      }

      const condition = input.condition;
      const value = resolveAlertValue(condition, input.value, null);

      return await PriceAlert.create({
        userId: me.id,
        cardId: input.cardId,
        variation: normalizeVariation(input.variation ?? null),
        condition,
        value,
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
