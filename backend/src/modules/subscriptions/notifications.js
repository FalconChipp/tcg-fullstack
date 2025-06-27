import { notifyUser } from '../../utils/notifications.js';

export async function notifyRenewal(userId) {
  await notifyUser({
    userId,
    type: 'subscription',
    title: 'Subscription Renewed',
    body: 'Your subscription has been renewed successfully.',
  });
}

export async function notifyPaymentFailure(userId) {
  await notifyUser({
    userId,
    type: 'subscription',
    title: 'Payment Failed',
    body: 'We could not process your subscription payment.',
  });
}
