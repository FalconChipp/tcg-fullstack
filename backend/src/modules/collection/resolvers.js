// src/modules/collections/resolvers.js
//
// UPDATED (2026-02-21)
//
// CHANGES (THIS UPDATE):
// - FIX: Remove reference to mapModelCardToCardsearchCard (it was not defined/imported and caused runtime errors)
// - CHANGE: Collection.card resolver now returns the raw Sequelize model (m_Card) or null
// - KEEP: Single Collection resolver block (no duplication) so it doesn't get overwritten
// - NOTE: This matches your frontend mutation which requests card { id name image setName number rarity }

import { Collection, Wishlist, m_Card, sequelize, User } from "../../models/index.js";
import { ensureCardExists } from "../cards/ensureCardExists.service.js";
import { requireAuth } from "./helpers.js";
import { maybeGrantAchievement } from "../achievements/helpers.js";
import { requireAdmin } from "../users/helpers.js";
import { Op, fn, col } from "sequelize";

// Normalize variation to null if empty, undefined, or blank
function normalizeVariation(v) {
  return !v || String(v).trim() === "" ? null : String(v).trim();
}

const resolvers = {
  Query: {
    // Fetch logged-in user's collection (not wishlist items)
    myCollection: async (_, __, { token }) => {
      const payload = requireAuth(token);
      return Collection.findAll({
        where: { userId: payload.id, wishlist: false },
        include: [{ model: m_Card, as: "card" }],
      });
    },

    // Fetch any user's collection (not wishlist items)
    collection: async (_, { userId }) => {
      return Collection.findAll({
        where: { userId, wishlist: false },
        include: [{ model: m_Card, as: "card" }],
      });
    },

    // Fetch a single collection entry (not wishlist)
    collectionEntry: async (_, { cardId, variation }, { token }) => {
      const payload = requireAuth(token);
      return Collection.findOne({
        where: {
          userId: payload.id,
          cardId,
          variation: normalizeVariation(variation),
          wishlist: false,
        },
        include: [{ model: m_Card, as: "card" }],
      });
    },

    adminUserCollections: async (_parent, { limit, search }, ctx) => {
      requireAdmin(ctx);

      // search by username / email
      const userWhere =
        search && search.trim()
          ? {
              [Op.or]: [
                { username: { [Op.like]: `%${search.trim()}%` } },
                { email: { [Op.like]: `%${search.trim()}%` } },
              ],
            }
          : {};

      const rows = await Collection.findAll({
        attributes: [
          "userId",
          [fn("SUM", col("quantity")), "totalCards"],
          [fn("COUNT", fn("DISTINCT", col("cardId"))), "distinctCards"],
        ],
        include: [
          {
            model: User,
            required: true,
            attributes: ["id", "username", "email"],
            where: userWhere,
          },
        ],
        group: ["Collection.userId", "User.id"],
        order: [[User, "username", "ASC"]],
        limit: limit ?? 200,
        subQuery: false,
      });

      return rows.map((row) => {
        const json = row.toJSON();
        const u = json.User || {};

        return {
          userId: json.userId,
          username: u.username || "",
          email: u.email || "",
          totalCards: Number(json.totalCards ?? 0),
          distinctCards: Number(json.distinctCards ?? 0),
        };
      });
    },
  },

  // FIXED: single Collection resolver block (do not duplicate this key)
  Collection: {
    // UPDATED (2026-02-21)
    //
    // CHANGES:
    // - REMOVED: mapModelCardToCardsearchCard(...) because it was not defined/imported
    // - RETURN: raw m_Card Sequelize model for GraphQL to resolve fields directly
    //
    // Why:
    // - Your frontend requests card { id name image setName number rarity }
    // - Those should exist on your m_Card model (or be resolvable via model fields)
    // - Returning the model avoids runtime mapper errors and fixes addToCollection.card

    card: async (entry) => {
      // Prefer eager-loaded association if present
      const card = entry.card || (await m_Card.findByPk(entry.cardId));

      // Safe null if card isn't in DB for any reason
      return card || null;
    },
  },

  Mutation: {
    // Add a card to collection (not wishlist)
    addToCollection: async (_, { cardId, quantity = 1, condition, variation }, { token }) => {
      const payload = requireAuth(token);
      const t = await sequelize.transaction();

      try {
        await ensureCardExists(cardId, { transaction: t });

        let entry = await Collection.findOne({
          where: {
            userId: payload.id,
            cardId,
            variation: normalizeVariation(variation),
            wishlist: false,
          },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (entry) {
          entry.quantity += quantity;
          if (condition !== undefined) entry.condition = condition;
          await entry.save({ transaction: t });
        } else {
          entry = await Collection.create(
            {
              userId: payload.id,
              cardId,
              quantity,
              condition,
              variation: normalizeVariation(variation),
              wishlist: false,
            },
            { transaction: t }
          );
        }

        await t.commit();

        const count = await Collection.count({
          where: { userId: payload.id, wishlist: false },
        });

        if (count === 1) {
          await maybeGrantAchievement(payload.id, "first_collection_entry", { cardId });
        }

        return entry;
      } catch (err) {
        await t.rollback();
        throw err;
      }
    },

    // Remove a card from collection (not wishlist)
    removeFromCollection: async (_, { cardId, variation }, { token }) => {
      const payload = requireAuth(token);

      const entry = await Collection.findOne({
        where: {
          userId: payload.id,
          cardId,
          variation: normalizeVariation(variation),
          wishlist: false,
        },
      });

      if (!entry) throw new Error("Entry not found");

      await entry.destroy();
      return true;
    },

    // Update collection entry (not wishlist)
    updateCollectionEntry: async (_, { cardId, quantity, condition, variation }, { token }) => {
      const payload = requireAuth(token);
      const t = await sequelize.transaction();

      try {
        const entry = await Collection.findOne({
          where: {
            userId: payload.id,
            cardId,
            variation: normalizeVariation(variation),
            wishlist: false,
          },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!entry) throw new Error("Entry not found");

        if (quantity !== undefined) entry.quantity = quantity;
        if (condition !== undefined) entry.condition = condition;

        await entry.save({ transaction: t });
        await t.commit();

        return entry;
      } catch (err) {
        await t.rollback();
        throw err;
      }
    },

    // Move a card *from* collection *to* wishlist (toggle wishlist true)
    moveToWishlist: async (_, { cardId, variation }, { token }) => {
      const payload = requireAuth(token);
      const t = await sequelize.transaction();

      try {
        const entry = await Collection.findOne({
          where: {
            userId: payload.id,
            cardId,
            variation: normalizeVariation(variation),
            wishlist: false,
          },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!entry) throw new Error("Entry not found");

        entry.wishlist = true;
        await entry.save({ transaction: t });

        await t.commit();
        return entry;
      } catch (err) {
        await t.rollback();
        throw err;
      }
    },

    // PATCHED: Move from wishlist (Wishlist table) to collection (Collection table)
    moveToCollection: async (_, { cardId, variation }, { token }) => {
      const payload = requireAuth(token);
      const t = await sequelize.transaction();

      try {
        await ensureCardExists(cardId, { transaction: t });

        // 1. Find the wishlist entry to move
        const wishlistEntry = await Wishlist.findOne({
          where: {
            userId: payload.id,
            cardId,
            variation: normalizeVariation(variation),
          },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!wishlistEntry) {
          await t.rollback();
          throw new Error("Entry not found in wishlist");
        }

        const quantity = wishlistEntry.quantity || 1;

        // Remove from wishlist
        await wishlistEntry.destroy({ transaction: t });

        // 2. Add to collection (or increment if already present)
        let collectionEntry = await Collection.findOne({
          where: {
            userId: payload.id,
            cardId,
            variation: normalizeVariation(variation),
            wishlist: false,
          },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (collectionEntry) {
          collectionEntry.quantity += quantity;
          await collectionEntry.save({ transaction: t });
        } else {
          collectionEntry = await Collection.create(
            {
              userId: payload.id,
              cardId,
              variation: normalizeVariation(variation),
              quantity,
              wishlist: false,
            },
            { transaction: t }
          );
        }

        await t.commit();
        return collectionEntry;
      } catch (err) {
        await t.rollback();
        throw err;
      }
    },
  },
};

export default resolvers;