// src/modules/achievements/helpers.js
import { Achievement, UserAchievement } from '../../models/index.js';
import { notifyUser } from '../../utils/notifications.js';
import { grantReward } from '../rewards/helpers.js';

/**
 * Grant an achievement to a user if they have not already earned it.
 * Returns the UserAchievement record or null if achievement not found.
 * @param {string} userId - user id
 * @param {string} code - achievement code
 * @param {object} meta - optional metadata stored with the user achievement
 */
export async function maybeGrantAchievement(userId, code, meta = {}) {
  const achievement = await Achievement.findOne({ where: { code, isActive: true } });
  if (!achievement) return null;
  const existing = await UserAchievement.findOne({ where: { userId, achievementId: achievement.id } });
  if (existing) return existing;
  const ua = await UserAchievement.create({ userId, achievementId: achievement.id, meta, earnedAt: new Date() });
  await grantReward({ userId, type: 'achievement', achievementId: achievement.id, data: meta });
  await notifyUser({
    userId,
    type: 'achievement_unlocked',
    title: 'Achievement Unlocked!',
    body: achievement.name,
    meta: { achievementId: achievement.id },
  });
  return ua;
}
