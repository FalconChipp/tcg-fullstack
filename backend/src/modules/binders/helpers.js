import { verifyJwt } from '../auth/helpers.js';
import { getUserTier } from '../../utils/getUserTier.js';

export function requireAuth(token) {
  if (!token) throw new Error('Not authenticated');
  const payload = verifyJwt(token);
  if (!payload?.id) throw new Error('Not authenticated');
  return payload;
}

export const requireAdmin = (token) => {
  const payload = requireAuth(token);
  if (!payload.isAdmin) throw new Error('Forbidden');
  return payload;
};

export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export async function checkBinderLimits(userId) {
  const tier = await getUserTier(userId);
  const limit = tier.limits.binders || 3;
  return { limit };
}
