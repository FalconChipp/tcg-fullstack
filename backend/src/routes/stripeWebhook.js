// src/routes/stripeWebhook.js
// Stripe webhook handler
//
// Responsibilities:
//  - Verify Stripe signature
//  - Handle checkout.session.completed
//  - Call ordersService.markOrderPaid(orderId, ctx)
//    -> which will update inventory, mark order paid, and trigger notifications.

import express from "express";
import Stripe from "stripe";
import * as models from "../models/index.js";
import ordersService from "../modules/marketplace/services/ordersService.js";

const router = express.Router();

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecret) {
  console.warn(
    "[stripeWebhook] STRIPE_SECRET_KEY is not set; webhook will not verify signatures."
  );
}

const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

// IMPORTANT:
// This router expects to be mounted with `express.raw({ type: "application/json" })`
// so that we can verify the Stripe signature. Example (in your main server file):
//
//   import stripeWebhookRouter from "./routes/stripeWebhook.js";
//
//   app.post(
//     "/webhooks/stripe",
//     express.raw({ type: "application/json" }),
//     stripeWebhookRouter
//   );
//
// Do this BEFORE `app.use(express.json())`.

router.post("/", async (req, res) => {
  const logger = req.app?.get("logger") || console;

  if (!stripe) {
    logger.error("[stripeWebhook] Stripe is not configured");
    return res.status(500).send("Stripe not configured");
  }

  let event;

  try {
    if (webhookSecret) {
      const signature = req.headers["stripe-signature"];
      if (!signature) {
        logger.error("[stripeWebhook] Missing Stripe-Signature header");
        return res.status(400).send("Missing signature");
      }

      // req.body is a Buffer because we used express.raw
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret
      );
    } else {
      // Fallback (not recommended in production): accept the raw body without verification.
      logger.warn(
        "[stripeWebhook] STRIPE_WEBHOOK_SECRET not set; skipping signature verification."
      );
      event = JSON.parse(req.body.toString("utf8"));
    }
  } catch (err) {
    logger.error(
      "[stripeWebhook] Error verifying Stripe webhook:",
      err?.message || err
    );
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        const orderId =
          session.metadata && session.metadata.orderId
            ? session.metadata.orderId
            : null;

        if (!orderId) {
          logger.error(
            "[stripeWebhook] checkout.session.completed missing metadata.orderId"
          );
          break;
        }

        // Build a minimal ctx similar to GraphQL ctx
        const sequelize =
          models.sequelize || models.defaultSequelize || null;

        const ctx = {
          models,
          sequelize,
          user: null, // webhook is system-initiated
          logger,
        };

        logger.info(
          `[stripeWebhook] Marking order ${orderId} as paid (session ${session.id})`
        );

        await ordersService.markOrderPaid(orderId, ctx);

        break;
      }

      default: {
        // You can log other events if you want to debug
        logger.debug?.(
          `[stripeWebhook] Ignoring event type ${event.type}`
        );
      }
    }

    // Stripe expects a 2xx quickly
    return res.status(200).send("ok");
  } catch (err) {
    logger.error(
      "[stripeWebhook] Handler error:",
      err?.stack || err?.message || err
    );
    return res.status(500).send("Webhook handler error");
  }
});

export default router;
