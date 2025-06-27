import Stripe from 'stripe';
import { Subscription } from '../../models/index.js';
import { notifyRenewal, notifyPaymentFailure } from './notifications.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function handleStripeWebhook(event) {
  switch (event.type) {
    case 'invoice.payment_succeeded': {
      const subId = event.data.object.subscription;
      const subscription = await Subscription.findOne({ where: { stripeSubId: subId } });
      if (subscription) {
        subscription.status = 'active';
        subscription.periodEnd = new Date(event.data.object.lines.data[0].period.end * 1000);
        await subscription.save();
        await notifyRenewal(subscription.userId);
      }
      break;
    }
    case 'invoice.payment_failed': {
      const subId = event.data.object.subscription;
      const subscription = await Subscription.findOne({ where: { stripeSubId: subId } });
      if (subscription) {
        subscription.status = 'past_due';
        await subscription.save();
        await notifyPaymentFailure(subscription.userId);
      }
      break;
    }
    default:
      break;
  }
}
