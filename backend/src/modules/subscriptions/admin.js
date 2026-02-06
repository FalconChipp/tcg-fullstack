import { SubscriptionTier, Subscription, SubscriptionAddOn } from '../../models/index.js';
import { requireAdmin } from '../users/helpers.js';

export const adminResolvers = {
  Query: {
    adminSubscriptions: async (_, __, { token }) => {
      await requireAdmin(token);
      return Subscription.findAll({ include: [SubscriptionTier] });
    },
  },
  Mutation: {
    adminCreateTier: async (_, args, { token }) => {
      await requireAdmin(token);
      return SubscriptionTier.create(args);
    },
    adminUpdateTier: async (_, { id, input }, { token }) => {
      await requireAdmin(token);
      const tier = await SubscriptionTier.findByPk(id);
      if (!tier) throw new Error('Not found');
      Object.assign(tier, input);
      await tier.save();
      return tier;
    },
    adminDeleteTier: async (_, { id }, { token }) => {
      await requireAdmin(token);
      await SubscriptionTier.destroy({ where: { id } });
      return true;
    },
    adminAssignAddOn: async (_, { userId, type, quantity, expiresAt }, { token }) => {
      await requireAdmin(token);
      return SubscriptionAddOn.create({ userId, type, quantity, expiresAt });
    },
  },
};
