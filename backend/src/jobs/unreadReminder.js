import { Op } from 'sequelize';
import { Message, User } from '../models/index.js';
import { sendMail } from '../utils/email.js';
import buildUnreadMessageReminder from '../emails/unreadMessageReminder.js';

export function startUnreadReminderJob(logger) {
  const run = async () => {
    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000); // 6 hours ago
    const messages = await Message.findAll({
      where: {
        isRead: false,
        createdAt: { [Op.lt]: cutoff },
        reminderSentAt: { [Op.is]: null },
      },
      include: [
        { model: User, as: 'sender' },
        { model: User, as: 'receiver' },
      ],
      limit: 100,
    });
    for (const msg of messages) {
      try {
        const { subject, html } = buildUnreadMessageReminder({
          senderUsername: msg.sender.username,
          content: msg.content,
        });
        await sendMail({ to: msg.receiver.email, subject, html });
        msg.reminderSentAt = new Date();
        await msg.save();
        logger.info(`[reminder] sent unread reminder for ${msg.id}`);
      } catch (err) {
        logger.error(`Failed reminder for ${msg.id}: ${err.message}`);
      }
    }
  };

  run();
  const interval = setInterval(run, 1000 * 60 * 15); // every 15 minutes
  return interval;
}
