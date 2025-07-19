import { Achievement, UserAchievement, User } from '../../models/index.js';
import { notifyUser } from '../../utils/notifications.js';
import { grantReward } from '../rewards/helpers.js';

// ---- NEW: Import all achievements & criteria logic ----
import ACHIEVEMENTS from '../../data/achievements.js';
import * as achievementCriteria from '../../data/achievementCriteria.js';

/**
 * Grant an achievement to a user if they have not already earned it,
 * and if the criteria logic (if any) passes.
 * Returns the UserAchievement record, or null if not granted.
 *
 * @param {string} userId - user id
 * @param {string} code - achievement code
 * @param {object} meta - optional metadata stored with the user achievement
 */
export async function maybeGrantAchievement(userId, code, meta = {}) {
  // Find the achievement (from both DB and data)
  const achievementData = ACHIEVEMENTS.find(a => a.code === code);
  const achievement = await Achievement.findOne({ where: { code, isActive: true } });

  if (!achievementData || !achievement) return null;

  // --- Criteria logic: Only grant if passes (if present)
  let passesCriteria = true;
  if (achievementData.criteria && typeof achievementCriteria[achievementData.criteria] === 'function') {
    // Fetch user for criteria check (if needed)
    const user = await User.findByPk(userId);
    passesCriteria = achievementCriteria[achievementData.criteria]({
      user,
      params: achievementData.criteriaParams,
      meta,
    });
  }

  if (!passesCriteria) return null;

  // Don't re-grant if already exists
  const existing = await UserAchievement.findOne({
    where: { userId, achievementId: achievement.id }
  });
  if (existing) return existing;

  // Grant
  const ua = await UserAchievement.create({
    userId,
    achievementId: achievement.id,
    meta,
    earnedAt: new Date()
  });

  await grantReward({
    userId,
    type: 'achievement',
    achievementId: achievement.id,
    data: meta
  });

  await notifyUser({
    userId,
    type: 'achievement_unlocked',
    title: 'Achievement Unlocked!',
    body: achievement.name,
    meta: { achievementId: achievement.id },
  });

  return ua;
}