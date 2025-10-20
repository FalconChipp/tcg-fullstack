// src/modules/collections/resolvers.js

import { Collection, Wishlist, m_Card, sequelize } from '../../models/index.js';
import { ensureCardExists } from '../cards/ensureCardExists.service.js'; // CHANGED
import { mapModelCardToCardsearchCard } from '../cardsearch/services/cardMapping.service.js'; // CHANGED
import { requireAuth } from './helpers.js';
import { maybeGrantAchievement } from '../achievements/helpers.js';

// Normalize variation to null if empty, undefined, or blank
function normalizeVariation(v) {
  return (!v || String(v).trim() === "") ? null : String(v).trim();
}

const resolvers = {
  Query: {
    // Fetch logged-in user's collection (not wishlist items)
    myCollection: async (_, __, { token }) => {
      const payload = requireAuth(token);
      return Collection.findAll({
        where: { userId: payload.id, wishlist: false },
        include: [{ model: m_Card, as: 'card' }]
      });
    },
    // Fetch any user's collection (not wishlist items)
    collection: async (_, { userId }) => {
      return Collection.findAll({
        where: { userId, wishlist: false },
        include: [{ model: m_Card, as: 'card' }]
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
        include: [{ model: m_Card, as: 'card' }]
      });
    },
  },

  Collection: {
    card: async (entry) => { // CHANGED
      const card = entry.card || await m_Card.findByPk(entry.cardId);
      return mapModelCardToCardsearchCard(card, { fallbackCardId: entry.cardId });
    },
  },

  Mutation: {
    // Add a card to collection (not wishlist)
    addToCollection: async (_, { cardId, quantity = 1, condition, variation }, { token }) => {
      const payload = requireAuth(token);
      const t = await sequelize.transaction();
      try {
        await ensureCardExists(cardId, { transaction: t }); // CHANGED
        let entry = await Collection.findOne({
          where: {
            userId: payload.id,
            cardId,
            variation: normalizeVariation(variation),
            wishlist: false
          },
          transaction: t,
          lock: t.LOCK.UPDATE
        });
        if (entry) {
          entry.quantity += quantity;
          if (condition !== undefined) entry.condition = condition;
          await entry.save({ transaction: t });
        } else {
          entry = await Collection.create({
            userId: payload.id,
            cardId,
            quantity,
            condition,
            variation: normalizeVariation(variation),
            wishlist: false
          }, { transaction: t });
        }
        await t.commit();
        const count = await Collection.count({ where: { userId: payload.id, wishlist: false } });
        if (count === 1) {
          await maybeGrantAchievement(payload.id, 'first_collection_entry', { cardId });
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
          wishlist: false
        }
      });
      if (!entry) throw new Error('Entry not found');
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
            wishlist: false
          },
          transaction: t,
          lock: t.LOCK.UPDATE
        });
        if (!entry) throw new Error('Entry not found');
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
            wishlist: false
          },
          transaction: t,
          lock: t.LOCK.UPDATE
        });
        if (!entry) throw new Error('Entry not found');
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
        await ensureCardExists(cardId, { transaction: t }); // CHANGED

        // 1. Find the wishlist entry to move
        const wishlistEntry = await Wishlist.findOne({
          where: {
            userId: payload.id,
            cardId,
            variation: normalizeVariation(variation)
          },
          transaction: t,
          lock: t.LOCK.UPDATE
        });

        if (!wishlistEntry) {
          await t.rollback();
          throw new Error("Entry not found in wishlist");
        }

        // Save fields from wishlist entry
        const quantity = wishlistEntry.quantity || 1;

        // Remove from wishlist
        await wishlistEntry.destroy({ transaction: t });

        // 2. Add to collection (or increment if already present)
        let collectionEntry = await Collection.findOne({
          where: {
            userId: payload.id,
            cardId,
            variation: normalizeVariation(variation),
            wishlist: false
          },
          transaction: t,
          lock: t.LOCK.UPDATE
        });

        if (collectionEntry) {
          collectionEntry.quantity += quantity;
          await collectionEntry.save({ transaction: t });
        } else {
          collectionEntry = await Collection.create({
            userId: payload.id,
            cardId,
            variation: normalizeVariation(variation),
            quantity,
            wishlist: false
          }, { transaction: t });
        }

        await t.commit();
        return collectionEntry;
      } catch (err) {
        await t.rollback();
        throw err;
      }
    },
  },

  // Auto-resolve the associated card for each collection entry
  Collection: {
    card: async (col) => col.card || Card.findByPk(col.cardId)
  }
};

export default resolvers;
