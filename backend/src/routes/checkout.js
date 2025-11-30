// src/routes/checkout.js
// Checkout entrypoint:
//   POST /checkout/create-stripe-session
//
// Responsibilities:
//  - Validate incoming cart + customer payload
//  - Create an Order row (status "pending", paymentMethod "STRIPE")
//  - Calculate shipping (cards must be sent tracked)
//  - Create a Stripe Checkout Session for subtotal + shipping
//  - Save stripeSessionId on the Order
//  - Discord / email notifications are sent once the order is PAID
//    (via Stripe webhook -> ordersService.markOrderPaid)

import express from "express";
import Stripe from "stripe";
import * as models from "../models/index.js";

// NEW: shipping helpers (MVP rules: UK-only, cards must be tracked)
import {
  estimateShipping,
  normaliseShippingAddress,
} from "../services/shippingService.js";

console.log("[checkout] router file loaded");

const router = express.Router();

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  console.warn(
    "[checkout] STRIPE_SECRET_KEY is not set; checkout route will fail until configured."
  );
}
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

router.post("/create-stripe-session", async (req, res) => {
  const logger = req.app.get("logger") || console;

  try {
    if (!stripe) {
      return res
        .status(500)
        .json({ ok: false, error: "Stripe not configured" });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const customer = body.customer || {};

    if (!items.length) {
      return res.status(400).json({ ok: false, error: "Cart is empty" });
    }

    // --- Compute subtotal from the cart we got from the frontend ---
    const subtotal = items.reduce((acc, item) => {
      const qty = Number(item.qty) || 1;
      const price = Number(item.price) || 0;
      return acc + qty * price;
    }, 0);

    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid subtotal / cart pricing" });
    }

    const currency =
      (items[0] && (items[0].currency || "GBP")) || "GBP";
    const totalQty = items.reduce(
      (acc, item) => acc + (Number(item.qty) || 0),
      0
    );

    // ----------------------------------------------------------------
    // SHIPPING (MVP)
    // ----------------------------------------------------------------
    // Uses shippingService:
    //  - UK-only
    //  - Mixed cart -> highest applicable rate
    //  - Any CARD in the cart -> shipping is TRACKED
    //
    // estimateShipping(items, customer) returns:
    //   {
    //     zoneCode, methodCode, methodLabel,
    //     cost, tracked, requiresTracking, address
    //   }
    // ----------------------------------------------------------------
    const shipping = estimateShipping(items, customer);
    const shippingCost = Number(shipping.cost || 0);
    const total = subtotal + shippingCost;

    // Normalise / persist shipping address on the order
    const shippingAddressJson = normaliseShippingAddress(customer);

    // --- Resolve primary listing & seller (for Order fields) ---
    const listingIds = items
      .map((it) => it.listingId)
      .filter(Boolean);

    const Listing = models.Listing;
    const Order = models.Order;

    if (!Order) {
      logger.error(
        "[checkout] Order model is undefined. Did you export it from src/models/index.js?"
      );
      return res
        .status(500)
        .json({ ok: false, error: "Order model not available" });
    }

    let primaryListing = null;
    let sellerId = null;

    if (Listing && listingIds.length) {
      const listings = await Listing.findAll({
        where: { id: listingIds },
      });
      if (listings && listings.length) {
        primaryListing = listings[0];
        sellerId = primaryListing.userId || null;
      }
    }

    // Fallback listingId from cart if DB lookup fails
    const listingIdFromCart = items[0].listingId || items[0].id;

    // ---------------------------------------------------------
    // Generate a human-friendly orderNumber explicitly
    // ---------------------------------------------------------
    let orderNumber = null;
    if (typeof Order.generateOrderNumber === "function") {
      orderNumber = await Order.generateOrderNumber();
    }

    // Small fulfilment summary object for later (Discord, admin, etc.)
    const hasPod = items.some((it) => it.fulfilmentType === "POD");
    const hasInternal = items.some(
      (it) => !it.fulfilmentType || it.fulfilmentType === "INTERNAL"
    );
    const hasCards = items.some((it) => {
      const raw = it.fulfilmentType || it.productType;
      return raw && String(raw).toUpperCase() === "CARD";
    });

    const fulfilmentSummary = {
      hasPod,
      hasInternal,
      hasCards,
      requiresTracking: !!shipping.requiresTracking,
    };

    // --- Create Order row (one row for the whole cart) ---
    const order = await Order.create({
      id: undefined, // let UUID default handle this
      orderNumber,   // ensure NOT NULL for validation

      listingId: primaryListing ? primaryListing.id : listingIdFromCart,
      buyerId: user.id,
      sellerId,
      quantity: totalQty,
      subtotal,
      tax: 0,
      shippingCost,
      total,
      currency,
      paymentMethod: "STRIPE",
      status: "pending",

      // Guest-related fields (we're using logged-in user here)
      guestCheckout: false,
      buyerEmail: customer.email || null,
      buyerName: customer.name || null,

      shippingAddressJson,
      metadataJson: {
        cartItems: items,
        shipping: {
          zoneCode: shipping.zoneCode,
          methodCode: shipping.methodCode,
          methodLabel: shipping.methodLabel,
          cost: shippingCost,
          tracked: shipping.tracked,
          requiresTracking: shipping.requiresTracking,
        },
        fulfilmentSummary,
      },
    });

    // --- Build Stripe line items from the cart (products) ---
    const stripeLineItems = items.map((item) => {
      const qty = Number(item.qty) || 1;
      const unitAmount = Math.round((Number(item.price) || 0) * 100);

      // PRODUCT TYPE MAPPING
      // - If item.productType is provided -> use it as-is.
      // - Else if fulfilmentType === "POD"  -> "CLOTHING"
      // - Else (INTERNAL / anything else)  -> "3D_PRINT"
      let productType = item.productType;
      if (!productType) {
        if (item.fulfilmentType === "POD") {
          productType = "CLOTHING";
        } else {
          productType = "3D_PRINT";
        }
      }

      const metaParts = [];
      metaParts.push(productType);
      if (item.colourName) metaParts.push(item.colourName);
      if (item.sizeLabel) metaParts.push(`Size ${item.sizeLabel}`);

      return {
        quantity: qty,
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: unitAmount,
          product_data: {
            name: item.title || "Marketplace item",
            description: metaParts.join(" • ") || undefined,
          },
        },
      };
    });

    // --- Add a separate shipping line item (if any shipping cost) ---
    if (shippingCost > 0) {
      stripeLineItems.push({
        quantity: 1,
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: Math.round(shippingCost * 100),
          product_data: {
            name: shipping.tracked ? "Tracked shipping" : "Shipping",
            description: shipping.methodLabel || "Shipping",
          },
        },
      });
    }

    // --- Success / cancel URLs (Stripe requires success_url) ---
    const origin = (req.headers.origin || "").replace(/\/+$/, "");

    // DEFAULTS:
    // - success should point to the marketplace success page
    // - cancel can go back to the main marketplace or cart page
    const defaultSuccess = origin
      ? `${origin}/marketplace/success`
      : "";

    const defaultCancel = origin ? `${origin}/marketplace` : "";

    const rawSuccess =
      process.env.CHECKOUT_SUCCESS_URL || defaultSuccess;
    const rawCancel =
      process.env.CHECKOUT_CANCEL_URL || defaultCancel || rawSuccess;

    if (!rawSuccess) {
      logger.error(
        "[checkout] No CHECKOUT_SUCCESS_URL configured and no Origin fallback – cannot create Stripe session."
      );
      return res.status(500).json({
        ok: false,
        error:
          "Checkout is not configured correctly (missing success URL). Please try again later.",
      });
    }

    const successBase = rawSuccess.replace(/\/+$/, "");
    const cancelBase = rawCancel.replace(/\/+$/, "");

    if (!process.env.CHECKOUT_SUCCESS_URL) {
      logger.warn(
        `[checkout] CHECKOUT_SUCCESS_URL is not set, using fallback: ${successBase}`
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: stripeLineItems,
      // Stripe requires success_url and cancel_url for redirect flow
      //
      // We pass ?order=<orderId> so /marketplace/success can query
      // the GraphQL order(id: ID!) endpoint and poll status.
      success_url: `${successBase}?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelBase || successBase,
      customer_email: customer.email || undefined,
      metadata: {
        orderId: order.id,
      },
    });

    order.stripeSessionId = session.id;
    await order.save();

    return res.json({
      ok: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (err) {
    const logger = req.app.get("logger") || console;
    logger.error?.(
      `[checkout] create-stripe-session failed: ${err.stack || err.message}`
    );
    return res
      .status(500)
      .json({ ok: false, error: "Failed to start checkout" });
  }
});

export default router;
