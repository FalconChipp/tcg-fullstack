import { Reward, Achievement } from '../../models/index.js';
import { requireAuth, requireAdmin } from '../collection/helpers.js';

const resolvers = {
  Query: {
    myRewards: async (_, __, { token }) => {
      const payload = requireAuth(token);
      return Reward.findAll({ where: { userId: payload.id }, order: [['createdAt', 'DESC']] });
    },
    userRewards: async (_, { userId }) => {
      return Reward.findAll({ where: { userId }, order: [['createdAt', 'DESC']] });
    },
  },
  Mutation: {
    grantReward: async (_, { userId, type, achievementId, data }, { token }) => {
      requireAdmin(token);
      const reward = await Reward.create({ userId, type, achievementId: achievementId || null, data });
      return reward;
    },
  },
  Reward: {
    achievement: async (reward) => {
      if (!reward.achievementId) return null;
      return Achievement.findByPk(reward.achievementId);
    },
  },
};

export default resolvers;
