import { Op } from 'sequelize';
import { Notification } from '../models/index.js';

// Delete dismissed notifications and those past expiry
export function startNotificationCleanup(logger) {
  const run = async () => {
    const now = new Date();
    try {
      const removed = await Notification.destroy({
        where: {
          [Op.or]: [
            { expiresAt: { [Op.lt]: now } },
            {
              isDismissed: true,
              updatedAt: { [Op.lt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
          ],
        },
      });
      if (removed > 0) {
        logger.info(`[notificationCleanup] removed ${removed} notifications`);
      }
    } catch (err) {
      logger.error('Notification cleanup failed', err);
    }
  };

  run();
  return setInterval(run, 1000 * 60 * 60); // hourly
}
