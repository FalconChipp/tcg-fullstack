// src/modules/collections/resolvers.js

import { Collection, Card } from '../../models/index.js';
import { requireAuth } from './helpers.js';

const resolvers = {
  Query: {
    myCollection: async (_, __, { token }) => {
      const payload = requireAuth(token);
      return Collection.findAll({
        where: { userId: payload.id, wishlist: false },
        include: [{ model: Card }]
      });
    },
    collection: async (_, { userId }) => {
      return Collection.findAll({
        where: { userId, wishlist: false },
        include: [{ model: Card }]
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
        include: [{ model: Card }]
      });
    },
  },

  Mutation: {
    addToCollection: async (_, { cardId, quantity = 1, condition, variation }, { token }) => {
      const payload = requireAuth(token);

      let entry = await Collection.findOne({
        where: { userId: payload.id, cardId, variation: variation || null, wishlist: false }
      });
      if (entry) {
        entry.quantity += quantity;
        if (condition !== undefined) entry.condition = condition;
        await entry.save();
      } else {
        entry = await Collection.create({
          userId: payload.id,
          cardId,
          quantity,
          condition,
          variation,
          wishlist: false
        });
      }
      return entry;
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
      const entry = await Collection.findOne({
        where: { userId: payload.id, cardId, variation: variation || null, wishlist: false }
      });
      if (!entry) throw new Error('Entry not found');
      if (quantity !== undefined) entry.quantity = quantity;
      if (condition !== undefined) entry.condition = condition;
      await entry.save();
      return entry;
    },

    moveToWishlist: async (_, { cardId, variation }, { token }) => {
      const payload = requireAuth(token);
      const entry = await Collection.findOne({
        where: { userId: payload.id, cardId, variation: variation || null, wishlist: false }
      });
      if (!entry) throw new Error('Entry not found');
      entry.wishlist = true;
      await entry.save();
      return entry;
    },

    moveToCollection: async (_, { cardId, variation }, { token }) => {
      const payload = requireAuth(token);
      const entry = await Collection.findOne({
        where: { userId: payload.id, cardId, variation: variation || null, wishlist: true }
      });
      if (!entry) throw new Error('Entry not found in wishlist');
      entry.wishlist = false;
      await entry.save();
      return entry;
    },
  },

  Collection: {
    card: async (col) => {
      return Card.findByPk(col.cardId);
    }
  }
};

export default resolvers;
