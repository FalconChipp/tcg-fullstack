// src/modules/collections/helpers.js

import { verifyJwt as verifyJwtHelper } from '../auth/helpers.js';

export function requireAuth(token) {
  if (!token) throw new Error('Not authenticated');
  const payload = verifyJwtHelper(token);
  if (!payload?.id) throw new Error('Not authenticated');
  return payload;
}
