// src/modules/userProfiles/resolvers.js
const { User } = require('../../models');
const helpers = require('../auth/helpers');
const { Op } = require('sequelize');

module.exports = {
  Query: {
    userProfile: async (parent, { id, username }) => {
      if (id) {
        return await User.findByPk(id);
      } else if (username) {
        return await User.findOne({ where: { username } });
      }
      throw new Error('Provide id or username');
    },
    searchUsers: async (parent, { query, limit }) => {
      // Only for finding public users, not login
      return await User.findAll({
        where: {
          [Op.or]: [
            { username: { [Op.like]: `%${query}%` } },
            { email: { [Op.like]: `%${query}%` } }
          ]
        },
        limit
      });
    }
  },
  Mutation: {
    updateProfile: async (parent, { username, avatarUrl }, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      const user = await User.findByPk(payload.id);
      if (!user) throw new Error('User not found');
      if (username !== undefined) user.username = username;
      if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
      await user.save();
      return user;
    }
  }
};
