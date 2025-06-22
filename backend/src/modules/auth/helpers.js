// src/modules/auth/helpers.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User, Admin } = require('../../models');

// Generate a cryptographically secure random token (for email/2FA/etc)
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// === Email Verification Tokens ===

// Save a verification token on a user (valid for e.g. 1 day)
async function setUserVerificationToken(userId, token) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');
  user.verificationToken = token;
  user.verificationTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
  await user.save();
}

// Check and clear verification token
async function verifyEmailToken(token) {
  const user = await User.findOne({ where: { verificationToken: token } });
  if (!user || !user.verificationTokenExpires || user.verificationTokenExpires < new Date()) return null;
  user.verificationToken = null;
  user.verificationTokenExpires = null;
  await user.save();
  return user;
}

// === Password Reset Tokens ===
async function setPasswordResetToken(userId, token) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');
  user.passwordResetToken = token;
  user.passwordResetExpires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
  await user.save();
}

async function verifyPasswordResetToken(token) {
  const user = await User.findOne({ where: { passwordResetToken: token } });
  if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) return null;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save();
  return user;
}

function verifyJwt(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

// === JWT Validation for context ===
function getUserFromToken(token) {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
    return decoded;
  } catch (e) {
    return null;
  }
}

function getAdminFromToken(token) {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
    return decoded.adminId ? decoded : null;
  } catch (e) {
    return null;
  }
}

module.exports = {
  generateVerificationToken,
  setUserVerificationToken,
  verifyEmailToken,
  setPasswordResetToken,
  verifyPasswordResetToken,
  verifyJwt,
  getUserFromToken,
  getAdminFromToken
};
