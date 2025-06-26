import { verifyJwt } from '../auth/helpers.js';

export function requireAdmin(token) {
  if (!token) throw new Error('Not authenticated');
  const payload = verifyJwt(token);
  if (!payload?.isAdmin) throw new Error('Forbidden');
  return payload;
}
