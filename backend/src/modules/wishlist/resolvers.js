import { Wishlist, Card, Listing, Collection, User, Profile, sequelize } from '../../models/index.js';
import { requireAuth, requireAdmin } from './helpers.js';
import { maybeGrantAchievement } from '../achievements/helpers.js';

const DEFAULT_PAGE_SIZE = 20;

const resolvers = {
  Query: {
    myWishlist: async (_, { page = 1, pageSize = DEFAULT_PAGE_SIZE }, { token }) => {
      const payload = requireAuth(token);
      const { count, rows } = await Wishlist.findAndCountAll({
        where: { userId: payload.id },
        include: [{ model: Card, as: 'card' }],
        limit: pageSize,
        offset: (page - 1) * pageSize,
        order: [['addedAt', 'DESC']]
      });
      return { entries: rows, total: count, page, pageSize };
    },
    wishlist: async (_, { userId, page = 1, pageSize = DEFAULT_PAGE_SIZE }) => {
      const { count, rows } = await Wishlist.findAndCountAll({
        where: { userId },
        include: [{ model: Card, as: 'card' }],
        limit: pageSize,
        offset: (page - 1) * pageSize,
        order: [['addedAt', 'DESC']]
      });
      return { entries: rows, total: count, page, pageSize };
    },
    wishlistEntry: async (_, { cardId, variation }, { token }) => {
      const payload = requireAuth(token);
      return Wishlist.findOne({
        where: { userId: payload.id, cardId, variation: variation || null },
        include: [{ model: Card, as: 'card' }]
      });
    }
  },
  Mutation: {
    addToWishlist: async (_, { cardId, quantity = 1, condition, variation, notes }, { token }) => {
      const payload = requireAuth(token);
      const t = await sequelize.transaction();
      try {
        let entry = await Wishlist.findOne({
          where: { userId: payload.id, cardId, variation: variation || null },
          lock: t.LOCK.UPDATE,
          transaction: t
        });
        if (entry) {
          entry.quantity += quantity;
          if (condition !== undefined) entry.condition = condition;
          if (notes !== undefined) entry.notes = notes;
          await entry.save({ transaction: t });
        } else {
          entry = await Wishlist.create({
            userId: payload.id,
            cardId,
            quantity,
            condition,
            variation,
            notes
          }, { transaction: t });
        }
        await t.commit();
        const count = await Wishlist.count({ where: { userId: payload.id } });
        if (count === 1) {
          await maybeGrantAchievement(payload.id, 'first_wishlist_entry', { cardId });
        }
        return entry;
      } catch (err) {
        await t.rollback();
        throw err;
      }
    },
    removeFromWishlist: async (_, { cardId, variation }, { token }) => {
      const payload = requireAuth(token);
      const entry = await Wishlist.findOne({ where: { userId: payload.id, cardId, variation: variation || null } });
      if (!entry) throw new Error('Entry not found');
      await entry.destroy();
      return true;
    },
    updateWishlistEntry: async (_, { cardId, variation, quantity, condition, notes }, { token }) => {
      const payload = requireAuth(token);
      const t = await sequelize.transaction();
      try {
        const entry = await Wishlist.findOne({
          where: { userId: payload.id, cardId, variation: variation || null },
          lock: t.LOCK.UPDATE,
          transaction: t
        });
        if (!entry) throw new Error('Entry not found');
        if (quantity !== undefined) entry.quantity = quantity;
        if (condition !== undefined) entry.condition = condition;
        if (notes !== undefined) entry.notes = notes;
        await entry.save({ transaction: t });
        await t.commit();
        return entry;
      } catch (err) {
        await t.rollback();
        throw err;
      }
    },
    // moveToCollection mutation implemented in collection module
    // ---- Admin mutations ----
    adminAddToWishlist: async (_, { userId, cardId, quantity = 1, condition, variation, notes }, { token }) => {
      requireAdmin(token);
      const t = await sequelize.transaction();
      try {
        let entry = await Wishlist.findOne({
          where: { userId, cardId, variation: variation || null },
          lock: t.LOCK.UPDATE,
          transaction: t
        });
        if (entry) {
          entry.quantity += quantity;
          if (condition !== undefined) entry.condition = condition;
          if (notes !== undefined) entry.notes = notes;
          await entry.save({ transaction: t });
        } else {
          entry = await Wishlist.create({ userId, cardId, quantity, condition, variation, notes }, { transaction: t });
        }
        await t.commit();
        return entry;
      } catch (err) {
        await t.rollback();
        throw err;
      }
    },
    adminRemoveFromWishlist: async (_, { userId, cardId, variation }, { token }) => {
      requireAdmin(token);
      const entry = await Wishlist.findOne({ where: { userId, cardId, variation: variation || null } });
      if (!entry) return false;
      await entry.destroy();
      return true;
    },
    adminClearWishlist: async (_, { userId }, { token }) => {
      requireAdmin(token);
      await Wishlist.destroy({ where: { userId } });
      return true;
    }
  },
  WishlistEntry: {
    // Use eager loaded association when available
    card: async (entry) => entry.card || Card.findByPk(entry.cardId),
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
