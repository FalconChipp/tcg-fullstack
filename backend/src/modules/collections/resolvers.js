// src/modules/collections/resolvers.js
const { Collection, Card, Binder, User } = require('../../models');
const helpers = require('../auth/helpers');
const { Op } = require('sequelize');

module.exports = {
  Query: {
    myCollection: async (parent, { binderId }, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      const where = { userId: payload.id };
      if (binderId) where.binderId = binderId;
      return await Collection.findAll({ where });
    },
    collection: async (parent, { userId }, context) => {
      // Could limit to admin in a real app
      return await Collection.findAll({ where: { userId } });
    },
    collectionEntry: async (parent, { cardId }, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      return await Collection.findOne({ where: { userId: payload.id, cardId } });
    },
  },
  Mutation: {
    addToCollection: async (parent, { cardId, quantity = 1, binderId }, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      // Optionally: Validate card exists in the Card table (skip if not strict)
      let entry = await Collection.findOne({
        where: { userId: payload.id, cardId }
      });
      if (entry) {
        entry.quantity += quantity;
        if (binderId !== undefined) entry.binderId = binderId;
        await entry.save();
      } else {
        entry = await Collection.create({
          userId: payload.id,
          cardId,
          quantity,
          binderId: binderId || null
        });
      }
      return entry;
    },
    updateCollectionEntry: async (parent, { id, quantity, binderId }, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      const entry = await Collection.findByPk(id);
      if (!entry) throw new Error('Entry not found');
      if (entry.userId !== payload.id) throw new Error('No permission');
      if (quantity !== undefined) entry.quantity = quantity;
      if (binderId !== undefined) entry.binderId = binderId;
      await entry.save();
      return entry;
    },
    removeFromCollection: async (parent, { id }, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      const entry = await Collection.findByPk(id);
      if (!entry) throw new Error('Entry not found');
      if (entry.userId !== payload.id) throw new Error('No permission');
      await entry.destroy();
      return true;
    }
  },
  Collection: {
    card: async (entry) => await Card.findByPk(entry.cardId),
    binder: async (entry) => entry.binderId ? await Binder.findByPk(entry.binderId) : null
  }
};
