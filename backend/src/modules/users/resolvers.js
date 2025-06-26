import { User, Profile } from '../../models/index.js';
import { Op } from 'sequelize';
import winston from 'winston';
import { verifyJwt } from '../auth/helpers.js';
import { PROFILE_STATUSES } from '../../models/Profile.js';
import fetch from 'node-fetch';

// --- Logger ---
const logger = winston.createLogger({
  transports: [new winston.transports.Console()],
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) =>
      `[${timestamp}] [${level}] ${message}`
    )
  ),
});

// --- Resolvers ---
const resolvers = {
  Query: {
    me: async (_, __, { token }) => {
      if (!token) return null;
      try {
        const payload = verifyJwt(token);
        const profile = await Profile.findOne({ where: { userId: payload.id } });
        logger.info(`[PROFILE] User ${payload.id} fetched own profile`);
        return profile;
      } catch (err) {
        logger.warn(`[PROFILE] JWT verification failed for me query`);
        return null;
      }
    },

    userProfile: async (_, { username }) => {
      const user = await User.findOne({ where: { username } });
      if (!user) return null;
      const profile = await Profile.findOne({ where: { userId: user.id } });
      logger.info(`[PROFILE] Fetched profile for user ${username}`);
      return profile;
    },

    userById: async (_, { id }) => {
      const user = await User.findByPk(id);
      logger.info(`[USER] Fetched user by id ${id}`);
      return user;
    },

    searchUsers: async (_, { query, limit = 10 }) => {
      const users = await User.findAll({
        where: { username: { [Op.iLike]: `%${query}%` } },
        limit,
        include: [{ model: Profile }],
      });
      logger.info(`[PROFILE] Search users for "${query}" found ${users.length}`);
      return users.map(u => u.Profile).filter(Boolean);
    },

    allUsers: async (_, { limit = 100 }, { token }) => {
      const payload = verifyJwt(token);
      const user = await User.findByPk(payload.id);
      if (!user?.isAdmin) throw new Error('Forbidden');
      const users = await User.findAll({ limit, include: Profile });
      logger.info(`[ADMIN] allUsers queried`);
      return users;
    },

    profileStatuses: () => PROFILE_STATUSES,
  },

  Mutation: {
    updateProfile: async (_, args, { token }) => {
      if (!token) throw new Error('Not authenticated');
      const payload = verifyJwt(token);
      let profile = await Profile.findOne({ where: { userId: payload.id } });
      if (!profile) {
        profile = await Profile.create({ userId: payload.id });
      }

      // Update only supplied fields
      Object.entries(args).forEach(([key, value]) => {
        if (value !== undefined && key in profile) profile[key] = value;
      });
      if (args.status && PROFILE_STATUSES.includes(args.status)) {
        profile.status = args.status;
      }

      await profile.save();
      logger.info(`[PROFILE] User ${payload.id} updated profile`);
      return profile;
    },

    adminBanUser: async (_, { userId }, { token }) => {
      const payload = verifyJwt(token);
      const admin = await User.findByPk(payload.id);
      if (!admin?.isAdmin) throw new Error('Forbidden');
      const user = await User.findByPk(userId);
      if (!user) throw new Error('Not found');
      user.isBanned = true;
      await user.save();
      logger.info(`[ADMIN] Banned user ${userId}`);
      return true;
    },

    adminUnbanUser: async (_, { userId }, { token }) => {
      const payload = verifyJwt(token);
      const admin = await User.findByPk(payload.id);
      if (!admin?.isAdmin) throw new Error('Forbidden');
      const user = await User.findByPk(userId);
      if (!user) throw new Error('Not found');
      user.isBanned = false;
      await user.save();
      logger.info(`[ADMIN] Unbanned user ${userId}`);
      return true;
    },

    adminDeleteUser: async (_, { userId }, { token }) => {
      const payload = verifyJwt(token);
      const admin = await User.findByPk(payload.id);
      if (!admin?.isAdmin) throw new Error('Forbidden');
      await User.destroy({ where: { id: userId } });
      logger.info(`[ADMIN] Deleted user ${userId}`);
      return true;
    },
    uploadAvatar: async (_, { file }, { token }) => {
        throw new Error(
            'Avatar upload is only supported via the REST endpoint: POST /upload/avatar (multipart/form-data). ' +
            'GraphQL file uploads are not supported for avatars. Please use the REST endpoint.'
        );
    },
  },

  User: {
    profile: async (user) => {
      return Profile.findOne({ where: { userId: user.id } });
    }
  },
  Profile: {
    user: async (profile) => {
      return User.findByPk(profile.userId);
    },
    showcase: (profile) => profile.showcase || {},
  },
};

export default resolvers;
