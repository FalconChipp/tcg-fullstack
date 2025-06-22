// src/modules/auth/resolvers.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { User, UserSession, UserActivityLog } = require('../../models');
const helpers = require('./helpers');
const mailer = require('../../email/mailer');
const { v4: uuidv4 } = require('uuid');

// JSON scalar (if using Apollo Server v3, use GraphQLJSON, v4+ use built-in)
const { GraphQLScalarType } = require('graphql');

// ===== Helper Functions =====
function createToken(user, jti, expiresIn = '30d') {
  return jwt.sign(
    {
      id: user.id,
      jti, // Unique JWT ID for session/device management
      mfa: user.mfaEnabled,
      isAdmin: user.isAdmin
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );
}

async function createSession(user, deviceInfo, ipAddress) {
  const jwtId = uuidv4();
  const session = await UserSession.create({
    userId: user.id,
    jwtId,
    deviceInfo,
    ipAddress,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) // 30 days
  });
  return jwtId;
}

async function logActivity(userId, type, details, ip) {
  await UserActivityLog.create({
    userId,
    type,
    details,
    ip,
    createdAt: new Date()
  });
}

// Define the scalar:
const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value',
  parseValue: value => value,
  serialize: value => value,
  parseLiteral(ast) { return ast.value; }
});

// ===== Resolvers =====
module.exports = {
  JSON: JSONScalar,
  Query: {
    me: async (parent, args, context) => {
      if (!context.user) return null;
      return await User.findByPk(context.user.id);
    },
    activeSessions: async (parent, args, context) => {
      if (!context.user) throw new Error('Not authenticated');
      return await UserSession.findAll({
        where: { userId: context.user.id },
        order: [['createdAt', 'DESC']]
      });
    },
    myActivityLog: async (parent, { limit }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      return await UserActivityLog.findAll({
        where: { userId: context.user.id },
        order: [['createdAt', 'DESC']],
        limit: limit || 20
      });
    },
    allActivityLogs: async (parent, { userId, type, limit, since }, context) => {
      if (!context.admin) throw new Error('Admin only');
      const where = {};
      if (userId) where.userId = userId;
      if (type) where.type = type;
      if (since) where.createdAt = { [Op.gte]: new Date(since) };
      return await UserActivityLog.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: limit || 50
      });
    }
  },
  Mutation: {
    // === Register ===
    register: async (parent, { email, username, password }, context) => {
      if (await User.findOne({ where: { email } })) throw new Error('Email already in use');
      if (await User.findOne({ where: { username } })) throw new Error('Username already in use');
      const hash = await bcrypt.hash(password, 12);
      const user = await User.create({
        email, username, password: hash, isVerified: false
      });
      // Send verification email
      const token = helpers.generateVerificationToken();
      await helpers.setUserVerificationToken(user.id, token);
      await mailer.sendMail({
        to: email,
        ...mailer.verificationEmail(user, token)
      });
      logActivity(user.id, 'register', { email, username });
      return {
        token: createToken(user, await createSession(user, context.deviceInfo, context.ip)),
        user
      };
    },
    // === Login ===
    login: async (parent, { login, password, twoFACode }, context) => {
      const loginValue = login.trim()
      const user = await User.findOne({
        where: {
            [Op.or]: [
                { email: loginValue.toLowerCase() }, 
                { username: loginValue }
            ]
        }
      })
      if (!user || !user.password) throw new Error('Invalid credentials');
      // Email verification
      if (!user.isVerified) throw new Error('Email not verified');
      // Email change pending block
      if (user.pendingEmail) throw new Error('Email change pending. Verify your new email.');
      // Password check
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        await logActivity(user.id, 'login_failed', { reason: 'wrong password' }, context.ip);
        throw new Error('Invalid credentials');
      }
      // If 2FA enabled, check code
      if (user.mfaEnabled) {
        if (!twoFACode) {
          // If no code, tell frontend to prompt
          return { token: null, user, requires2FA: true };
        }
        const verified = speakeasy.totp.verify({
          secret: user.mfaSecret,
          encoding: 'base32',
          token: twoFACode
        });
        if (!verified) {
          await logActivity(user.id, 'login_failed', { reason: 'bad 2fa' }, context.ip);
          throw new Error('Invalid 2FA code');
        }
      }
      // Set lastLoginAt and create session
      user.lastLoginAt = new Date();
      await user.save();
      await logActivity(user.id, 'login', {}, context.ip);
      const jwtId = await createSession(user, context.deviceInfo, context.ip);
      return { token: createToken(user, jwtId), user };
    },
    // === Verify Email ===
    verifyEmail: async (parent, { token }, context) => {
      const user = await helpers.verifyEmailToken(token);
      if (!user) throw new Error('Invalid or expired token');
      user.isVerified = true;
      await user.save();
      await logActivity(user.id, 'verify_email', {}, null);
      return true;
    },
    // === Request Password Reset ===
    requestPasswordReset: async (parent, { email }) => {
      const user = await User.findOne({ where: { email } });
      if (!user) return true; // Never reveal if email exists
      const token = helpers.generateVerificationToken();
      await helpers.setPasswordResetToken(user.id, token);
      await mailer.sendMail({
        to: email,
        ...mailer.passwordResetEmail(user, token)
      });
      await logActivity(user.id, 'request_password_reset', {}, null);
      return true;
    },
    // === Reset Password ===
    resetPassword: async (parent, { token, newPassword }) => {
      const user = await helpers.verifyPasswordResetToken(token);
      if (!user) throw new Error('Invalid or expired token');
      user.password = await bcrypt.hash(newPassword, 12);
      await user.save();
      await logActivity(user.id, 'reset_password', {}, null);
      return true;
    },
    // === Email Change Flow ===
    requestEmailChange: async (parent, { newEmail }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      const user = await User.findByPk(context.user.id);
      if (await User.findOne({ where: { email: newEmail } })) throw new Error('Email already in use');
      const token = helpers.generateVerificationToken();
      user.pendingEmail = newEmail;
      user.pendingEmailToken = token;
      await user.save();
      await mailer.sendMail({
        to: newEmail,
        ...mailer.verificationEmailChange(user, token)
      });
      await logActivity(user.id, 'request_email_change', { to: newEmail }, null);
      return true;
    },
    verifyEmailChange: async (parent, { token }, context) => {
      const user = await User.findOne({ where: { pendingEmailToken: token } });
      if (!user || !user.pendingEmail) throw new Error('Invalid token');
      const oldEmail = user.email;
      user.email = user.pendingEmail;
      user.pendingEmail = null;
      user.pendingEmailToken = null;
      await user.save();
      await logActivity(user.id, 'email_changed', { from: oldEmail, to: user.email }, null);
      return true;
    },
    // === 2FA ===
    enable2FA: async (parent, args, context) => {
      if (!context.user) throw new Error('Not authenticated');
      const user = await User.findByPk(context.user.id);
      if (user.mfaEnabled) throw new Error('2FA already enabled');
      const secret = speakeasy.generateSecret();
      user.mfaSecret = secret.base32;
      await user.save();
      const qrData = await qrcode.toDataURL(secret.otpauth_url);
      await logActivity(user.id, 'enable_2fa', {}, null);
      return qrData;
    },
    verify2FA: async (parent, { code }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      const user = await User.findByPk(context.user.id);
      if (!user.mfaSecret) throw new Error('No 2FA setup');
      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: code
      });
      if (!verified) throw new Error('Invalid 2FA code');
      user.mfaEnabled = true;
      await user.save();
      await logActivity(user.id, 'verify_2fa', {}, null);
      return true;
    },
    disable2FA: async (parent, args, context) => {
      if (!context.user) throw new Error('Not authenticated');
      const user = await User.findByPk(context.user.id);
      user.mfaEnabled = false;
      user.mfaSecret = null;
      await user.save();
      await logActivity(user.id, 'disable_2fa', {}, null);
      return true;
    },
    // === Session Management ===
    logoutSession: async (parent, { sessionId }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      const session = await UserSession.findOne({ where: { id: sessionId, userId: context.user.id } });
      if (!session) throw new Error('Session not found');
      await session.destroy();
      await logActivity(context.user.id, 'logout_session', { sessionId }, null);
      return true;
    },
    logoutAllSessions: async (parent, args, context) => {
      if (!context.user) throw new Error('Not authenticated');
      await UserSession.destroy({ where: { userId: context.user.id } });
      await logActivity(context.user.id, 'logout_all_sessions', {}, null);
      return true;
    },
    // === Account Deletion / GDPR ===
    deleteMyAccount: async (parent, { password }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      const user = await User.findByPk(context.user.id);
      if (!user.password) throw new Error('Password login not enabled for your account');
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) throw new Error('Incorrect password');
      // Log before deleting
      await logActivity(user.id, 'account_deleted', {}, null);
      // Delete all sessions/logs
      await UserSession.destroy({ where: { userId: user.id } });
      await UserActivityLog.destroy({ where: { userId: user.id } });
      // TODO: Delete or anonymize related data (cards, binders, etc.)
      await user.destroy();
      return true;
    },
    requestDataExport: async (parent, args, context) => {
      if (!context.user) throw new Error('Not authenticated');
      const user = await User.findByPk(context.user.id);
      // Implement actual data export logic as needed!
      await mailer.sendMail({
        to: user.email,
        subject: 'Your SixByFive TCG Data Export',
        html: `<p>Your data export request has been received. We'll send you your data soon.</p>`
      });
      await logActivity(user.id, 'request_data_export', {}, null);
      return true;
    },
    // === Admin Tools ===
    adminDeleteUser: async (parent, { userId }, context) => {
      if (!context.admin) throw new Error('Admin only');
      const user = await User.findByPk(userId);
      if (!user) throw new Error('User not found');
      await user.destroy();
      return true;
    },
  }
};
