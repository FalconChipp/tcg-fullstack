// backend/src/modules/marketplace/services/stripeService.js

/**
 * stripeService
 * -----------------------------------------------------------------------------
 * Handles Stripe Checkout session creation and webhook verification/processing.
 *
 * Exposed API:
 *  - createCheckoutSession(order, { listing, buyer })
 *  - verifyAndProcessWebhook(rawBody, signature, { stripe, ordersService, models, ctx })
 *
 * ENV VARS (required):
 *  - STRIPE_SECRET_KEY
 *  - STRIPE_WEBHOOK_SECRET
 *  - STRIPE_SUCCESS_URL (e.g., https://tcg.sixbyfive.com/checkout/success?order={ORDER_ID})
 *  - STRIPE_CANCEL_URL  (e.g., https://tcg.sixbyfive.com/checkout/cancel)
 *
 * NOTES:
 *  - We send amounts in minor units (pence) as integers.
 *  - We persist orderId and listingId in session metadata for reliable webhook mapping.
 *  - On 'checkout.session.completed' (paid), we mark order paid.
 * -----------------------------------------------------------------------------
 */

import Stripe from 'stripe';

// Convert "12.34" (string/decimal) -> 1234 (int pence)
function decimalToMinorUnits(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid amount: ${value}`);
  return Math.round(n * 100);
}

// Build a single line item for the listing
function buildLineItemFromListing(listing, order) {
  const name =
    listing?.type === 'PRODUCT'
      ? listing?.title ?? 'Product'
      : `Card: ${listing?.cardId ?? 'Listing'}`;

  const unitAmount = decimalToMinorUnits(listing.price); // GBP → pence
  const quantity = order.quantity ?? 1;

  return {
    price_data: {
      currency: (listing.currency || 'GBP').toLowerCase(),
      unit_amount: unitAmount,
      product_data: {
        name,
        images: listing?.imageUrl ? [listing.imageUrl] : undefined,
        metadata: {
          listingId: listing?.id ?? '',
          listingType: listing?.type ?? '',
        },
      },
    },
    quantity,
  };
}

/**
 * Create Stripe Checkout Session for PRODUCT orders.
 * CARD orders should use escrow/balance later; we guard by listing.type.
 */
async function createCheckoutSession(order, { listing, buyer }) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  if (!process.env.STRIPE_SUCCESS_URL || !process.env.STRIPE_CANCEL_URL) {
    throw new Error('STRIPE_SUCCESS_URL / STRIPE_CANCEL_URL are not set');
  }

  if (listing?.type !== 'PRODUCT') {
    throw new Error('Checkout session is only available for PRODUCT listings');
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // Build line item
  const lineItem = buildLineItemFromListing(listing, order);

  // Success URL can carry orderId for redirect display
  const successUrl = process.env.STRIPE_SUCCESS_URL.replace('{ORDER_ID}', order.id);
  const cancelUrl = process.env.STRIPE_CANCEL_URL;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [lineItem],
    customer_email: buyer?.email ?? undefined,
    allow_promotion_codes: true,
    metadata: {
      orderId: order.id,
      listingId: listing.id,
      listingType: listing.type,
      sellerId: String(listing.userId ?? ''),
      buyerId: String(buyer?.id ?? ''),
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session;
}

/**
 * Verify Stripe webhook signature and process events.
 * On a successful checkout, we mark the related order as paid.
 *
 * Usage: call from your Express raw webhook route.
 */
async function verifyAndProcessWebhook(rawBody, signature, { stripe, ordersService, models, ctx }) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  }
  if (!stripe) {
    // Allow DI, but build if not passed (useful in ad-hoc scripts)
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  // 1) Verify signature & parse event
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const error = new Error(`Stripe webhook signature verification failed: ${err.message}`);
    error.code = 'STRIPE_VERIFY_FAILED';
    throw error;
  }

  // 2) Handle event types we care about
  switch (event.type) {
    case 'checkout.session.completed': {
      // Payment is complete and the funds have been captured
      const session = event.data.object;

      // Try to map back to our order via metadata
      const orderId =
        session?.metadata?.orderId ||
        // If not in metadata, try to look up by session id later:
        null;

      if (!orderId) {
        // Final fallback: you could query models.Order by stripeSessionId === session.id
        // if you persisted it at creation time (we do in ordersService.createOrder).
        const order = await models.Order.findOne({ where: { stripeSessionId: session.id } });
        if (!order) throw new Error('Order not found for completed checkout session');
        await ordersService.markOrderPaid(order.id, ctx);
        break;
      }

      await ordersService.markOrderPaid(orderId, ctx);
      break;
    }

    case 'payment_intent.succeeded': {
      // Optional: if you create PaymentIntents directly (not Checkout)
      // You could map by payment_intent metadata or by models.Order.stripePaymentIntentId
      // Leaving for completeness; not needed for Checkout-only flow.
      break;
    }

    case 'charge.refunded':
    case 'charge.refund.updated':
    case 'refund.updated': {
      // Optional: implement refunds mapping if needed later
      break;
    }

    default:
      // Unhandled events are fine; just ignore
      break;
  }

  return { ok: true, type: event.type };
}

export default {
  createCheckoutSession,
  verifyAndProcessWebhook,
};
