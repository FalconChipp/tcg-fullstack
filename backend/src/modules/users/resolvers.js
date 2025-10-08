import { User, Profile, sequelize } from '../../models/index.js';
import { Op } from 'sequelize';
import winston from 'winston';
import { verifyJwt, comparePassword } from '../auth/helpers.js'; // <--- make sure comparePassword is imported!
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

      // Keep your auto-create behavior (optional)
      if (!profile) {
        profile = await Profile.create({ userId: user.id });
        logger.info(`[PROFILE] Created blank profile for user ${username}`);
      }

      // Attach for downstream resolvers if you rely on it
      profile.user = user;
      logger.info(`[PROFILE] Fetched profile for user ${username}`);
      return profile;
    },

    userById: async (_parent, { id }) => {
      const user = await User.findByPk(id, {
        // OPTIONAL: include these if you want parity with `me`
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
        // CHANGED: use object form for include (consistent with others)
        include: [{ model: Profile, required: false }],
      });
      logger.info(`[PROFILE] Search users for "${query}" found ${users.length}`);
      return users.map((u) => u.Profile).filter(Boolean);
    },

    allUsers: async (_parent, { limit = 100 }, { token }) => {
      requireAdmin(token);
      // CHANGED: consistent include form
      const users = await User.findAll({ limit, include: [{ model: Profile, required: false }] });
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

      const allowed = [
        'bio',
        'favouritePokemon',
        'avatar',
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
      requireAdmin(token);
      const user = await User.findByPk(userId);
      if (!user) throw new Error('Not found');
      user.isBanned = true;
      await user.save();
      logger.info(`[ADMIN] Banned user ${userId}`);
      return true;
    },

    adminUnbanUser: async (_, { userId }, { token }) => {
      requireAdmin(token);
      const user = await User.findByPk(userId);
      if (!user) throw new Error('Not found');
      user.isBanned = false;
      await user.save();
      logger.info(`[ADMIN] Unbanned user ${userId}`);
      return true;
    },

    adminDeleteUser: async (_, { userId }, { token }) => {
      requireAdmin(token);
      await User.destroy({ where: { id: userId } });
      logger.info(`[ADMIN] Deleted user ${userId}`);
      return true;
    },

    // --- PRIVACY: Export User Data (password required) ---
    exportUserData: async (_, { password }, { token }) => {
      if (!token) throw new Error("Not authenticated");
      const payload = verifyJwt(token);
      const user = await User.findByPk(payload.id, { include: [{ model: Profile }] });
      if (!user) throw new Error("User not found");

      // PASSWORD CHECK (required!)
      const isValid = await comparePassword(password, user.password);
      if (!isValid) throw new Error("Password incorrect.");

      // 1. Gather all user data (add any relations needed here)
      const data = {
        user: user.toJSON(),
        profile: user.Profile ? user.Profile.toJSON() : null,
        // Add more related models as needed
      };

      // 2. Write to a temporary file
      const exportDir = path.resolve(process.cwd(), "exports");
      if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
      const fileName = `user_${user.id}_${Date.now()}.json`;
      const filePath = path.join(exportDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

      // 3. Return download URL to the JSON file
      logger.info(`[USER] Exported data for user ${user.id} to ${filePath}`);
      return `/exports/${fileName}`;
    },

    // --- PRIVACY: Delete Account (password + confirmation required) ---
    deleteAccount: async (_, { password, confirm }, { token }) => {
      if (!token) throw new Error("Not authenticated");
      const payload = verifyJwt(token);

      const user = await User.findByPk(payload.id);
      if (!user) throw new Error("User not found");

      // PASSWORD CHECK (required!)
      const isValid = await comparePassword(password, user.password);
      if (!isValid) throw new Error("Password incorrect.");

      // Confirm step (require "DELETE")
      if (confirm !== "DELETE") {
        throw new Error("Confirmation failed. Type DELETE to confirm account deletion.");
      }

      // Delete Profile (if exists)
      await Profile.destroy({ where: { userId: payload.id } });
      // Delete User
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
