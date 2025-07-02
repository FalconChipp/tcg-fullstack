// src/modules/collections/resolvers.js

import { Collection, Card, sequelize } from '../../models/index.js';
import { requireAuth } from './helpers.js';
import { maybeGrantAchievement } from '../achievements/helpers.js';

const resolvers = {
  Query: {
    myCollection: async (_, __, { token }) => {
      const payload = requireAuth(token);
      return Collection.findAll({
        where: { userId: payload.id, wishlist: false },
        include: [{ model: Card, as: 'card' }]
      });
    },
    collection: async (_, { userId }) => {
      return Collection.findAll({
        where: { userId, wishlist: false },
        include: [{ model: Card, as: 'card' }]
      });
    },
    collectionEntry: async (_, { cardId, variation }, { token }) => {
      const payload = requireAuth(token);
      return Collection.findOne({
        where: {
          userId: payload.id,
          cardId,
          variation: variation || null,
          wishlist: false,
        },
        include: [{ model: Card, as: 'card' }]
      });
    },
  },

  Mutation: {
    addToCollection: async (_, { cardId, quantity = 1, condition, variation }, { token }) => {
      const payload = requireAuth(token);
      const t = await sequelize.transaction();
      try {
        let entry = await Collection.findOne({
          where: { userId: payload.id, cardId, variation: variation || null, wishlist: false },
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
            variation,
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

    removeFromCollection: async (_, { cardId, variation }, { token }) => {
      const payload = requireAuth(token);
      const entry = await Collection.findOne({
        where: { userId: payload.id, cardId, variation: variation || null, wishlist: false }
      });
      if (!entry) throw new Error('Entry not found');
      await entry.destroy();
      return true;
    },

    updateCollectionEntry: async (_, { cardId, quantity, condition, variation }, { token }) => {
      const payload = requireAuth(token);
      const t = await sequelize.transaction();
      try {
        const entry = await Collection.findOne({
          where: { userId: payload.id, cardId, variation: variation || null, wishlist: false },
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

    moveToWishlist: async (_, { cardId, variation }, { token }) => {
      const payload = requireAuth(token);
      const t = await sequelize.transaction();
      try {
        const entry = await Collection.findOne({
          where: { userId: payload.id, cardId, variation: variation || null, wishlist: false },
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

    moveToCollection: async (_, { cardId, variation }, { token }) => {
      const payload = requireAuth(token);
      const t = await sequelize.transaction();
      try {
        const entry = await Collection.findOne({
          where: { userId: payload.id, cardId, variation: variation || null, wishlist: true },
          transaction: t,
          lock: t.LOCK.UPDATE
        });
        if (!entry) throw new Error('Entry not found in wishlist');
        entry.wishlist = false;
        await entry.save({ transaction: t });
        await t.commit();
        return entry;
      } catch (err) {
        await t.rollback();
        throw err;
      }
    },
  },

  Collection: {
    // Use eager loaded association when available to avoid N+1 queries
    card: async (col) => col.card || Card.findByPk(col.cardId)
  }
};

export default resolvers;
