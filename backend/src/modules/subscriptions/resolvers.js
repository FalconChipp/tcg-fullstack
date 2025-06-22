// src/modules/subscriptions/resolvers.js
const { Subscription, SubscriptionTier, User } = require('../../models');
const helpers = require('../auth/helpers');
const stripe = require('../../stripe/stripe');

module.exports = {
  Query: {
    subscriptionTiers: async () => await SubscriptionTier.findAll(),
    mySubscription: async (parent, args, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      return await Subscription.findOne({
        where: { userId: payload.id, active: true },
        include: [SubscriptionTier]
      });
    }
  },
  Mutation: {
    createSubscriptionCheckoutSession: async (parent, { tierCode }, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      const user = await User.findByPk(payload.id);
      if (!user) throw new Error('User not found');

      const tier = await SubscriptionTier.findOne({ where: { code: tierCode } });
      if (!tier) throw new Error('Subscription tier not found');

      // Create a Stripe Checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: user.email,
        line_items: [{
          price: tier.stripePriceId,
          quantity: 1,
        }],
        success_url: 'https://tcg.sixbyfive.com/account/subscription-success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://tcg.sixbyfive.com/account/subscription-cancel',
        metadata: { userId: user.id, tierCode: tier.code }
      });

      return session.url;
    },
    cancelMySubscription: async (parent, args, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      const subscription = await Subscription.findOne({
        where: { userId: payload.id, active: true }
      });
      if (!subscription) throw new Error('No active subscription found');

      // Cancel in Stripe
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      });

      subscription.active = false;
      await subscription.save();
      return true;
    }
  },
  Subscription: {
    tier: async (sub) => await SubscriptionTier.findByPk(sub.tierId)
  }
};
