// backend/src/modules/marketplace/services/inventoryService.js

/**
 * inventoryService
 * -----------------------------------------------------------------------------
 * Centralized inventory logic for PRODUCT-type listings.
 *
 * WHAT'S INCLUDED
 * - Read operations: list + getById
 * - Admin adjustments: adjustInventory (onHand/reserved/sold deltas or sets)
 * - Safe stock operations: reserve(), release(), convertReservationToSold()
 * - Optional helpers: createInventoryItem(), attachInventoryToListing()
 *
 * AUTH MODEL
 * - Read endpoints are open to authenticated users (tighten if needed).
 * - Adjustments & create/attach require admin/staff.
 *
 * NOTES
 * - Inventory is NOT used for CARD listings (cards rely on user collections).
 * - All write operations support Sequelize transactions and row locks.
 * ----------------------------------------------------------------------------- 
 */

import { Op } from 'sequelize';

/* -------------------------------- Utilities -------------------------------- */

function requireAuth(ctx) {
  if (!ctx?.user?.id) {
    const err = new Error('Authentication required');
    err.code = 'UNAUTHENTICATED';
    throw err;
  }
  return ctx.user;
}

function isAdminLike(user) {
  return user?.role === 'admin' || user?.role === 'staff' || user?.isAdmin === true;
}

function clampNonNegative(n) {
  return Math.max(0, Number.isFinite(n) ? n : 0);
}

function lockRowOptions(txn) {
  // Only add lock if a transaction is provided (dialect-safe)
  return txn ? { transaction: txn, lock: txn.LOCK?.UPDATE || undefined } : {};
}

/* -------------------------------- Service ---------------------------------- */

const inventoryService = {
  /* ============================== Queries ================================= */

  /**
   * Fetch inventory items (paginated).
   * @param {{ limit?: number, offset?: number, productId?: string, listingId?: string }} args
   * @param {*} ctx
   */
  async getInventoryItems(args = {}, ctx) {
    requireAuth(ctx);
    const { InventoryItem } = ctx.models;

    const limit = Math.min(Math.max(parseInt(args.limit ?? 25, 10), 1), 100);
    const offset = Math.max(parseInt(args.offset ?? 0, 10), 0);

    const where = {};
    if (args.productId) where.productId = args.productId;
    if (args.listingId) where.listingId = args.listingId;

    return InventoryItem.findAll({
      where,
      limit,
      offset,
      order: [['updatedAt', 'DESC']],
    });
  },

  /**
   * Get a single inventory item by id.
   * @param {string} id
   * @param {*} ctx
   */
  async getInventoryById(id, ctx) {
    requireAuth(ctx);
    const { InventoryItem } = ctx.models;
    const inv = await InventoryItem.findByPk(id);
    if (!inv) throw new Error('Inventory item not found');
    return inv;
  },

  /* ============================== Admin Ops ================================ */

  /**
   * Create an InventoryItem (admin/staff only).
   * Useful when preparing stock before creating/attaching a product listing.
   */
  async createInventoryItem(payload = {}, ctx, txn) {
    const user = requireAuth(ctx);
    if (!isAdminLike(user)) throw new Error('Only admins/staff can create inventory');

    const { InventoryItem } = ctx.models;

    const inv = await InventoryItem.create(
      {
        productId: payload.productId ?? null,
        listingId: payload.listingId ?? null,
        onHand: clampNonNegative(Number(payload.onHand ?? 0)),
        reserved: 0,
        sold: 0,
        lowStockThreshold: payload.lowStockThreshold ?? null,
        restockExpectedAt: payload.restockExpectedAt ?? null,
        metadataJson: payload.metadataJson ?? null,
      },
      txn ? { transaction: txn } : undefined
    );

    return inv;
  },

  /**
   * Attach an InventoryItem to a product Listing (admin/staff only).
   * Ensures the targeted listing is PRODUCT type.
   */
  async attachInventoryToListing({ inventoryId, listingId }, ctx, txn) {
    const user = requireAuth(ctx);
    if (!isAdminLike(user)) throw new Error('Only admins/staff can attach inventory');

    const { InventoryItem, Listing } = ctx.models;

    const [inv, listing] = await Promise.all([
      InventoryItem.findByPk(inventoryId, lockRowOptions(txn)),
      Listing.findByPk(listingId, lockRowOptions(txn)),
    ]);

    if (!inv) throw new Error('Inventory item not found');
    if (!listing) throw new Error('Listing not found');
    if (listing.type !== 'PRODUCT') {
      throw new Error('Inventory can only be attached to PRODUCT listings');
    }

    inv.listingId = listing.id;
    await inv.save(txn ? { transaction: txn } : undefined);

    // Optionally copy listing.inventoryId for direct convenience linkage
    listing.inventoryId = inv.id;
    await listing.save(txn ? { transaction: txn } : undefined);

    return inv;
  },

  /**
   * Adjust inventory counts (admin/staff only).
   * Accepts either absolute set values OR additive deltas. Both can be used;
   * sets apply first, then deltas. All values are clamped to >= 0.
   *
   * @param {string} inventoryId
   * @param {{ onHand?: number, reserved?: number, sold?: number, dOnHand?: number, dReserved?: number, dSold?: number }} changes
   * @param {*} ctx
   */
  async adjustInventory(inventoryId, changes = {}, ctx) {
    const user = requireAuth(ctx);
    if (!isAdminLike(user)) throw new Error('Only admins/staff can adjust inventory');

    const { sequelize, models } = ctx;
    const { InventoryItem } = models;

    const updated = await sequelize.transaction(async (txn) => {
      const inv = await InventoryItem.findByPk(inventoryId, lockRowOptions(txn));
      if (!inv) throw new Error('Inventory item not found');

      // Absolute sets first (if provided)
      if (typeof changes.onHand === 'number') inv.onHand = clampNonNegative(changes.onHand);
      if (typeof changes.reserved === 'number') inv.reserved = clampNonNegative(changes.reserved);
      if (typeof changes.sold === 'number') inv.sold = clampNonNegative(changes.sold);

      // Then additive deltas (if provided)
      if (typeof changes.dOnHand === 'number') inv.onHand = clampNonNegative(inv.onHand + changes.dOnHand);
      if (typeof changes.dReserved === 'number') inv.reserved = clampNonNegative(inv.reserved + changes.dReserved);
      if (typeof changes.dSold === 'number') inv.sold = clampNonNegative(inv.sold + changes.dSold);

      await inv.save({ transaction: txn });
      return inv;
    });

    return updated;
  },

  /* ============================ Stock Operations =========================== */

  /**
   * Reserve quantity for a PRODUCT listing (typically on order creation).
   * Decrements onHand and increments reserved atomically.
   * @param {{ inventoryId: string, qty: number }} params
   * @param {*} ctx
   * @param {*} txn optional Sequelize transaction
   */
  async reserve({ inventoryId, qty }, ctx, txn) {
    const { InventoryItem } = ctx.models;
    if (!Number.isInteger(qty) || qty <= 0) throw new Error('qty must be a positive integer');

    const inv = await InventoryItem.findByPk(inventoryId, lockRowOptions(txn));
    if (!inv) throw new Error('Inventory item not found');

    if (inv.onHand < qty) throw new Error('Insufficient stock');
    inv.onHand -= qty;
    inv.reserved += qty;

    await inv.save(txn ? { transaction: txn } : undefined);
    return inv;
    // NOTE: permissions are handled at the higher-level order/listing services
  },

  /**
   * Release a prior reservation (e.g., on order cancel before payment).
   * Increments onHand and decrements reserved.
   */
  async release({ inventoryId, qty }, ctx, txn) {
    const { InventoryItem } = ctx.models;
    if (!Number.isInteger(qty) || qty <= 0) throw new Error('qty must be a positive integer');

    const inv = await InventoryItem.findByPk(inventoryId, lockRowOptions(txn));
    if (!inv) return null;

    inv.reserved = clampNonNegative(inv.reserved - qty);
    inv.onHand += qty;

    await inv.save(txn ? { transaction: txn } : undefined);
    return inv;
  },

  /**
   * Convert a reservation into sold units (e.g., after Stripe payment success).
   * Decrements reserved and increments sold.
   */
  async convertReservationToSold({ inventoryId, qty }, ctx, txn) {
    const { InventoryItem } = ctx.models;
    if (!Number.isInteger(qty) || qty <= 0) throw new Error('qty must be a positive integer');

    const inv = await InventoryItem.findByPk(inventoryId, lockRowOptions(txn));
    if (!inv) return null;

    inv.reserved = clampNonNegative(inv.reserved - qty);
    inv.sold += qty;

    await inv.save(txn ? { transaction: txn } : undefined);
    return inv;
  },
};

export default inventoryService;
