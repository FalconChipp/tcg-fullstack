// src/utils/notifications.js
import { Notification, User } from '../models/index.js';
import buildNotificationEmail from '../emails/notifications/index.js';
import { sendMail } from './email.js';

/**
 * Create a notification for a single user or broadcast to all users.
 * Email and push notification hooks are left commented for future use.
 * @param {Object} opts
 */
export async function notifyUser({
  userId,
  type,
  title,
  body,
  iconUrl,
  linkUrl,
  meta,
  isBroadcast = false,
  isSilent = false,
  expiresAt,
}) {
  if (!expiresAt && (isBroadcast || type === 'system')) {
    expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  const payload = {
    userId: userId || null,
    type,
    title,
    body,
    iconUrl,
    linkUrl,
    meta,
    isBroadcast,
    isSilent,
    expiresAt,
  };

  const records = [];
  if (isBroadcast) {
    const users = await User.findAll({ attributes: ['id'] });
    const bulk = users.map((u) => ({ ...payload, userId: u.id }));
    records.push(...(await Notification.bulkCreate(bulk)));
  } else {
    records.push(await Notification.create(payload));
  }

  if (!isSilent) {
    // TODO: emit socket.io event to user(s) here
  }

  // Email sending (disabled by default)
  const email = buildNotificationEmail(type, { title, body, linkUrl, meta });
  if (email && !isBroadcast) {
    // await sendMail({ to: (await User.findByPk(userId)).email, ...email });
  }
  return records;
}

export async function markAsRead(id, userId, allowAdmin = false) {
  const where = allowAdmin ? { id } : { id, userId };
  await Notification.update({ isRead: true }, { where });
}

export async function markAllAsRead(userId) {
  await Notification.update({ isRead: true }, { where: { userId } });
}

export async function dismissNotification(id, userId, allowAdmin = false) {
  const where = allowAdmin ? { id } : { id, userId };
  await Notification.update({ isDismissed: true }, { where });
}

export async function getUnreadCount(userId) {
  return Notification.count({
    where: { userId, isRead: false, isDismissed: false },
  });
}
