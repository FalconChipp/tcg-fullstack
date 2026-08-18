/**
 * Subscription API helpers — thin wrappers around Apollo Client.
 * Previously contained dummy data; now calls the real GraphQL backend.
 */
import { apolloClient } from '../../app/apolloClient';
import {
  SUBSCRIPTION_PLANS,
  MY_SUBSCRIPTION,
  MY_CAPABILITIES,
  SUBSCRIPTION_PORTAL,
  MY_TRANSACTIONS,
  CREATE_SUBSCRIPTION,
  CANCEL_SUBSCRIPTION,
  RESUME_SUBSCRIPTION,
  UPDATE_SUBSCRIPTION,
} from '../graphql/subscriptions';

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function fetchSubscriptionPlans() {
  const { data } = await apolloClient.query({
    query: SUBSCRIPTION_PLANS,
    fetchPolicy: 'no-cache',
  });
  return data?.subscriptionPlans ?? [];
}

export async function fetchUserSubscription() {
  const { data } = await apolloClient.query({
    query: MY_SUBSCRIPTION,
    fetchPolicy: 'network-only',
  });
  return data?.mySubscription ?? null;
}

export async function fetchUserCapabilities() {
  const { data } = await apolloClient.query({
    query: MY_CAPABILITIES,
    fetchPolicy: 'network-only',
  });
  return data?.myCapabilities ?? null;
}

export async function fetchSubscriptionPortal() {
  const { data } = await apolloClient.query({
    query: SUBSCRIPTION_PORTAL,
    fetchPolicy: 'network-only',
  });
  return data?.subscriptionPortal?.url ?? null;
}

export async function fetchUserTransactions({ page = 1, pageSize = 20 } = {}) {
  const { data } = await apolloClient.query({
    query: MY_TRANSACTIONS,
    variables: { page, pageSize },
    fetchPolicy: 'network-only',
  });
  return data?.myTransactions ?? [];
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Kick off a Stripe Checkout session for the given plan.
 * Returns the Stripe-hosted checkout URL — redirect the user to it.
 */
export async function startSubscriptionCheckout(planId) {
  const { data } = await apolloClient.mutate({
    mutation: CREATE_SUBSCRIPTION,
    variables: { planId },
  });
  const url = data?.createSubscription?.url;
  if (!url) throw new Error('No checkout URL returned');
  return url;
}

/**
 * Cancel the user's subscription at the end of the current billing period.
 */
export async function cancelUserSubscription() {
  const { data } = await apolloClient.mutate({
    mutation: CANCEL_SUBSCRIPTION,
    refetchQueries: [{ query: MY_SUBSCRIPTION }],
  });
  return data?.cancelSubscription ?? false;
}

/**
 * Undo a pending cancellation.
 */
export async function reactivateUserSubscription() {
  const { data } = await apolloClient.mutate({
    mutation: RESUME_SUBSCRIPTION,
    refetchQueries: [{ query: MY_SUBSCRIPTION }],
  });
  return data?.resumeSubscription ?? null;
}

/**
 * Fetch the user's subscription invoices (mapped from payment transactions).
 */
export async function fetchUserInvoices({ page = 1, pageSize = 20 } = {}) {
  const txns = await fetchUserTransactions({ page, pageSize });
  return txns.map((t) => ({ ...t, date: t.createdAt }));
}

/**
 * Switch the user's active subscription to a different plan (inline Stripe update).
 * Returns the updated subscription.
 */
export async function updateUserSubscription(planId) {
  const { data } = await apolloClient.mutate({
    mutation: UPDATE_SUBSCRIPTION,
    variables: { planId },
    refetchQueries: [{ query: MY_SUBSCRIPTION }],
  });
  return data?.updateSubscription ?? null;
}

/**
 * Open the Stripe Customer Portal (manage payment method, download invoices, cancel).
 * Fetches the portal URL and redirects the browser.
 */
export async function openBillingPortal() {
  const url = await fetchSubscriptionPortal();
  if (!url) throw new Error('Billing portal unavailable');
  window.location.href = url;
}
