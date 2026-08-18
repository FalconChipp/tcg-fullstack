// src/utils/webPush.js
// Helpers for Web Push subscription management (VAPID / PushManager API).
// Uses executeQuery (raw fetch) so these can be called from non-Apollo contexts.

import { executeQuery } from '@/utils/graphqlUtils';

const VAPID_KEY_QUERY = `
  query VapidPublicKey {
    vapidPublicKey
  }
`;

const SUBSCRIBE_MUTATION = `
  mutation SubscribeWebPush($endpoint: String!, $p256dh: String!, $auth: String!, $userAgent: String) {
    subscribeWebPush(endpoint: $endpoint, p256dh: $p256dh, auth: $auth, userAgent: $userAgent)
  }
`;

const UNSUBSCRIBE_MUTATION = `
  mutation UnsubscribeWebPush($endpoint: String!) {
    unsubscribeWebPush(endpoint: $endpoint)
  }
`;

/** Convert a base64url string to a Uint8Array (required by PushManager.subscribe) */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Register the service worker if not already registered. */
async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('Service workers not supported');
  const existing = await navigator.serviceWorker.getRegistration('/sw.js');
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

/**
 * Request notification permission, subscribe to Web Push, and save the
 * subscription to the backend.
 *
 * @param {string} token - JWT auth token from AuthContext
 * @returns {Promise<PushSubscription>} The active push subscription.
 * @throws  If permission is denied or subscription fails.
 */
export async function enableWebPush(token) {
  if (!('PushManager' in window)) {
    throw new Error('Push notifications are not supported in this browser');
  }

  // 1. Request browser permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission denied');

  // 2. Fetch VAPID public key from the gateway
  const keyData  = await executeQuery(VAPID_KEY_QUERY, {}, token);
  const vapidKey = keyData?.vapidPublicKey;
  if (!vapidKey) throw new Error('Web push not configured on server');

  // 3. Register service worker and subscribe
  const registration = await ensureServiceWorker();
  await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly:      true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  // 4. Persist subscription to backend
  const sub = subscription.toJSON();
  const ua  = navigator.userAgent.slice(0, 200);

  await executeQuery(SUBSCRIBE_MUTATION, {
    endpoint:  sub.endpoint,
    p256dh:    sub.keys.p256dh,
    auth:      sub.keys.auth,
    userAgent: ua,
  }, token);

  return subscription;
}

/**
 * Unsubscribe from Web Push and remove the subscription from the backend.
 *
 * @param {string} token - JWT auth token from AuthContext
 */
export async function disableWebPush(token) {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  // Notify backend (best-effort)
  try {
    await executeQuery(UNSUBSCRIBE_MUTATION, { endpoint }, token);
  } catch {
    // Subscription is already unsubscribed locally — backend cleanup is best-effort
  }
}

/**
 * Returns the current browser push subscription if one exists, otherwise null.
 */
export async function getCurrentPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** Returns true if the browser supports push notifications at all. */
export function isPushSupported() {
  return typeof window !== 'undefined' && 'PushManager' in window && 'serviceWorker' in navigator;
}
