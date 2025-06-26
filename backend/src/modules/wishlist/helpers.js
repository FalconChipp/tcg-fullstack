import { verifyJwt } from '../auth/helpers.js';
import { requireAdmin as baseRequireAdmin } from '../users/helpers.js';

export function requireAuth(token) {
  if (!token) throw new Error('Not authenticated');
  const payload = verifyJwt(token);
  if (!payload?.id) throw new Error('Not authenticated');
  return payload;
}

export const requireAdmin = baseRequireAdmin;
