import { Op } from 'sequelize';
import { User, UserDiscordLink } from '../../models/index.js'; // <-- include link model
import { OAuth2Client } from 'google-auth-library';
import {
  generateJwt,
  verifyJwt,
  hashPassword,
  comparePassword,
  generateTwoFactorSecret,
  verifyTwoFactorToken,
  randomToken,
  recordAuditLog 
} from './helpers.js';

// --- Email templates & sending utility ---
import { sendMail } from '../../utils/email.js';
import buildVerificationEmail from '../../emails/buildVerificationEmail.js';
import buildResetEmail from '../../emails/buildResetEmail.js';
import buildWelcomeEmail from '../../emails/buildWelcomeEmail.js';
import { grantReward } from '../rewards/helpers.js';

const oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// --- BRUTE FORCE: Simple in-memory attempt maps (swap for Redis in prod) --- //
const LOGIN_ATTEMPTS = new Map();
const TWOFA_ATTEMPTS = new Map();
function limitAttempts(key, map, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  let entry = map.get(key);
  if (!entry || (now - entry.lastAttempt > windowMs)) {
    entry = { count: 1, lastAttempt: now };
  } else {
    entry.count += 1;
    entry.lastAttempt = now;
  }
  map.set(key, entry);
  if (entry.count > maxAttempts) return false;
  return true;
}
function resetAttempts(key, map) {
  map.delete(key);
}

const resolvers = {
  // --- Per-field resolvers for User ---
  User: {
    twoFactorEnabled: (user) => !!user.twoFactorEnabled,

    // NEW: resolve Discord fields from UserDiscordLink table
    discordId: async (user) => {
      if (!user?.id) return null;
      const link = await UserDiscordLink.findOne({ where: { userId: String(user.id) } });
      return link?.discordUserId || null;
    },
    discordUsername: async (user) => {
      if (!user?.id) return null;
      const link = await UserDiscordLink.findOne({ where: { userId: String(user.id) } });
      return link?.discordUsername || null;
    },
  },

  Query: {
    me: async (_, __, { token, logger }) => {
      try {
        if (!token) return null;
        const payload = verifyJwt(token);
        const user = await User.findByPk(payload.id);
        logger.info(`User [${payload.id}] fetched self`);
        return user; // discord* are resolved by field resolvers above
      } catch (err) {
        logger.warn('JWT verification failed for me query');
        return null;
      }
    },
  },

  Mutation: {
    register: async (_, { username, email, password, referrerId }, { logger, ip, userAgent }) => {
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

      // --- Send welcome email ---
      const { subject: welcomeSubject, html: welcomeHtml } = buildWelcomeEmail({ username });
      await sendMail({ to: email, subject: welcomeSubject, html: welcomeHtml });

      await grantReward({ userId: user.id, type: 'signup' });
      if (referrerId) {
        await grantReward({ userId: referrerId, type: 'referral', data: { referredUserId: user.id } });
      }

      // --- Audit Log ---
      if (recordAuditLog) await recordAuditLog({
        userId: user.id,
        action: 'register',
        ip, userAgent,
        details: { email, username }
      });

      return {
        token: generateJwt(user),
        user,
      };
    },

    // ---- LOGIN (with brute-force & 2FA protection) ----
    login: async (_, { email, username, password, twoFactorToken }, { logger, ip, userAgent }) => {
      const identifier = email || username || ip;
      logger.info(`[LOGIN] identifier=${identifier}`);

      // --- BRUTE FORCE: Per-identifier limit
      if (!limitAttempts(identifier, LOGIN_ATTEMPTS, 7, 15 * 60 * 1000)) {
        if (recordAuditLog) await recordAuditLog({ userId: null, action: 'login_throttled', ip, userAgent, details: { identifier } });
        throw new Error('Too many login attempts. Please wait and try again.');
      }

      const where = email ? { email } : { username };
      const user = await User.findOne({ where });
      if (!user) {
        if (recordAuditLog) await recordAuditLog({ userId: null, action: 'login_fail', ip, userAgent, details: { identifier, reason: 'No account' } });
        throw new Error('No account found');
      }
      if (user.isBanned) {
        if (recordAuditLog) await recordAuditLog({ userId: user.id, action: 'login_fail', ip, userAgent, details: { reason: 'banned' } });
        throw new Error('User banned');
      }
      if (!user.password) {
        if (recordAuditLog) await recordAuditLog({ userId: user.id, action: 'login_fail', ip, userAgent, details: { reason: 'no password' } });
        throw new Error('Set a password via password reset or Google login');
      }
      const valid = await comparePassword(password, user.password);
      if (!valid) {
        if (recordAuditLog) await recordAuditLog({ userId: user.id, action: 'login_fail', ip, userAgent, details: { reason: 'bad password' } });
        throw new Error('Invalid password');
      }
      // --- 2FA check if enabled ---
      if (user.twoFactorEnabled) {
        if (!twoFactorToken) {
          if (recordAuditLog) await recordAuditLog({ userId: user.id, action: 'login_fail_2fa_required', ip, userAgent });
          throw new Error('2FA code required');
        }
        // --- BRUTE FORCE: Per-user limit for 2FA code
        if (!limitAttempts(user.id + '-2fa', TWOFA_ATTEMPTS, 5, 15 * 60 * 1000)) {
          if (recordAuditLog) await recordAuditLog({ userId: user.id, action: '2fa_throttled', ip, userAgent });
          throw new Error('Too many 2FA attempts. Please wait and try again.');
        }
        if (!verifyTwoFactorToken(user.twoFactorSecret, twoFactorToken)) {
          if (recordAuditLog) await recordAuditLog({ userId: user.id, action: '2fa_fail', ip, userAgent, details: { code: twoFactorToken } });
          throw new Error('Invalid 2FA code');
        }
        resetAttempts(user.id + '-2fa', TWOFA_ATTEMPTS); // Success: clear 2FA attempts
      }
      resetAttempts(identifier, LOGIN_ATTEMPTS); // Success: clear login attempts

      logger.info(`[LOGIN] User ${user.id} logged in`);
      user.lastLogin = new Date();
      await user.save();
      if (recordAuditLog) await recordAuditLog({ userId: user.id, action: 'login_success', ip, userAgent });
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
        // --- Optional: Audit logging for Google login can be added here ---
        return { token: generateJwt(user), user };
      } catch (err) {
        logger.error(`[LOGIN_GOOGLE] ${err.message}`);
        throw new Error('Google login failed');
      }
    },

    // ---- 2FA (Two Factor Auth) Setup ----
    enableTwoFactor: async (_, __, { token, logger, ip, userAgent }) => {
      const payload = verifyJwt(token);
      const user = await User.findByPk(payload.id);
      const { ascii, otpauth_url, qrCodeDataURL } = await generateTwoFactorSecret(user);
      user.twoFactorSecret = ascii;
      user.twoFactorEnabled = false; // Only enable after verify
      await user.save();
      logger.info(`[2FA] Generated secret for user ${user.id}`);
      if (recordAuditLog) await recordAuditLog({ userId: user.id, action: '2fa_generate_secret', ip, userAgent });
      return { otpauthUrl: otpauth_url, qrCodeDataURL };
    },

    verifyTwoFactor: async (_, { code }, { token, logger, ip, userAgent }) => {
      const payload = verifyJwt(token);
      const user = await User.findByPk(payload.id);
      if (!user.twoFactorSecret) throw new Error('No 2FA secret setup');
      if (!limitAttempts(user.id + '-2fa-verify', TWOFA_ATTEMPTS, 5, 15 * 60 * 1000)) {
        if (recordAuditLog) await recordAuditLog({ userId: user.id, action: '2fa_verify_throttled', ip, userAgent });
        throw new Error('Too many attempts to enable 2FA. Please wait.');
      }
      if (!verifyTwoFactorToken(user.twoFactorSecret, code)) {
        if (recordAuditLog) await recordAuditLog({ userId: user.id, action: '2fa_verify_fail', ip, userAgent });
        throw new Error('Invalid 2FA code');
      }
      user.twoFactorEnabled = true;
      await user.save();
      resetAttempts(user.id + '-2fa-verify', TWOFA_ATTEMPTS);
      if (recordAuditLog) await recordAuditLog({ userId: user.id, action: '2fa_verify_success', ip, userAgent });
      logger.info(`[2FA] Enabled for user ${user.id}`);
      return true;
    },

    disableTwoFactor: async (_, __, { token, logger, ip, userAgent }) => {
      const payload = verifyJwt(token);
      const user = await User.findByPk(payload.id);
      user.twoFactorEnabled = false;
      user.twoFactorSecret = null;
      await user.save();
      if (recordAuditLog) await recordAuditLog({ userId: user.id, action: '2fa_disable', ip, userAgent });
      logger.info(`[2FA] Disabled for user ${user.id}`);
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

    // Change Password
    changePassword: async (_, { currentPassword, newPassword }, { user, logger, ip, userAgent }) => {
      if (!user) throw new Error('Authentication required');
      const dbUser = await User.findByPk(user.id);
      if (!dbUser) throw new Error('User not found');
      const valid = await comparePassword(currentPassword, dbUser.password);
      if (!valid) throw new Error('Current password is incorrect');
      dbUser.password = await hashPassword(newPassword);
      await dbUser.save();
      if (recordAuditLog) await recordAuditLog({
        userId: dbUser.id,
        action: 'change_password',
        ip, userAgent,
        details: { userId: dbUser.id }
      });
      logger.info(`[CHANGE_PASSWORD] User ${dbUser.id} changed password`);
      return true;
    },

    // Change Email (and send verification)
    changeEmail: async (_, { newEmail, currentPassword }, { user, logger, ip, userAgent }) => {
      if (!user) throw new Error('Authentication required');
      const dbUser = await User.findByPk(user.id);
      if (!dbUser) throw new Error('User not found');

      if (await User.findOne({ where: { email: newEmail } })) {
        throw new Error('Email is already in use.');
      }
      const valid = await comparePassword(currentPassword, dbUser.password);
      if (!valid) throw new Error('Current password is incorrect');

      dbUser.email = newEmail;
      dbUser.emailVerified = false;
      dbUser.verifyToken = randomToken();
      dbUser.verifyTokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
      await dbUser.save();

      // Send new verification email to the updated email address
      const { subject, html } = buildVerificationEmail({
        username: dbUser.username,
        token: dbUser.verifyToken,
      });
      await sendMail({ to: newEmail, subject, html });

      if (recordAuditLog) await recordAuditLog({
        userId: dbUser.id,
        action: 'change_email',
        ip, userAgent,
        details: { userId: dbUser.id, newEmail }
      });
      logger.info(`[CHANGE_EMAIL] User ${dbUser.id} changed email to ${newEmail}`);
      return true;
    },
  },
};

export default resolvers;
