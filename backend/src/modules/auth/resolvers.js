// src/modules/auth/resolvers.js

import { Op } from 'sequelize';
import { User } from '../../models/index.js';
import { OAuth2Client } from 'google-auth-library';
import {
  generateJwt,
  verifyJwt,
  hashPassword,
  comparePassword,
  generateMfaSecret,
  verifyMfaToken,
  randomToken
} from './helpers.js';

// --- Email templates & sending utility ---
import { sendMail } from '../../utils/email.js';
import buildVerificationEmail from '../../emails/buildVerificationEmail.js';
import buildResetEmail from '../../emails/buildResetEmail.js';
import buildWelcomeEmail from '../../emails/buildWelcomeEmail.js';
import buildMfaEmail from '../../emails/buildMfaEmail.js';
import { grantReward } from '../rewards/helpers.js';

const oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


const resolvers = {
  Query: {
    me: async (_, __, { token, logger }) => {
      try {
        if (!token) return null;
        const payload = verifyJwt(token);
        const user = await User.findByPk(payload.id);
        logger.info(`User [${payload.id}] fetched self`);
        return user;
      } catch (err) {
        logger.warn('JWT verification failed for me query');
        return null;
      }
    },
  },
  Mutation: {
    register: async (_, { username, email, password, referrerId }, { logger }) => {
      logger.info(`[REGISTER] username=${username} email=${email}`);
      const existing = await User.findOne({ where: { email } });
      if (existing) throw new Error('Email already registered');
      if (referrerId) {
        const refUser = await User.findByPk(referrerId);
        if (!refUser) throw new Error('Invalid referrer');
      }
      const user = await User.create({
        username,
        email,
        password: await hashPassword(password),
        isAdmin: false,
        isBanned: false,
        referrerId: referrerId || null,
      });
      // Email verification token
      user.verifyToken = randomToken();
      user.verifyTokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
      await user.save();

      // --- Send verification email (HTML) ---
      const { subject, html } = buildVerificationEmail({
        username: user.username,
        token: user.verifyToken,
      });
      await sendMail({ to: email, subject, html });

      logger.info(`[REGISTER] Sent verification email to ${email}`);

      // --- Send welcome email separately after verification, or here if you prefer ---
      const { subject: welcomeSubject, html: welcomeHtml } = buildWelcomeEmail({ username });
      await sendMail({ to: email, subject: welcomeSubject, html: welcomeHtml });

      await grantReward({ userId: user.id, type: 'signup' });
      if (referrerId) {
        await grantReward({ userId: referrerId, type: 'referral', data: { referredUserId: user.id } });
      }

      return {
        token: generateJwt(user),
        user,
      };
    },

    login: async (_, { email, username, password, mfaToken }, { logger }) => {
      const identifier = email || username;
      logger.info(`[LOGIN] identifier=${identifier}`);
      const where = email ? { email } : { username };
      const user = await User.findOne({ where });
      if (!user) throw new Error('No account found');
      if (user.isBanned) throw new Error('User banned');
      if (!user.password) throw new Error('Set a password via password reset or Google login');
      const valid = await comparePassword(password, user.password);
      if (!valid) throw new Error('Invalid password');
      if (user.mfaEnabled) {
        if (!mfaToken) throw new Error('MFA token required');
        if (!verifyMfaToken(user.mfaSecret, mfaToken)) throw new Error('Invalid MFA code');
      }
      logger.info(`[LOGIN] User ${user.id} logged in`);
      user.lastLogin = new Date();
      await user.save();
      return {
        token: generateJwt(user),
        user,
      };
    },

    loginGoogle: async (_, { googleToken }, { logger }) => {
      logger.info(`[LOGIN_GOOGLE] Received Google token`);
      try {
        const ticket = await oauthClient.verifyIdToken({
          idToken: googleToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const googleId = payload.sub;
        let user = await User.findOne({ where: { googleId } });
        if (!user) {
          user = await User.create({
            googleId,
            email: payload.email,
            username: payload.email.split('@')[0],
            emailVerified: payload.email_verified,
            isAdmin: false,
          });
        }
        user.lastLogin = new Date();
        await user.save();
        return { token: generateJwt(user), user };
      } catch (err) {
        logger.error(`[LOGIN_GOOGLE] ${err.message}`);
        throw new Error('Google login failed');
      }
    },

    // ---- MFA Setup ----
    enableMFA: async (_, __, { token, logger }) => {
      const payload = verifyJwt(token);
      const user = await User.findByPk(payload.id);
      const { ascii, otpauth_url, qrCodeDataURL } = await generateMfaSecret(user);
      user.mfaSecret = ascii;
      user.mfaEnabled = false; // Only enable after verify
      await user.save();
      logger.info(`[MFA] Generated secret for user ${user.id}`);
      // If you want to email MFA secret/QR, use a dedicated builder and sendMail here.
      return { otpauthUrl: otpauth_url, qrCodeDataURL };
    },

    verifyMFA: async (_, { code }, { token, logger }) => {
      const payload = verifyJwt(token);
      const user = await User.findByPk(payload.id);
      if (!user.mfaSecret) throw new Error('No MFA secret setup');
      if (!verifyMfaToken(user.mfaSecret, code)) throw new Error('Invalid MFA code');
      user.mfaEnabled = true;
      await user.save();

      // Optionally, send a confirmation email about enabling MFA (if desired)
      logger.info(`[MFA] Enabled for user ${user.id}`);
      return true;
    },

    disableMFA: async (_, __, { token, logger }) => {
      const payload = verifyJwt(token);
      const user = await User.findByPk(payload.id);
      user.mfaEnabled = false;
      user.mfaSecret = null;
      await user.save();
      logger.info(`[MFA] Disabled for user ${user.id}`);
      return true;
    },

    // ---- Password Reset ----
    requestPasswordReset: async (_, { email }, { logger }) => {
      const user = await User.findOne({ where: { email } });
      if (!user) return true; // Don't leak user existence
      user.resetToken = randomToken();
      user.resetTokenExpiry = Date.now() + 60 * 60 * 1000;
      await user.save();

      // --- Send password reset email (HTML) ---
      const { subject, html } = buildResetEmail({
        username: user.username,
        token: user.resetToken,
      });
      await sendMail({ to: user.email, subject, html });

      logger.info(`[RESET] Sent reset to ${email}`);
      return true;
    },

    resetPassword: async (_, { token, newPassword }, { logger }) => {
      const user = await User.findOne({
        where: {
          resetToken: token,
          resetTokenExpiry: { [Op.gt]: Date.now() },
        },
      });
      if (!user) throw new Error('Invalid or expired reset token');
      user.password = await hashPassword(newPassword);
      user.resetToken = null;
      user.resetTokenExpiry = null;
      await user.save();
      logger.info(`[RESET] Password reset for user ${user.id}`);
      return true;
    },

    // ---- Email Verification ----
    verifyEmail: async (_, { token }, { logger }) => {
      const user = await User.findOne({
        where: {
          verifyToken: token,
          verifyTokenExpiry: { [Op.gt]: Date.now() },
        },
      });
      if (!user) throw new Error('Invalid or expired verification token');
      user.verifyToken = null;
      user.verifyTokenExpiry = null;
      user.emailVerified = true;
      await user.save();

      // --- Send welcome email (HTML) ---
      const { subject, html } = buildWelcomeEmail({
        username: user.username
      });
      await sendMail({ to: user.email, subject, html });

      logger.info(`[VERIFY] Email verified for user ${user.id}`);
      return true;
    },

    resendVerification: async (_, { email }, { logger }) => {
      const user = await User.findOne({ where: { email } });
      if (!user) throw new Error('No account found');
      if (user.emailVerified) throw new Error('Already verified');
      user.verifyToken = randomToken();
      user.verifyTokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
      await user.save();

      // --- Send verification email again (HTML) ---
      const { subject, html } = buildVerificationEmail({
        username: user.username,
        token: user.verifyToken,
      });
      await sendMail({ to: user.email, subject, html });

      logger.info(`[VERIFY] Resent verification email to ${email}`);
      return true;
    },
  },
};

export default resolvers;
