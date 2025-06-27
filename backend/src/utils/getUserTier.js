// src/utils/getUserTier.js

import {
  Subscription,
  SubscriptionTier,
  SubscriptionAddOn,
} from '../models/index.js';

/**
 * Fetch a user's subscription details including tier and add-ons.
 * Central place for limits/discount logic.
 * @param {string} userId
 */
export async function getUserTier(userId) {
  const sub = await Subscription.findOne({
    where: { userId, status: 'active' },
    include: [SubscriptionTier],
  });
  const addons = await SubscriptionAddOn.findAll({
    where: { userId, expiresAt: null },
  });
  const tier = sub?.SubscriptionTier;
  return {
    tierId: tier?.id,
    tierName: tier?.name || 'Free',
    featureFlags: tier?.featureFlags || [],
    limits: tier?.limits || {},
    feeDiscount: parseFloat(tier?.feeDiscount || 0),
    shippingDiscount: parseFloat(tier?.shippingDiscount || 0),
    addons: addons.map((a) => ({ type: a.type, quantity: a.quantity })),
  };
}
