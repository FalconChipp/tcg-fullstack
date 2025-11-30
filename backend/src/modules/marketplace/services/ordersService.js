// backend/src/modules/marketplace/services/ordersService.js

/**
 * ordersService
 * -----------------------------------------------------------------------------
 * Unified order & checkout flow for CARD and PRODUCT listings.
 *
 * Responsibilities:
 *  - createOrderFromListing: guest-aware non-Stripe flow
 *  - createOrder: Stripe-capable flow (PRODUCT now; CARD later)
 *  - markOrderPaid: called from Stripe webhook after successful payment
 *  - cancelOrder / fulfil order
 *  - adminOrders + adminUpdateOrderFulfilmentStatus
 *
 * Status model (aligned with GraphQL enums + Order model):
 *  - Legacy: status: OrderStatus
 *      -> pending | paid | fulfilled | completed | cancelled | refunded
 *  - Payment: paymentStatus: OrderPaymentStatus
 *      -> pending | paid | refunded | failed | cancelled
 *  - Fulfilment: fulfilmentStatus: OrderFulfilmentStatus
 *      -> pending | processing | in_printing | shipped | completed | cancelled
 *
 * Notification behaviour:
 *  - createOrderFromListing (non-Stripe):
 *      * Immediately sends "order placed" notifications.
 *  - Stripe flow (createOrder + markOrderPaid):
 *      * createOrder DOES NOT send notifications.
 *      * markOrderPaid sends "order placed" notifications AFTER payment.
 *  - adminUpdateOrderFulfilmentStatus:
 *      * Calls sendOrderFulfilmentStatusEmail for key transitions
 *        (in_printing, shipped). Function itself guards which statuses.
 * -----------------------------------------------------------------------------
 */

import { Op } from "sequelize";
import {
  requireAuth,
  isAdminLike,
  assertPositiveInt,
  assertPositivePrice,
} from "../utils/validationUtils.js";

import inventoryService from "./inventoryService.js";
import podFulfilmentService from "./podFulfilmentService.js";
import {
  sendOrderPlacedNotifications,
  sendOrderFulfilmentStatusEmail,
} from "./orderNotificationService.js";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Keep legacy `status` roughly in sync with fulfilment + payment status
 * so older UIs / queries still behave sensibly.
 *
 * Rules (simplified):
 *  - paymentStatus === "refunded"      -> status = "refunded"
 *  - fulfilmentStatus === "cancelled"  -> status = "cancelled"
 *  - fulfilmentStatus === "completed"  -> status = "completed"
 *  - fulfilmentStatus === "shipped"    -> status = "fulfilled"
 *  - paymentStatus === "paid"          -> status = "paid"
 *  - otherwise                         -> status = "pending"
 */
function syncLegacyStatus(order) {
  const pay = (order.paymentStatus || "").toLowerCase();
  const ful = (order.fulfilmentStatus || "").toLowerCase();

  if (pay === "refunded") {
    order.status = "refunded";
    return;
  }

  if (ful === "cancelled") {
    order.status = "cancelled";
    return;
  }

  if (ful === "completed") {
    order.status = "completed";
    return;
  }

  if (ful === "shipped") {
    order.status = "fulfilled";
    return;
  }

  if (pay === "paid") {
    order.status = "paid";
    return;
  }

  order.status = "pending";
}

/* -------------------------------- Service --------------------------------- */

const ordersService = {
  /**
   * New, guest-aware order creation flow (non-Stripe).
   *
   * @param {Object} input {
   *   listingId,
   *   quantity?,
   *   guestCheckout?,
   *   buyerEmail?,
   *   buyerName?,
   *   shippingAddress (structured object)
   * }
   * @param {Object} ctx { models, sequelize, user, logger? }
   */
  async createOrderFromListing(input, ctx) {
    const { models, sequelize, user: authUser } = ctx;
    const { Listing, Order } = models;
    const logger = ctx?.logger || console;

    const qty = Number.isInteger(input?.quantity) ? input.quantity : 1;
    assertPositiveInt(qty, "quantity");

    const {
      listingId,
      guestCheckout = false,
      buyerEmail,
      buyerName,
      shippingAddress,
    } = input;

    if (!shippingAddress) {
      throw new Error("shippingAddress is required");
    }

    if (guestCheckout) {
      if (!buyerEmail) {
        throw new Error("buyerEmail is required for guest checkout");
      }
    } else if (!authUser) {
      throw new Error("You must be signed in or use guestCheckout");
    }

    const listing = await Listing.findByPk(listingId);
    if (!listing) throw new Error("Listing not found");
    if (listing.status !== "active")
      throw new Error("Listing is not available");

    // Prevent logged-in buyers purchasing their own listings
    if (!guestCheckout && authUser && listing.userId === authUser.id) {
      throw new Error("You cannot buy your own listing");
    }

    // Totals (extend with tax/shipping later)
    assertPositivePrice(listing.price, "listing price");
    const subtotal = (Number(listing.price) * qty).toFixed(2);
    const tax = (0).toFixed(2);
    const shippingCost = (0).toFixed(2);
    const total = (
      Number(subtotal) +
      Number(tax) +
      Number(shippingCost)
    ).toFixed(2);

    const buyerId = !guestCheckout && authUser ? authUser.id : null;

    // Transaction: optional inventory reservation + order create
    const order = await sequelize.transaction(async (txn) => {
      // Reserve inventory for product listings with inventory
      if (listing.type === "PRODUCT" && listing.inventoryId) {
        await inventoryService.reserve(
          { inventoryId: listing.inventoryId, qty },
          ctx,
          txn
        );
      }

      const createdOrder = await Order.create(
        {
          listingId: listing.id,
          buyerId,
          sellerId: listing.userId ?? null,
          quantity: qty,
          subtotal,
          tax,
          shippingCost,
          total,
          currency: listing.currency || "GBP",

          paymentMethod: null, // to be set if you wire a payment processor
          paymentStatus: "pending",
          fulfilmentStatus: "pending",
          status: "pending",

          // Guest-aware fields
          guestCheckout,
          buyerEmail: buyerEmail || null,
          buyerName: buyerName || null,

          // Structured address from input (already JSON)
          shippingAddressJson: shippingAddress,

          metadataJson: {
            listingSnapshot: {
              id: listing.id,
              title: listing.title,
              type: listing.type,
              price: listing.price,
              currency: listing.currency,
            },
            createdVia: "createOrderFromListing",
          },
        },
        { transaction: txn }
      );

      return createdOrder;
    });

    // 🔔 Send notifications immediately for this non-Stripe flow.
    try {
      await sendOrderPlacedNotifications(order.id, ctx);
    } catch (err) {
      logger.error?.(
        "[ordersService] createOrderFromListing: notification error:",
        err?.message || err
      );
    }

    return order;
  },

  /**
   * Create an order for Stripe / card checkout.
   *
   * @param {Object} input { listingId, quantity, shippingAddressJson?, paymentMethod? }
   * @param {Object} ctx   { models, sequelize, user, logger? }
   * @param {Object} stripeService dependency with createCheckoutSession(order, opts)
   */
  async createOrder(input, ctx, stripeService) {
    const user = requireAuth(ctx);
    const { models, sequelize } = ctx;
    const { Listing, Order } = models;

    const qty = Number.isInteger(input?.quantity) ? input.quantity : 1;
    assertPositiveInt(qty, "quantity");

    const listing = await Listing.findByPk(input.listingId);
    if (!listing) throw new Error("Listing not found");
    if (listing.status !== "active")
      throw new Error("Listing is not available");
    if (listing.userId === user.id)
      throw new Error("You cannot buy your own listing");

    // Totals
    assertPositivePrice(listing.price, "listing price");
    const subtotal = (Number(listing.price) * qty).toFixed(2);
    const tax = (0).toFixed(2);
    const shippingCost = (0).toFixed(2);
    const total = (
      Number(subtotal) +
      Number(tax) +
      Number(shippingCost)
    ).toFixed(2);

    // Transaction: order + (maybe) inventory reservation
    const order = await sequelize.transaction(async (txn) => {
      if (listing.type === "PRODUCT" && listing.inventoryId) {
        await inventoryService.reserve(
          { inventoryId: listing.inventoryId, qty },
          ctx,
          txn
        );
      }

      const createdOrder = await Order.create(
        {
          listingId: listing.id,
          buyerId: user.id,
          sellerId: listing.userId ?? null,
          quantity: qty,
          subtotal,
          tax,
          shippingCost,
          total,
          currency: listing.currency || "GBP",
          paymentMethod:
            input?.paymentMethod ||
            (listing.type === "PRODUCT" ? "STRIPE" : "INTERNAL"),

          // Status model
          paymentStatus: "pending",
          fulfilmentStatus: "pending",
          status: "pending",

          shippingAddressJson: input?.shippingAddressJson ?? null,
          metadataJson: null,
        },
        { transaction: txn }
      );

      return createdOrder;
    });

    let checkoutUrl = null;
    if (
      listing.type === "PRODUCT" &&
      order.paymentMethod === "STRIPE" &&
      stripeService?.createCheckoutSession
    ) {
      const session = await stripeService.createCheckoutSession(order, {
        listing,
        buyer: user,
      });
      checkoutUrl = session?.url ?? null;
      await order.update({
        stripeSessionId: session?.id ?? null,
        stripePaymentIntentId: session?.payment_intent ?? null,
      });
    }

    // No notifications yet – wait for markOrderPaid.
    return { order, checkoutUrl };
  },

  /**
   * Mark an order fulfilled (legacy seller/admin action).
   */
  async markOrderFulfilled(orderId, ctx) {
    const user = requireAuth(ctx);
    const { models } = ctx;
    const { Order } = models;

    const order = await Order.findByPk(orderId);
    if (!order) throw new Error("Order not found");

    if (order.sellerId !== user.id && !isAdminLike(user)) {
      throw new Error("You are not allowed to fulfill this order");
    }

    if (!["paid", "fulfilled"].includes(order.status)) {
      throw new Error("Order must be paid before it can be fulfilled");
    }

    order.fulfilmentStatus = "completed";
    order.fulfilledAt = new Date();
    syncLegacyStatus(order);

    await order.save();
    return order;
  },

  /**
   * Cancel an order (buyer/seller/admin).
   * - Releases product reservation if not yet paid.
   */
  async cancelOrder(orderId, reason, ctx) {
    const user = requireAuth(ctx);
    const { models, sequelize } = ctx;
    const { Order, Listing } = models;

    const order = await Order.findByPk(orderId);
    if (!order) throw new Error("Order not found");

    const canCancel =
      isAdminLike(user) ||
      order.buyerId === user.id ||
      order.sellerId === user.id;

    if (!canCancel) throw new Error("You are not allowed to cancel this order");

    if (["fulfilled", "completed", "refunded"].includes(order.status)) {
      throw new Error("This order can no longer be cancelled");
    }

    await sequelize.transaction(async (txn) => {
      const listing = await Listing.findByPk(order.listingId, {
        transaction: txn,
      });
      const isProductWithInv =
        listing?.type === "PRODUCT" && listing?.inventoryId;

      if (isProductWithInv && order.status === "pending") {
        await inventoryService.release(
          { inventoryId: listing.inventoryId, qty: order.quantity },
          ctx,
          txn
        );
      }

      order.fulfilmentStatus = "cancelled";

      if (order.paymentStatus === "pending") {
        order.paymentStatus = "cancelled";
      }

      order.cancelledAt = new Date();
      order.cancelledReason = reason || null;

      syncLegacyStatus(order);

      await order.save({ transaction: txn });
    });

    return order;
  },

  /**
   * Called from Stripe webhook on successful payment.
   *
   * @param {string|number} orderId
   * @param {Object} ctx { models, sequelize, logger?, user? }
   */
  async markOrderPaid(orderId, ctx) {
    const { models, sequelize } = ctx;
    const { Order, Listing } = models;
    const logger = ctx?.logger || console;

    const order = await Order.findByPk(orderId);
    if (!order) throw new Error("Order not found");
    if (order.paymentStatus === "paid") return order; // idempotent

    await sequelize.transaction(async (txn) => {
      const listing = await Listing.findByPk(order.listingId, {
        transaction: txn,
      });
      if (!listing) throw new Error("Listing not found for order");

      const isProductWithInv =
        listing.type === "PRODUCT" && listing.inventoryId;

      // 1) Standard internal inventory flow
      if (isProductWithInv) {
        await inventoryService.convertReservationToSold(
          { inventoryId: listing.inventoryId, qty: order.quantity },
          ctx,
          txn
        );
      }

      // 2) Mark payment as paid
      order.paymentStatus = "paid";
      order.paidAt = new Date();

      if (!order.fulfilmentStatus || order.fulfilmentStatus === "pending") {
        order.fulfilmentStatus = "processing";
      }

      syncLegacyStatus(order);

      await order.save({ transaction: txn });

      // 3) Mark single-quantity card listings as sold
      if (listing.type === "CARD") {
        if (order.quantity >= (listing.quantity ?? 1)) {
          listing.status = "sold";
          listing.soldAt = new Date();
          await listing.save({ transaction: txn });
        }
      }

      // 4) POD FULFILMENT – will NO-OP if POD config/env missing
      if (listing.type === "PRODUCT" && listing.fulfilmentType === "POD") {
        await podFulfilmentService.createPodOrder({ order, listing }, ctx, txn);
      }
    });

    const updatedOrder = await models.Order.findByPk(orderId);

    try {
      await sendOrderPlacedNotifications(updatedOrder.id, ctx);
    } catch (err) {
      logger.error?.(
        "[ordersService] markOrderPaid: notification error:",
        err?.message || err
      );
    }

    return updatedOrder;
  },

  /**
   * Orders for a user (buyer or seller perspective).
   */
  async getOrdersByUser(userId, ctx) {
    const requester = requireAuth(ctx);
    const { models } = ctx;
    const { Order } = models;

    if (requester.id !== userId && !isAdminLike(requester)) {
      throw new Error("Not allowed to view orders for this user");
    }

    const orders = await Order.findAll({
      where: {
        [Op.or]: [{ buyerId: userId }, { sellerId: userId }],
      },
      order: [["createdAt", "DESC"]],
    });

    return orders;
  },

  async getOrderById(id, ctx) {
    const requester = requireAuth(ctx);
    const { models } = ctx;
    const { Order } = models;

    const order = await Order.findByPk(id);
    if (!order) throw new Error("Order not found");

    if (
      !isAdminLike(requester) &&
      requester.id !== order.buyerId &&
      requester.id !== order.sellerId
    ) {
      throw new Error("Not allowed to view this order");
    }

    return order;
  },

  /**
   * Admin-wide order listing (used by AdminOrdersPanel).
   */
  async getAdminOrders(args, ctx) {
    const admin = requireAuth(ctx);
    if (!isAdminLike(admin)) {
      throw new Error("Admin access required");
    }

    const { models } = ctx;
    const { Order, Listing, User } = models;
    const {
      status,
      fulfilmentStatus,
      paymentStatus,
      listingType,
      limit = 50,
      offset = 0,
    } = args || {};

    const where = {};
    if (status) where.status = status;
    if (fulfilmentStatus) where.fulfilmentStatus = fulfilmentStatus;
    if (paymentStatus) where.paymentStatus = paymentStatus;

    const include = [
      { model: Listing, as: "listing" },
      { model: User, as: "buyer" },
      { model: User, as: "seller" },
    ];

    if (listingType) {
      include[0].where = { ...(include[0].where || {}), type: listingType };
      include[0].required = true;
    }

    const orders = await Order.findAll({
      where,
      include,
      order: [["createdAt", "DESC"]],
      limit: Math.min(limit, 200),
      offset,
    });

    return orders;
  },

  /**
   * Alias used by GraphQL resolvers: adminOrders(...)
   * Thin wrapper around getAdminOrders so we don't need to change resolvers.
   */
  async adminOrders(args, ctx) {
    return this.getAdminOrders(args, ctx);
  },

  /**
   * Admin-only: update fulfilmentStatus for an order and fire emails.
   */
  async adminUpdateOrderFulfilmentStatus(orderId, newStatus, ctx) {
    const admin = requireAuth(ctx);
    if (!isAdminLike(admin)) {
      throw new Error("Admin access required");
    }

    const { models } = ctx;
    const { Order } = models;
    const logger = ctx?.logger || console;

    const order = await Order.findByPk(orderId);
    if (!order) throw new Error("Order not found");

    const oldStatus = order.fulfilmentStatus;

    order.fulfilmentStatus = newStatus;

    const now = new Date();

    if (newStatus === "shipped" && !order.shippedAt) {
      order.shippedAt = now;
    }

    if (newStatus === "completed" && !order.completedAt) {
      order.completedAt = now;
    }

    if (newStatus === "cancelled" && !order.cancelledAt) {
      order.cancelledAt = now;
    }

    syncLegacyStatus(order);

    await order.save();

    // 🔔 Fulfilment update emails / notifications.
    // Function will only send for IN_PRINTING / SHIPPED.
    try {
      await sendOrderFulfilmentStatusEmail(order.id, newStatus, ctx);
    } catch (err) {
      logger.error?.(
        "[ordersService] adminUpdateOrderFulfilmentStatus: notification error:",
        err?.message || err
      );
    }

    // You still have `oldStatus` if you ever want to log transitions.
    if (logger.info) {
      logger.info("[ordersService] fulfilment status updated", {
        orderId: order.id,
        from: oldStatus,
        to: newStatus,
      });
    }

    return order;
  },
};

export default ordersService;
