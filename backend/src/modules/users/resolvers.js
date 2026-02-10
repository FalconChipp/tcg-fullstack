import { User, Profile, sequelize } from '../../models/index.js';
import { Op } from 'sequelize';
import winston from 'winston';
import { verifyJwt, comparePassword } from '../auth/helpers.js';
import { PROFILE_STATUSES } from '../../models/Profile.js';
import { requireAdmin } from './helpers.js';

// File system & archive utils (for data export)
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

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

// ADDED: helper to detect "mobile local" avatar paths that should never be stored
function isLocalDeviceAvatar(value) {
  if (!value || typeof value !== 'string') return false;
  return (
    value.startsWith('file://') ||
    value.startsWith('content://') ||
    value.includes('/cache/ImagePicker/')
  );
}

// --- Resolvers ---
const resolvers = {
  Query: {
    me: async (_parent, _args, { token }) => {
      if (!token) return null;

      try {
        const payload = verifyJwt(token);

        const user = await User.findByPk(payload.id, {
          include: [
            { model: Profile, required: false },
            { model: UserDiscordLink, as: "DiscordLink", required: false },
          ],
        });

        if (!user) return null;

        logger.info(`[USER] Fetched self ${payload.id}`);

        const j = user.toJSON();

        return {
          id: j.id,
          username: j.username,
          email: j.email,
          emailVerified: j.emailVerified,
          lastLogin: j.lastLogin,
          createdAt: j.createdAt,
          updatedAt: j.updatedAt,

          isAdmin: typeof j.isAdmin === "number" ? j.isAdmin === 1 : !!j.isAdmin,
          isBanned: typeof j.isBanned === "number" ? j.isBanned === 1 : !!j.isBanned,

          // NOTE: You return avatar here from either User.avatar or Profile.avatar.
          // If the "bad" value is stored in Profile.avatar, web will break.
          avatar: j.avatar ?? j.Profile?.avatar ?? null,

          mfaEnabled: j.twoFactorEnabled ?? j.mfaEnabled ?? false,

          oauthProvider: j.oauthProvider ?? null,
          oauthId: j.oauthId ?? null,

          discordId: j.DiscordLink?.discordUserId ?? null,
          discordUsername: j.DiscordLink?.discordUsername ?? null,

          Profile: j.Profile ?? null,
        };
      } catch (err) {
        logger.warn(`[USER] JWT verification failed for me query`);
        return null;
      }
    },

    userProfile: async (_parent, { username }) => {
      const user = await User.findOne({ where: { username } });
      if (!user) return null;

      let profile = await Profile.findOne({ where: { userId: user.id } });

      if (!profile) {
        profile = await Profile.create({ userId: user.id });
        logger.info(`[PROFILE] Created blank profile for user ${username}`);
      }

      profile.user = user;
      logger.info(`[PROFILE] Fetched profile for user ${username}`);
      return profile;
    },

    userById: async (_parent, { id }) => {
      const user = await User.findByPk(id, {
        include: [
          { model: Profile, required: false },
          { model: UserDiscordLink, as: "DiscordLink", required: false },
        ],
      });
      logger.info(`[USER] Fetched user by id ${id}`);
      return user;
    },

    searchUsers: async (_parent, { query, limit = 10 }) => {
      const users = await User.findAll({
        where: sequelize.where(
          sequelize.fn("LOWER", sequelize.col("username")),
          { [Op.like]: `%${query.toLowerCase()}%` }
        ),
        limit,
        include: [{ model: Profile, required: false }],
      });
      logger.info(`[PROFILE] Search users for "${query}" found ${users.length}`);
      return users.map((u) => u.Profile).filter(Boolean);
    },

    allUsers: async (_parent, { limit = 100 }, { token }) => {
      await requireAdmin(token);
      const users = await User.findAll({
        limit,
        include: [{ model: Profile, required: false }],
      });
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

      // REMOVED: avatar must NOT be set via this mutation
      // This is the bug that stores Expo ImagePicker cache paths into the DB.
      // Only allow avatar changes via POST /upload/avatar (multipart).
      const allowed = [
        'bio',
        'favouritePokemon',
        // 'avatar', // REMOVED
        'country',
        'showcase',
        'status',
        'address1',
        'address2',
        'city',
        'postcode',
        'state',
        'phone',
        'discord',
        'publicProfile',
        'wantsTrade',
        'wantsMarketplace',
      ];

      // ADDED: If a client still sends avatar, hard-block it so you notice immediately.
      if (args.avatar !== undefined) {
        // If it looks like a phone-local URI, it's definitely wrong.
        if (isLocalDeviceAvatar(args.avatar)) {
          throw new Error(
            'Invalid avatar value. Please upload avatar via /upload/avatar (multipart/form-data).'
          );
        }

        // Even if it doesn't look local, we still refuse here to keep one source of truth.
        throw new Error(
          'Avatar cannot be updated via updateProfile. Use /upload/avatar instead.'
        );
      }

      for (const field of allowed) {
        if (args[field] === undefined) continue;
        if (field === 'status' && !PROFILE_STATUSES.includes(args.status)) continue;
        profile[field] = args[field];
      }

      console.log('Updating profile with:', profile.toJSON());

      await profile.save();
      logger.info(`[PROFILE] User ${payload.id} updated profile`);
      return profile;
    },

    adminBanUser: async (_, { userId }, { token }) => {
      await requireAdmin(token);
      const user = await User.findByPk(userId);
      if (!user) throw new Error('Not found');
      user.isBanned = true;
      await user.save();
      logger.info(`[ADMIN] Banned user ${userId}`);
      return true;
    },

    adminUnbanUser: async (_, { userId }, { token }) => {
      await requireAdmin(token);
      const user = await User.findByPk(userId);
      if (!user) throw new Error('Not found');
      user.isBanned = false;
      await user.save();
      logger.info(`[ADMIN] Unbanned user ${userId}`);
      return true;
    },

    adminDeleteUser: async (_, { userId }, { token }) => {
      await requireAdmin(token);
      await User.destroy({ where: { id: userId } });
      logger.info(`[ADMIN] Deleted user ${userId}`);
      return true;
    },

    exportUserData: async (_, { password }, { token }) => {
      if (!token) throw new Error("Not authenticated");
      const payload = verifyJwt(token);
      const user = await User.findByPk(payload.id, { include: [{ model: Profile }] });
      if (!user) throw new Error("User not found");

      const isValid = await comparePassword(password, user.password);
      if (!isValid) throw new Error("Password incorrect.");

      const data = {
        user: user.toJSON(),
        profile: user.Profile ? user.Profile.toJSON() : null,
      };

      const exportDir = path.resolve(process.cwd(), "exports");
      if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
      const fileName = `user_${user.id}_${Date.now()}.json`;
      const filePath = path.join(exportDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

      logger.info(`[USER] Exported data for user ${user.id} to ${filePath}`);
      return `/exports/${fileName}`;
    },

    deleteAccount: async (_, { password, confirm }, { token }) => {
      if (!token) throw new Error("Not authenticated");
      const payload = verifyJwt(token);

      const user = await User.findByPk(payload.id);
      if (!user) throw new Error("User not found");

      const isValid = await comparePassword(password, user.password);
      if (!isValid) throw new Error("Password incorrect.");

      if (confirm !== "DELETE") {
        throw new Error("Confirmation failed. Type DELETE to confirm account deletion.");
      }

      await Profile.destroy({ where: { userId: payload.id } });
      await User.destroy({ where: { id: payload.id } });
      logger.info(`[USER] Deleted account ${payload.id}`);

      return true;
    },
  },

  User: {
    profile: async (user) => {
      return Profile.findOne({ where: { userId: user.id } });
    },
    referrer: async (user) => {
      if (!user.referrerId) return null;
      return User.findByPk(user.referrerId);
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
