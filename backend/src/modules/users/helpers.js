// src/modules/users/helpers.js

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// ----- INTERNAL: TOKEN EXTRACTION -----

/**
 * Normalises whatever we were given into a raw JWT string.
 * Accepts:
 *   - A raw token: "eyJhbGc..."
 *   - A header-style token: "Bearer eyJhbGc..."
 *   - A context object (ctx) with:
 *       ctx.authToken
 *       ctx.token
 *       ctx.headers.authorization
 *       ctx.req.headers.authorization
 */
function extractToken(input) {
  // Nothing?
  if (!input) return null;

  // If it's already a string, treat it as our candidate
  if (typeof input === 'string') {
    return input.trim() || null;
  }

  // If it's an object, try to pull a token-ish value out
  if (typeof input === 'object') {
    const candidate =
      input.authToken ||
      input.token ||
      input.authorization ||
      input.Authorization ||
      input.headers?.authorization ||
      input.req?.headers?.authorization;

    if (typeof candidate === 'string') {
      return candidate.trim() || null;
    }
  }

  // Anything else (number, boolean, weird object) -> not usable
  return null;
}

// ----- JWT HELPERS -----

// Verifies a JWT and returns the payload if valid
export function verifyJwt(input) {
  const raw = extractToken(input);
  if (!raw) throw new Error('Missing token');

  // Support "Bearer <token>" as well as "<token>"
  const token = raw.startsWith('Bearer ')
    ? raw.slice(7).trim()
    : raw.trim();

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

/**
 * Throws if not admin. Returns JWT payload if OK.
 *
 * Can be called as:
 *   requireAdmin(tokenString)
 *   requireAdmin(ctx)              // ctx.authToken / ctx.headers.authorization
 */
export function requireAdmin(input) {
  const payload = verifyJwt(input);

  if (!payload?.isAdmin) {
    throw new Error('Forbidden');
  }

  return payload;
}

// ----- OPTIONAL: Require any logged-in user -----

/**
 * Throws if not logged in. Returns JWT payload if OK.
 *
 * Can be called as:
 *   requireUser(tokenString)
 *   requireUser(ctx)
 */
export function requireUser(input) {
  const payload = verifyJwt(input);

  if (!payload?.id) {
    throw new Error('Invalid user');
  }

  return payload;
}
