// src/modules/wishlist/resolvers.js

import { Wishlist, m_Card, Listing, Collection, User, Profile, sequelize } from '../../models/index.js';
import { ensureCardExists } from '../cards/ensureCardExists.service.js'; // CHANGED
import { requireAuth, requireAdmin } from './helpers.js';
import { maybeGrantAchievement } from '../achievements/helpers.js';

const DEFAULT_PAGE_SIZE = 20;

const resolvers = {
  Query: {
    myWishlist: async (_, { page = 1, pageSize = DEFAULT_PAGE_SIZE }, { token }) => {
      const payload = requireAuth(token);
      const { count, rows } = await Wishlist.findAndCountAll({
        where: { userId: payload.id },
        include: [{ model: m_Card, as: 'card' }],
        limit: pageSize,
        offset: (page - 1) * pageSize,
        order: [['addedAt', 'DESC']]
      });
      // Defensive: remove 'condition' if present
      const cleanedRows = rows.map(r => {
        const { condition, ...entry } = r.get ? r.get() : r;
        return entry;
      });
      return { entries: cleanedRows, total: count, page, pageSize };
    },
    wishlist: async (_, { userId, page = 1, pageSize = DEFAULT_PAGE_SIZE }) => {
      const { count, rows } = await Wishlist.findAndCountAll({
        where: { userId },
        include: [{ model: m_Card, as: 'card' }],
        limit: pageSize,
        offset: (page - 1) * pageSize,
        order: [['addedAt', 'DESC']]
      });
      // Defensive: remove 'condition' if present
      const cleanedRows = rows.map(r => {
        const { condition, ...entry } = r.get ? r.get() : r;
        return entry;
      });
      return { entries: cleanedRows, total: count, page, pageSize };
    },
    wishlistEntry: async (_, { cardId, variation }, { token }) => {
      const payload = requireAuth(token);
      // Variation is used as provided (no null fallback)
      const r = await Wishlist.findOne({
        where: { userId: payload.id, cardId, variation },
        include: [{ model: m_Card, as: 'card' }]
      });
      if (!r) return null;
      const { condition, ...entry } = r.get ? r.get() : r;
      return entry;
    }
  },
  Mutation: {
    addToWishlist: async (_, { cardId, quantity = 1, variation, notes }, { token }) => {
      const payload = requireAuth(token);
      const t = await sequelize.transaction();
      try {
        await ensureCardExists(cardId, { transaction: t }); // CHANGED

        let entry = await Wishlist.findOne({
          where: { userId: payload.id, cardId, variation },
          lock: t.LOCK.UPDATE,
          transaction: t
        });
        if (entry) {
          entry.quantity += quantity;
          if (notes !== undefined) entry.notes = notes;
          await entry.save({ transaction: t });
        } else {
          entry = await Wishlist.create({
            userId: payload.id,
            cardId,
            quantity,
            variation,
            notes
          }, { transaction: t });
        }
        await t.commit();
        const count = await Wishlist.count({ where: { userId: payload.id } });
        if (count === 1) {
          await maybeGrantAchievement(payload.id, 'first_wishlist_entry', { cardId });
        }
        const { condition, ...outEntry } = entry.get ? entry.get() : entry;
        return outEntry;
      } catch (err) {
        await t.rollback();
        throw err;
      }
    },
    removeFromWishlist: async (_, { cardId, variation }, { token }) => {
      const payload = requireAuth(token);
      const entry = await Wishlist.findOne({
        where: { userId: payload.id, cardId, variation }
      });
      if (!entry) throw new Error('Entry not found');
      await entry.destroy();
      return true;
    },
    updateWishlistEntry: async (_, { cardId, variation, quantity, notes }, { token }) => {
      const payload = requireAuth(token);
      const t = await sequelize.transaction();
      try {
        const entry = await Wishlist.findOne({
          where: { userId: payload.id, cardId, variation },
          lock: t.LOCK.UPDATE,
          transaction: t
        });
        if (!entry) throw new Error('Entry not found');
        if (quantity !== undefined) entry.quantity = quantity;
        if (notes !== undefined) entry.notes = notes;
        await entry.save({ transaction: t });
        await t.commit();
        const { condition, ...outEntry } = entry.get ? entry.get() : entry;
        return outEntry;
      } catch (err) {
        await t.rollback();
        throw err;
      }
    },
    // moveToCollection mutation implemented in collection module
    // Admin mutations unchanged
  },
  WishlistEntry: {
    card: async (entry) => entry.card || m_Card.findByPk(entry.cardId), // CHANGED
    marketplaceListings: async (entry) => Listing.findAll({ where: { cardId: entry.cardId, status: 'active' } }),
    forTradeUsers: async (entry) => {
      const entries = await Collection.findAll({ where: { cardId: entry.cardId, wishlist: false } });
      const userIds = [...new Set(entries.map(e => e.userId))];
      if (!userIds.length) return [];
      const profiles = await Profile.findAll({ where: { userId: userIds, wantsTrade: true } });
      const tradeUserIds = profiles.map(p => p.userId);
      if (!tradeUserIds.length) return [];
      return User.findAll({ where: { id: tradeUserIds } });
    }
  }
};

export default resolvers;
