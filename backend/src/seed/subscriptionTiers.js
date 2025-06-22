// src/seed/subscriptionTiers.js
const { SubscriptionTier } = require('../models');

const defaultTiers = [
  {
    code: 'FREE',
    name: 'Free',
    description: 'Basic account',
    price: 0,
    stripePriceId: null
  },
  {
    code: 'PRO',
    name: 'Pro',
    description: 'Access to premium features',
    price: 5.99,
    stripePriceId: 'price_1...' // from Stripe dashboard
  },
  // Add more as needed
];

const seedTiers = async () => {
  for (const t of defaultTiers) {
    await SubscriptionTier.findOrCreate({
      where: { code: t.code },
      defaults: t
    });
  }
  console.log('Tiers seeded');
};

seedTiers().then(() => process.exit());
