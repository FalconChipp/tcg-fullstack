// src/modules/auth/helpers.js

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../models/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

// Generate JWT for a user
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

// Hash password
export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// MFA TOTP Setup
export async function generateMfaSecret(user) {
  const secret = speakeasy.generateSecret({
    name: `SixByFive TCG (${user.username})`,
    length: 32,
  });
  const qrCodeDataURL = await qrcode.toDataURL(secret.otpauth_url);
  return { ...secret, qrCodeDataURL };
}

export function verifyMfaToken(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: 'ascii',
    token,
    window: 2,
  });
}

// Generate random token (for email verification, reset)
export function randomToken() {
  return uuidv4() + uuidv4();
}
