import { Subscription, SubscriptionTier } from '../../models/index.js';
import { requireAuth } from '../collection/helpers.js';
import { startSubscription, cancelSubscription } from './helpers.js';

const resolvers = {
  Query: {
    mySubscription: async (_, __, { token }) => {
      const payload = requireAuth(token);
      return Subscription.findOne({
        where: { userId: payload.id, status: 'active' },
        include: [SubscriptionTier],
      });
    },
    subscriptionTiers: () => SubscriptionTier.findAll({ where: { } }),
  },
  Mutation: {
    createSubscription: async (_, { tierId, paymentMethodId }, { token }) => {
      const payload = requireAuth(token);
      return startSubscription(payload.id, tierId, paymentMethodId);
    },
    cancelSubscription: async (_, __, { token }) => {
      const payload = requireAuth(token);
      await cancelSubscription(payload.id);
      return true;
    },
  },
  Subscription: {
    tier: (sub) => SubscriptionTier.findByPk(sub.tierId),
  },
};

export default resolvers;
