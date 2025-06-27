import { Reward } from '../../models/index.js';
import { notifyUser } from '../../utils/notifications.js';

export async function grantReward({ userId, type, achievementId = null, data = {} }) {
  const reward = await Reward.create({ userId, type, achievementId, data });
  await notifyUser({
    userId,
    type: 'reward',
    title: 'You earned a reward!',
    body: type,
    meta: { achievementId, ...data },
  });
  return reward;
}
