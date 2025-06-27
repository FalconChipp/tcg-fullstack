import { verifyJwt } from '../auth/helpers.js';

export function requireAuth(token) {
  if (!token) throw new Error('Not authenticated');
  const payload = verifyJwt(token);
  if (!payload?.id) throw new Error('Not authenticated');
  return payload;
}
