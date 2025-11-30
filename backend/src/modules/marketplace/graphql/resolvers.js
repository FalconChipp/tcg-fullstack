/**
 * Marketplace GraphQL Resolvers
 * ------------------------------------------------------------------
 * Handles all marketplace operations for:
 *  - Listings (CARD + PRODUCT)
 *  - Offers
 *  - Orders
 *  - Inventory
 *
 * Delegates heavy logic to the service layer for maintainability.
 * ------------------------------------------------------------------
 */

import listingsService from "../services/listingsService.js";
import ordersService from "../services/ordersService.js";
import inventoryService from "../services/inventoryService.js";
import stripeService from "../services/stripeService.js";

// 👇 admin gate for dashboard-only mutations / queries
import { requireAdmin } from "../../users/helpers.js";

export default {
  // =====================================================
  // QUERIES
  // =====================================================
  Query: {
    // ------------------ Listings ------------------
    listings: async (_, args, ctx) => {
      return listingsService.getListings(args, ctx);
    },

    listing: async (_, { id }, ctx) => {
      return listingsService.getListingById(id, ctx);
    },

    // ------------------ Offers ------------------
    offersByUser: async (_, { userId }, ctx) => {
      return listingsService.getOffersByUser(userId, ctx);
    },

    offersForListing: async (_, { listingId }, ctx) => {
      return listingsService.getOffersForListing(listingId, ctx);
    },

    // ------------------ Orders ------------------
    ordersByUser: async (_, { userId }, ctx) => {
      return ordersService.getOrdersByUser(userId, ctx);
    },

    order: async (_, { id }, ctx) => {
      return ordersService.getOrderById(id, ctx);
    },

    // >>> NEW: Admin-wide orders listing
    // Matches adminOrders in typeDefs.
    adminOrders: async (_, args, ctx) => {
      // requireAdmin will throw if not an admin
      requireAdmin(ctx);
      return ordersService.adminOrders(args, ctx);
    },

    // ------------------ Inventory ------------------
    inventoryItems: async (_, args, ctx) => {
      return inventoryService.getInventoryItems(args, ctx);
    },
  },

  // =====================================================
  // MUTATIONS
  // =====================================================
  Mutation: {
    // ------------------ Listings ------------------
    createCardListing: async (_, { input }, ctx) => {
      return listingsService.createCardListing(input, ctx);
    },

    createProductListing: async (_, { input }, ctx) => {
      return listingsService.createProductListing(input, ctx);
    },

    // Admin-only entry point for the dashboard (create)
    adminCreateProductListing: async (_, { input }, ctx) => {
      // Will throw if the token is missing / invalid / not admin
      const adminPayload = requireAdmin(ctx);

      // If you ever want to force all admin-created products
      // to be sold by a specific "store" user, you could
      // pass extra info via ctx here:
      //   const adminCtx = { ...ctx, adminUser: adminPayload };
      //   return listingsService.createProductListing(input, adminCtx);
      //
      // For now we just reuse ctx so the service behaves as normal.
      return listingsService.createProductListing(input, ctx);
    },

    // Admin-only product edit (POD / merch)
    adminUpdateProductListing: async (_, { id, input }, ctx) => {
      const adminPayload = requireAdmin(ctx);
      // Same idea – could pass admin info down if needed later
      return listingsService.adminUpdateProductListing(id, input, ctx);
    },

    // Seller-owned listing edit (cards & products)
    // - Checks ownership in the service layer (listing.userId === ctx.user.id)
    // - Allows partial updates via ListingUpdateInput
    updateMyListing: async (_, { id, input }, ctx) => {
      return listingsService.updateMyListing(id, input, ctx);
    },

    // Seller removes their own listing (soft delete -> status=removed)
    removeMyListing: async (_, { id }, ctx) => {
      return listingsService.removeMyListing(id, ctx);
    },

    updateListingStatus: async (_, { id, status }, ctx) => {
      return listingsService.updateListingStatus(id, status, ctx);
    },

    deleteListing: async (_, { id }, ctx) => {
      return listingsService.deleteListing(id, ctx);
    },

    // ------------------ Offers ------------------
    createOffer: async (_, { input }, ctx) => {
      return listingsService.createOffer(input, ctx);
    },

    respondToOffer: async (_, { offerId, status, counterPrice }, ctx) => {
      return listingsService.respondToOffer(
        offerId,
        status,
        counterPrice,
        ctx
      );
    },

    // ------------------ Orders ------------------
    createOrder: async (_, { input }, ctx) => {
      // Will delegate to Stripe for product listings or internal flow for cards
      const { order, checkoutUrl } = await ordersService.createOrder(
        input,
        ctx,
        stripeService
      );
      return { order, checkoutUrl };
    },

    // Guest-aware, cleaner order creation flow
    // - Uses CreateOrderFromListingInput
    // - Supports logged-in and guest checkout
    createOrderFromListing: async (_, { input }, ctx) => {
      return ordersService.createOrderFromListing(input, ctx);
    },

    markOrderFulfilled: async (_, { orderId }, ctx) => {
      return ordersService.markOrderFulfilled(orderId, ctx);
    },

    cancelOrder: async (_, { orderId, reason }, ctx) => {
      return ordersService.cancelOrder(orderId, reason, ctx);
    },

    // >>> NEW: admin fulfilment status pipeline
    // Matches adminUpdateOrderFulfilmentStatus in typeDefs.
    adminUpdateOrderFulfilmentStatus: async (
      _,
      { orderId, status },
      ctx
    ) => {
      requireAdmin(ctx);
      return ordersService.adminUpdateOrderFulfilmentStatus(orderId, status, ctx);
    },

    // ------------------ Inventory ------------------
    adjustInventory: async (
      _,
      { inventoryId, onHand, reserved, sold },
      ctx
    ) => {
      return inventoryService.adjustInventory(
        inventoryId,
        { onHand, reserved, sold },
        ctx
      );
    },
  },

  // =====================================================
  // INTERFACE + TYPE RESOLVERS
  // =====================================================

  /**
   * Resolve Listing interface type dynamically.
   * Apollo requires this to distinguish between CARD and PRODUCT.
   */
  MarketplaceListing: {
    __resolveType(obj) {
      if (obj.type === "CARD") return "CardListing";
      if (obj.type === "PRODUCT") return "ProductListing";
      return null;
    },
  },

  /**
   * Nested resolvers for field-level associations.
   * These help avoid N+1 problems and give predictable data shapes.
   */

  CardListing: {
    card: async (root, _, ctx) => {
      return listingsService.getCardData(root.cardId, ctx);
    },
    seller: async (root, _, ctx) => {
      return listingsService.getUser(root.userId, ctx);
    },
    buyer: async (root, _, ctx) => {
      if (!root.buyerId) return null;
      return listingsService.getUser(root.buyerId, ctx);
    },
  },

  ProductListing: {
    inventory: async (root, _, ctx) => {
      if (!root.inventoryId) return null;
      return inventoryService.getInventoryById(root.inventoryId, ctx);
    },
    seller: async (root, _, ctx) => {
      return listingsService.getUser(root.userId, ctx);
    },
    buyer: async (root, _, ctx) => {
      if (!root.buyerId) return null;
      return listingsService.getUser(root.buyerId, ctx);
    },
  },

  Offer: {
    buyer: async (root, _, ctx) => {
      return listingsService.getUser(root.buyerId, ctx);
    },
    listing: async (root, _, ctx) => {
      return listingsService.getListingById(root.listingId, ctx);
    },
  },

  Order: {
    // Handle guest orders (buyerId can be null)
    buyer: async (root, _, ctx) => {
      if (!root.buyerId) return null;
      return listingsService.getUser(root.buyerId, ctx);
    },
    seller: async (root, _, ctx) => {
      if (!root.sellerId) return null;
      return listingsService.getUser(root.sellerId, ctx);
    },
    listing: async (root, _, ctx) => {
      return listingsService.getListingById(root.listingId, ctx);
    },
  },
};
