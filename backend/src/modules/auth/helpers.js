import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
// import { AuditLog } from '../../models/index.js'; // If you implement DB audit log

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET not set');
}

export function generateJwt(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      isAdmin: user.isAdmin,
    },
    JWT_SECRET,
    { expiresIn: '14d' }
  );
}

export function verifyJwt(token) {
  return jwt.verify(token, JWT_SECRET);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function generateTwoFactorSecret(user) {
  const secret = speakeasy.generateSecret({
    name: `SixByFive TCG (${user.username})`,
    length: 32,
  });
  const qrCodeDataURL = await qrcode.toDataURL(secret.otpauth_url);
  return { ...secret, qrCodeDataURL };
}

export function verifyTwoFactorToken(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: 'ascii',
    token,
    window: 2,
  });
}

export function randomToken() {
  return uuidv4() + uuidv4();
}

/**
 * Records an audit log action (stub - add DB logic later)
 * @param {Object} params - Action details
 */
export async function recordAuditLog({ userId, action, ip, userAgent, details }) {
  // Replace with real DB logging if desired
  // For now: just print (only in dev)
  if (process.env.NODE_ENV !== 'production') {
    console.log('[AUDIT]', { userId, action, ip, userAgent, details });
  }
}
