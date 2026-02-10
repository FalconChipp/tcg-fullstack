import { Achievement, UserAchievement } from '../../models/index.js';
import { verifyJwt } from '../auth/helpers.js';
import { requireAdmin } from '../users/helpers.js';
import { requireAuth } from '../collection/helpers.js';
import { maybeGrantAchievement } from './helpers.js';

const HIDDEN_LABEL = {
  name: 'Hidden Achievement',
  description: 'Unlock to reveal',
  iconUrl: '/achievements/hidden.png',
};

function maskAchievement(achievement, { unlocked = false, isAdmin = false } = {}) {
  if (achievement.isHidden && !unlocked && !isAdmin) {
    return {
      ...achievement.toJSON(),
      name: HIDDEN_LABEL.name,
      description: HIDDEN_LABEL.description,
      iconUrl: HIDDEN_LABEL.iconUrl,
    };
  }
  return achievement;
}

const resolvers = {
  Query: {
    achievements: async (_, { active }, { token }) => {
      const payload = token ? verifyJwt(token) : null;
      const where = {};
      if (active !== undefined) where.isActive = active;
      const achievements = await Achievement.findAll({ where });
      let unlockedIds = new Set();
      if (payload) {
        const uas = await UserAchievement.findAll({ where: { userId: payload.id } });
        unlockedIds = new Set(uas.map((ua) => ua.achievementId));
      }
      return achievements.map((a) => maskAchievement(a, { unlocked: unlockedIds.has(a.id), isAdmin: payload?.isAdmin }));
    },
    myAchievements: async (_, __, { token }) => {
      const payload = requireAuth(token);
      return UserAchievement.findAll({
        where: { userId: payload.id },
        include: [{ model: Achievement }],
      });
    },
    userAchievements: async (_, { userId }) => {
      return UserAchievement.findAll({
        where: { userId },
        include: [{ model: Achievement }],
      });
    },
    achievement: async (_, { id, code }, { token }) => {
      const payload = token ? verifyJwt(token) : null;
      const where = {};
      if (id) where.id = id;
      if (code) where.code = code;
      const a = await Achievement.findOne({ where });
      if (!a) return null;
      let unlocked = false;
      if (payload) {
        const ua = await UserAchievement.findOne({ where: { userId: payload.id, achievementId: a.id } });
        unlocked = !!ua;
      }
      return maskAchievement(a, { unlocked, isAdmin: payload?.isAdmin });
    },
  },
  Mutation: {
    addAchievement: async (_, { input }, { token }) => {
      await requireAdmin(token);
      const achievement = await Achievement.create(input);
      return achievement;
    },
    editAchievement: async (_, { id, input }, { token }) => {
      await requireAdmin(token);
      const achievement = await Achievement.findByPk(id);
      if (!achievement) throw new Error('Not found');
      Object.assign(achievement, input);
      await achievement.save();
      return achievement;
    },
    deleteAchievement: async (_, { id }, { token }) => {
      await requireAdmin(token);
      const achievement = await Achievement.findByPk(id);
      if (!achievement) return false;
      achievement.isActive = false;
      await achievement.save();
      return true;
    },
    grantAchievement: async (_, { userId, achievementCode, meta }, { token }) => {
      await requireAdmin(token);
      return maybeGrantAchievement(userId, achievementCode, meta);
    },
    revokeAchievement: async (_, { userId, achievementCode }, { token }) => {
      await requireAdmin(token);
      const achievement = await Achievement.findOne({ where: { code: achievementCode } });
      if (!achievement) return false;
      const ua = await UserAchievement.findOne({ where: { userId, achievementId: achievement.id } });
      if (!ua) return false;
      await ua.destroy();
      return true;
    },
  },
  UserAchievement: {
    achievement: async (ua) => Achievement.findByPk(ua.achievementId),
  },
};

export default resolvers;
