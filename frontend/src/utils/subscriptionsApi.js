/**
 * Dummy API wrapper for subscription actions.
 * Returns fake data for frontend development.
 */

// Simulated plans (now with 4 tiers)
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
    name: "Collector",
    description: "For dedicated collectors. Unlock more binders and premium features.",
    price: "TBD",
    interval: "month",
    features: [
      "Unlimited binders",
      "Binder customization",
      "Advanced analytics",
      "Early access to new features"
    ],
  },
  {
    id: "elite",
    name: "Elite Collector",
    description: "For power collectors. Bulk tools, extra perks, and more.",
    price: "TBD",
    interval: "month",
    features: [
      "Up to 200 active listings",
      "Lower marketplace fees",
      "Bulk listing tools",
      "Promoted listings",
      "Advanced binder customization"
    ],
  },
  {
    id: "business",
    name: "Business",
    description: "Sell and trade at scale. Extra perks for stores and power users.",
    price: "TBD",
    interval: "month",
    features: [
      "Unlimited listings",
      "1% flat marketplace fee",
      "Business badge",
      "Discounted transaction fees"
    ],
  },
];

// Simulated user subscription (mutable for upgrades/downgrades)
let mutableUserSubscription = {
  id: "sub_123456",
  status: "active",
  plan: {
    id: "collection",
    name: "Collector",
    price: "TBD",
  },
  renewsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 days from now
};

// Helper: Simulate network delay
function simulateNetwork(data, ms = 600) {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export async function fetchSubscriptionPlans() {
  return simulateNetwork(dummyPlans);
}

export async function fetchUserSubscription(token) {
  return simulateNetwork(mutableUserSubscription);
}

export async function startSubscriptionCheckout(planId, token) {
  if (planId === mutableUserSubscription.plan.id) {
    throw new Error("Already subscribed to this plan");
  }
  if (Math.random() < 0.1) throw new Error("Payment failed. Try again.");
  return simulateNetwork("https://checkout.stripe.com/pay/test-dummy-url");
}

export async function updateUserSubscription(planId) {
  const foundPlan = dummyPlans.find(p => p.id === planId);
  if (!foundPlan) throw new Error("Invalid plan");

  mutableUserSubscription = {
    ...mutableUserSubscription,
    plan: { id: foundPlan.id, name: foundPlan.name, price: foundPlan.price },
    renewsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    status: "active"
  };

  return simulateNetwork(mutableUserSubscription);
}

export async function cancelUserSubscription() {
  mutableUserSubscription.status = "canceled";
  return simulateNetwork({ success: true });
}

export async function reactivateUserSubscription() {
  mutableUserSubscription.status = "active";
  return simulateNetwork(mutableUserSubscription);
}

export function resetMockSubscription() {
  mutableUserSubscription = { ...dummyUserSubscription };
}

const dummyInvoices = [
  {
    id: "inv_1",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    amount: 499,
    currency: "GBP",
    status: "paid",
    description: "Collector Subscription - July",
  },
];

export async function fetchUserInvoices() {
  return simulateNetwork(dummyInvoices);
}
