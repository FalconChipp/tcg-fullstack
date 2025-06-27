import Stripe from 'stripe';
import { Subscription, SubscriptionTier } from '../../models/index.js';
import { notifyUser } from '../../utils/notifications.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a Stripe subscription for a user and save DB record.
 */
export async function startSubscription(userId, tierId, paymentMethodId) {
  const tier = await SubscriptionTier.findByPk(tierId);
  if (!tier) throw new Error('Invalid tier');

  const customer = await stripe.customers.create({ payment_method: paymentMethodId });
  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: tier.stripePriceId }],
    expand: ['latest_invoice.payment_intent'],
  });

  const record = await Subscription.create({
    userId,
    tierId,
    status: sub.status,
    stripeSubId: sub.id,
    periodEnd: new Date(sub.current_period_end * 1000),
    meta: sub,
  });

  await notifyUser({
    userId,
    type: 'subscription',
    title: 'Subscription Started',
    body: `You are now subscribed to ${tier.name}.`,
  });

  return record;
}

/** Cancel a subscription via Stripe and update DB. */
export async function cancelSubscription(userId) {
  const sub = await Subscription.findOne({ where: { userId, status: 'active' } });
  if (!sub) throw new Error('No active subscription');
  await stripe.subscriptions.del(sub.stripeSubId);
  sub.status = 'canceled';
  sub.cancelledAt = new Date();
  await sub.save();
  await notifyUser({
    userId,
    type: 'subscription',
    title: 'Subscription Canceled',
    body: 'Your subscription has been canceled.',
  });
  return true;
}
