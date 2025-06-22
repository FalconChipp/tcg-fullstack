// src/modules/achievements/resolvers.js
const { Achievement, UserAchievement, User } = require('../../models');
const helpers = require('../auth/helpers');

module.exports = {
  Query: {
    achievements: async () => await Achievement.findAll(),
    userAchievements: async (parent, { userId }, context) => {
      let user_id = userId;
      if (!user_id) {
        // fallback to JWT user
        if (!context.token) throw new Error('Not authenticated');
        const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
        user_id = payload.id;
      }
      return await UserAchievement.findAll({
        where: { userId: user_id },
        include: [{ model: Achievement }]
      });
    },
  },
  Mutation: {
    unlockAchievement: async (parent, { code }, context) => {
      // Require user to be authenticated
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      const user = await User.findByPk(payload.id);
      if (!user) throw new Error('User not found');
      // Find the achievement by code
      const achievement = await Achievement.findOne({ where: { code } });
      if (!achievement) throw new Error('Achievement not found');
      // Check if already unlocked
      let userAchievement = await UserAchievement.findOne({
        where: { userId: user.id, achievementId: achievement.id }
      });
      if (userAchievement) {
        throw new Error('Achievement already unlocked');
      }
      // Unlock
      userAchievement = await UserAchievement.create({
        userId: user.id,
        achievementId: achievement.id,
        earnedAt: new Date()
      });
      return {
        ...userAchievement.toJSON(),
        achievement
      };
    }
  },
  UserAchievement: {
    achievement: async (ua) => await Achievement.findByPk(ua.achievementId)
  }
};
