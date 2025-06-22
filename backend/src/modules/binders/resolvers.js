// src/modules/binders/resolvers.js
const { Binder, Collection, User } = require('../../models');
const helpers = require('../auth/helpers');

module.exports = {
  Query: {
    binders: async (parent, { userId }, context) => {
      // If userId not provided, use JWT
      let uid = userId;
      if (!uid) {
        if (!context.token) throw new Error('Not authenticated');
        const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
        uid = payload.id;
      }
      return await Binder.findAll({ where: { userId: uid } });
    },
    binder: async (parent, { id }, context) => {
      const binder = await Binder.findByPk(id);
      if (!binder) throw new Error('Binder not found');
      return binder;
    }
  },
  Mutation: {
    createBinder: async (parent, { name, description }, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      const user = await User.findByPk(payload.id);
      if (!user) throw new Error('User not found');
      return await Binder.create({
        name,
        description,
        userId: user.id
      });
    },
    updateBinder: async (parent, { id, name, description }, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      const binder = await Binder.findByPk(id);
      if (!binder) throw new Error('Binder not found');
      if (binder.userId !== payload.id) throw new Error('No permission');
      if (name !== undefined) binder.name = name;
      if (description !== undefined) binder.description = description;
      await binder.save();
      return binder;
    },
    deleteBinder: async (parent, { id }, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      const binder = await Binder.findByPk(id);
      if (!binder) throw new Error('Binder not found');
      if (binder.userId !== payload.id) throw new Error('No permission');
      await binder.destroy();
      return true;
    }
  },
  Binder: {
    // Returns all card entries (Collection) in this binder
    cards: async (binder) =>
      await Collection.findAll({ where: { binderId: binder.id } }),
  }
};
