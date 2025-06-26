import { verifyJwt } from '../auth/helpers.js';
import { ChatAgreement, User } from '../../models/index.js';
import { requireAdmin as baseRequireAdmin } from '../users/helpers.js';

export const CHAT_RULES = `Be respectful and do not engage in harassment. No spam or advertising. Use the platform responsibly.`;

export async function requireChatAgreement(token) {
  if (!token) throw new Error('Not authenticated');
  const payload = verifyJwt(token);
  const agreement = await ChatAgreement.findOne({ where: { userId: payload.id } });
  if (!agreement) throw new Error('Chat rules not agreed');
  return payload;
}

export async function requireNotChatBanned(payload) {
  const user = await User.findByPk(payload.id);
  if (!user || user.chatBanned || user.isBanned) throw new Error('Chat access denied');
  return user;
}

export const requireAdmin = baseRequireAdmin;
