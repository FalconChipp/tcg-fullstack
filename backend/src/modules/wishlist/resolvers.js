// src/modules/wishlist/resolvers.js
//
// UPDATED (2026-01-13):
// - Added Wishlist status support across resolvers
//   - addToWishlist now accepts optional `status` and defaults to ACTIVE
//   - updateWishlistEntry now accepts optional `status`
//   - Admin mutations implemented with optional `status`
// - Defensive output: ensures `status` always returns a valid value (ACTIVE fallback)
// - Kept existing "condition" stripping defensive mapping
// - No breaking changes to existing query shapes / includes

import {
  Wishlist,
  m_Card,
  Listing,
  Collection,
  User,
  Profile,
  sequelize,
} from "../../models/index.js";
import { ensureCardExists } from "../cards/ensureCardExists.service.js";
import { requireAuth, requireAdmin } from "./helpers.js";
import { maybeGrantAchievement } from "../achievements/helpers.js";

const DEFAULT_PAGE_SIZE = 20;

// ✅ NEW: status allowlist (must match GraphQL enum values)
const WISHLIST_STATUS = new Set(["ACTIVE", "GRAIL", "EVENTUAL", "UPGRADE"]);
const DEFAULT_STATUS = "ACTIVE";

// ✅ NEW: normalize incoming status safely
function normalizeStatus(status) {
  if (typeof status !== "string") return null;
  const s = status.trim().toUpperCase();
  return WISHLIST_STATUS.has(s) ? s : null;
}

// ✅ NEW: always return a status even if DB row doesn't have it yet
function withSafeStatus(entryLike) {
  if (!entryLike || typeof entryLike !== "object") return entryLike;
  const current = entryLike.status;
  const safe = normalizeStatus(current) || DEFAULT_STATUS;
  return { ...entryLike, status: safe };
}

// Existing defensive cleaner, but now also ensures status exists
function cleanEntry(row) {
  const raw = row?.get ? row.get() : row;
  if (!raw) return raw;

  // Defensive: remove 'condition' if present (you had this already)
  // CHANGED: also enforce a safe status
  // eslint-disable-next-line no-unused-vars
  const { condition, ...rest } = raw;
  return withSafeStatus(rest);
}

const resolvers = {
  Query: {
    myWishlist: async (_, { page = 1, pageSize = DEFAULT_PAGE_SIZE }, { token }) => {
      const payload = requireAuth(token);

      const { count, rows } = await Wishlist.findAndCountAll({
        where: { userId: payload.id },
        include: [{ model: m_Card, as: "card" }],
        limit: pageSize,
        offset: (page - 1) * pageSize,
        order: [["addedAt", "DESC"]],
      });

      const cleanedRows = rows.map(cleanEntry);
      return { entries: cleanedRows, total: count, page, pageSize };
    },

    wishlist: async (_, { userId, page = 1, pageSize = DEFAULT_PAGE_SIZE }) => {
      const { count, rows } = await Wishlist.findAndCountAll({
        where: { userId },
        include: [{ model: m_Card, as: "card" }],
        limit: pageSize,
        offset: (page - 1) * pageSize,
        order: [["addedAt", "DESC"]],
      });

      const cleanedRows = rows.map(cleanEntry);
      return { entries: cleanedRows, total: count, page, pageSize };
    },

    wishlistEntry: async (_, { cardId, variation }, { token }) => {
      const payload = requireAuth(token);

      const r = await Wishlist.findOne({
        where: { userId: payload.id, cardId, variation },
        include: [{ model: m_Card, as: "card" }],
      });

      if (!r) return null;
      return cleanEntry(r);
    },
  },

  Mutation: {
    // UPDATED: accepts optional status and defaults to ACTIVE
    addToWishlist: async (
      _,
      { cardId, quantity = 1, variation, notes, status }, // ✅ CHANGED: added status
      { token }
    ) => {
      const payload = requireAuth(token);
      const t = await sequelize.transaction();

      try {
        await ensureCardExists(cardId, { transaction: t });

        const normalized = normalizeStatus(status) || DEFAULT_STATUS;

        let entry = await Wishlist.findOne({
          where: { userId: payload.id, cardId, variation },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (entry) {
          entry.quantity += quantity;
          if (notes !== undefined) entry.notes = notes;

          // ✅ CHANGED: allow status update on add (if provided)
          if (status !== undefined) entry.status = normalized;

          await entry.save({ transaction: t });
        } else {
          entry = await Wishlist.create(
            {
              userId: payload.id,
              cardId,
              quantity,
              variation,
              notes,

              // ✅ CHANGED: set initial status
              status: normalized,
            },
            { transaction: t }
          );
        }

        await t.commit();

        // achievement unchanged
        const count = await Wishlist.count({ where: { userId: payload.id } });
        if (count === 1) {
          await maybeGrantAchievement(payload.id, "first_wishlist_entry", { cardId });
        }

        return cleanEntry(entry);
      } catch (err) {
        await t.rollback();
        throw err;
      }
    },

    removeFromWishlist: async (_, { cardId, variation }, { token }) => {
      const payload = requireAuth(token);

      const entry = await Wishlist.findOne({
        where: { userId: payload.id, cardId, variation },
      });

      if (!entry) throw new Error("Entry not found");
      await entry.destroy();
      return true;
    },

    // UPDATED: accepts optional status
    updateWishlistEntry: async (
      _,
      { cardId, variation, quantity, notes, status }, // ✅ CHANGED: added status
      { token }
    ) => {
      const payload = requireAuth(token);
      const t = await sequelize.transaction();

      try {
        const entry = await Wishlist.findOne({
          where: { userId: payload.id, cardId, variation },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (!entry) throw new Error("Entry not found");

        if (quantity !== undefined) entry.quantity = quantity;
        if (notes !== undefined) entry.notes = notes;

        // ✅ CHANGED: status update
        if (status !== undefined) {
          const normalized = normalizeStatus(status);
          if (!normalized) throw new Error("Invalid wishlist status");
          entry.status = normalized;
        }

        await entry.save({ transaction: t });
        await t.commit();

        return cleanEntry(entry);
      } catch (err) {
        await t.rollback();
        throw err;
      }
    },

    /* ---------------- Admin mutations ---------------- */

    adminAddToWishlist: async (
      _,
      { userId, cardId, quantity = 1, condition, variation, notes, status }, // schema includes condition; keep it but ignore if you don't store it
      { token }
    ) => {
      await requireAdmin(token);
      const t = await sequelize.transaction();

      try {
        await ensureCardExists(cardId, { transaction: t });

        const normalized = normalizeStatus(status) || DEFAULT_STATUS;

        let entry = await Wishlist.findOne({
          where: { userId, cardId, variation },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (entry) {
          entry.quantity = (entry.quantity || 0) + quantity;
          if (notes !== undefined) entry.notes = notes;

          if (status !== undefined) entry.status = normalized;

          await entry.save({ transaction: t });
        } else {
          entry = await Wishlist.create(
            {
              userId,
              cardId,
              quantity,
              variation,
              notes,
              status: normalized,
            },
            { transaction: t }
          );
        }

        await t.commit();
        return cleanEntry(entry);
      } catch (err) {
        await t.rollback();
        throw err;
      }
    },

    adminRemoveFromWishlist: async (_, { userId, cardId, variation }, { token }) => {
      await requireAdmin(token);

      const entry = await Wishlist.findOne({
        where: { userId, cardId, variation },
      });

      if (!entry) throw new Error("Entry not found");
      await entry.destroy();
      return true;
    },

    adminClearWishlist: async (_, { userId }, { token }) => {
      await requireAdmin(token);
      await Wishlist.destroy({ where: { userId } });
      return true;
    },

    // ✅ NEW: Admin update (matches schema I suggested; if your schema doesn't have it, remove this block)
    adminUpdateWishlistEntry: async (
      _,
      { userId, cardId, variation, quantity, condition, notes, status },
      { token }
    ) => {
      await requireAdmin(token);

      const t = await sequelize.transaction();
      try {
        const entry = await Wishlist.findOne({
          where: { userId, cardId, variation },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (!entry) throw new Error("Entry not found");

        if (quantity !== undefined) entry.quantity = quantity;
        if (notes !== undefined) entry.notes = notes;

        if (status !== undefined) {
          const normalized = normalizeStatus(status);
          if (!normalized) throw new Error("Invalid wishlist status");
          entry.status = normalized;
        }

        await entry.save({ transaction: t });
        await t.commit();

        return cleanEntry(entry);
      } catch (err) {
        await t.rollback();
        throw err;
      }
    },
  },

  WishlistEntry: {
    // unchanged; still supports include preloading
    card: async (entry) => entry.card || m_Card.findByPk(entry.cardId),

    marketplaceListings: async (entry) =>
      Listing.findAll({ where: { cardId: entry.cardId, status: "active" } }),

    forTradeUsers: async (entry) => {
      const entries = await Collection.findAll({
        where: { cardId: entry.cardId, wishlist: false },
      });

      const userIds = [...new Set(entries.map((e) => e.userId))];
      if (!userIds.length) return [];

      const profiles = await Profile.findAll({
        where: { userId: userIds, wantsTrade: true },
      });

      const tradeUserIds = profiles.map((p) => p.userId);
      if (!tradeUserIds.length) return [];

      return User.findAll({ where: { id: tradeUserIds } });
    },

    // ✅ NEW: ensure field resolver also guarantees status even if DB row is missing it
    status: (entry) => normalizeStatus(entry?.status) || DEFAULT_STATUS,
  },
};

export default resolvers;
