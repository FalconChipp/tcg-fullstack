import { Reward, Achievement } from '../../models/index.js';
import { requireAuth } from '../collection/helpers.js';
import { requireAdmin } from '../users/helpers.js';
import { recordAuditLog } from '../audit/helpers.js';

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
    grantReward: async (_, { userId, type, achievementId, data }, { token, ip, userAgent }) => {
      const admin = requireAdmin(token);
      const reward = await Reward.create({ userId, type, achievementId: achievementId || null, data });
      await recordAuditLog({
        userId: admin.id,
        action: 'GRANT_REWARD',
        targetId: userId,
        targetType: 'User',
        details: { type, achievementId },
        ip,
        userAgent,
      });
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
