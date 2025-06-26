import { Op } from 'sequelize';
import { Message } from '../models/index.js';

export function startExpiredMessageCleanup(logger) {
  const cleanup = async () => {
    try {
      const now = new Date();
      const oldCutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
      const removed = await Message.destroy({
        where: {
          [Op.or]: [
            { expiresAt: { [Op.lt]: now } },
            { createdAt: { [Op.lt]: oldCutoff } },
          ],
        },
      });
      if (removed > 0) {
        logger.info(`[cleanup] removed ${removed} expired/old messages`);
      }
    } catch (err) {
      logger.error('Expired message cleanup failed', err);
    }
  };

  cleanup();
  const interval = setInterval(cleanup, 1000 * 60 * 60); // hourly
  return interval;
}
