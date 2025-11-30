// backend/src/modules/marketplace/utils/validationUtils.js

/**
 * validationUtils
 * -----------------------------------------------------------------------------
 * Centralized guards used across services/resolvers.
 * Keep these framework-agnostic (no direct Sequelize/Apollo imports).
 * -----------------------------------------------------------------------------
 */

export function requireAuth(ctx) {
  if (!ctx?.user?.id) {
    const err = new Error('Authentication required');
    err.code = 'UNAUTHENTICATED';
    throw err;
  }
  return ctx.user;
}

export function isAdminLike(user) {
  return user?.role === 'admin' || user?.role === 'staff' || user?.isAdmin === true;
}

export function assertAdmin(ctx) {
  const user = requireAuth(ctx);
  if (!isAdminLike(user)) {
    const err = new Error('Admin privileges required');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return user;
}

export function assertPositiveInt(value, fieldName = 'value') {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
}

export function assertNonNegativeInt(value, fieldName = 'value') {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
}

export function assertPositivePrice(value, fieldName = 'price') {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${fieldName} must be a positive number`);
}

export function assertEnum(value, allowed = [], name = 'value') {
  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(', ')}`);
  }
}

/**
 * Ensure the acting user owns the resource or is admin.
 * @param {{ userId: string }} resource
 * @param {{ id: string }} user
 */
export function assertOwnerOrAdmin(resource, user) {
  if (!resource) throw new Error('Resource not found');
  if (resource.userId !== user.id && !isAdminLike(user)) {
    const err = new Error('You are not allowed to modify this resource');
    err.code = 'FORBIDDEN';
    throw err;
  }
}

/**
 * Tiny pagination sanitizer used by queries.
 */
export function sanitizeLimitOffset({ limit = 25, offset = 0 } = {}) {
  const l = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
  const o = Math.max(parseInt(offset, 10) || 0, 0);
  return { limit: l, offset: o };
}
