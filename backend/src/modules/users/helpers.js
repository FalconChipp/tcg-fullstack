// src/modules/auth/helpers.js

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// ----- JWT HELPERS -----

// Verifies a JWT and returns the payload if valid
export function verifyJwt(token) {
  if (!token) throw new Error('Missing token');
  try {
    // Use your actual JWT secret from env
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new Error('Invalid or expired token');
  }
}

// Signs a new JWT with user data (use in login/register)
export function generateJwt(user) {
  // Include only what you want in the JWT payload!
  const payload = {
    id: user.id,
    isAdmin: user.isAdmin || false,
    username: user.username,
    email: user.email,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// ----- PASSWORD HELPERS -----

// Hash a plain password (registration/change)
export async function hashPassword(password) {
  if (!password) throw new Error('No password provided');
  return await bcrypt.hash(password, 12);
}

// Compare a plain password to a hash (for login, etc.)
export async function comparePassword(plain, hash) {
  if (!plain || !hash) return false;
  return await bcrypt.compare(plain, hash);
}

// ----- ADMIN HELPER -----

// Throws if not admin. Returns payload if OK.
export function requireAdmin(token) {
  if (!token) throw new Error('Not authenticated');
  const payload = verifyJwt(token);
  if (!payload?.isAdmin) throw new Error('Forbidden');
  return payload;
}

// ----- OPTIONAL: Require any logged-in user -----
export function requireUser(token) {
  if (!token) throw new Error('Not authenticated');
  const payload = verifyJwt(token);
  if (!payload?.id) throw new Error('Invalid user');
  return payload;
}
