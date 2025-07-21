// /lib/subscriptionsApi.js

/**
 * Dummy API wrapper for subscription actions.
 * Returns fake data for frontend development.
 */

// Simulated plans
const dummyPlans = [
  {
    id: "free",
    name: "Free",
    description: "Core access for collectors. Basic features to get you started.",
    price: 0,
    interval: null,
    features: [
      "Limited active listings",
      "Basic binder creator",
      "Access marketplace/trading",
      "Basic achievements"
    ],
  },
  {
    id: "collection",
    name: "Collection",
    description: "For dedicated collectors. Unlock more binders and premium features.",
    price: 4.99,
    interval: "month",
    features: [
      "Unlimited binders",
      "Binder customization",
      "Advanced analytics",
      "Early access to new features"
    ],
  },
  {
    id: "business",
    name: "Business",
    description: "Sell and trade at scale. Extra perks for stores and power users.",
    price: 9.99,
    interval: "month",
    features: [
      "Unlimited listings",
      "1% flat marketplace fee",
      "Business badge",
      "Discounted transaction fees"
    ],
  },
];

// Simulated user subscription
const dummyUserSubscription = {
  id: "sub_123456",
  status: "active",
  plan: {
    id: "collection",
    name: "Collection",
    price: 4.99,
  },
  renewsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 days from now
};

// Helper: Simulate network delay
function simulateNetwork(data, ms = 600) {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export async function fetchSubscriptionPlans() {
  // Return simulated plans
  return simulateNetwork(dummyPlans);
}

export async function fetchUserSubscription(token) {
  // Optionally, switch dummyUserSubscription based on token, for now always returns the same
  // To simulate logged out, you could add: if (!token) return simulateNetwork(null);
  return simulateNetwork(dummyUserSubscription);
}

export async function startSubscriptionCheckout(planId, token) {
  // Returns a dummy Stripe test checkout link
  // You can add logic here to reject or vary based on planId/token if you want
  const dummyCheckoutUrl = "https://checkout.stripe.com/pay/test-dummy-url";
  return simulateNetwork(dummyCheckoutUrl);
}
