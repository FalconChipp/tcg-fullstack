// src/utils/notifications.js — ESM
// CHANGED: adds makeNotifyUser({ models, email }) factory for testability.

import { Notification, User, UserNotificationPref } from '../models/index.js';
import { sendMail } from './email.js';

// NEW: DI-friendly factory
export function makeNotifyUser({ models, email }) {
  const {
    Notification: NotificationModel,
    User: UserModel,
    UserNotificationPref: PrefModel,
  } = models;

  const { sendMail: send } = email;

  return async function notifyUser({
    userId,
    type = 'price_alert',
    title,
    body,
    iconUrl = null,
    linkUrl = null,
    meta = null,
    isSilent = false,
    expiresAt = null,
  }) {
    const prefs = await PrefModel.findByPk(userId);
    const inappOk = !prefs || prefs.inappEnabled !== false;

    if (inappOk && !isSilent) {
      await NotificationModel.create({
        userId,
        type,
        title,
        body,
        iconUrl,
        linkUrl,
        meta,
        isRead: false,
        isDismissed: false,
        expiresAt,
        isSilent: !!isSilent,
      });
    }

    const emailOk = !prefs || prefs.emailEnabled !== false;
    if (emailOk && !isSilent) {
      const user = await UserModel.findByPk(userId);
      if (user?.email) {
        try {
          await send({
            to: user.email,
            subject: title,
            html: `<p>${body}</p>${linkUrl ? `<p><a href="${linkUrl}">${linkUrl}</a></p>` : ''}`,
          });
        } catch (err) {
          console.error('[EMAIL] notifyUser failed:', err?.message || err);
        }
      }
    }
  };
}

// Default notifyUser (real deps)
export const notifyUser = makeNotifyUser({
  models: { Notification, User, UserNotificationPref },
  email: { sendMail },
});
export default notifyUser;

// The following helpers remain unchanged; they accept objects as args.
export async function markAsRead({ id, userId }) {
  const row = await Notification.findByPk(id);
  if (!row || row.userId !== userId) return false;
  await row.update({ isRead: true });
  return true;
}

export async function markAllAsRead({ userId }) {
  await Notification.update({ isRead: true }, { where: { userId, isRead: false } });
  return true;
}

export async function dismissNotification({ id, userId }) {
  const row = await Notification.findByPk(id);
  if (!row || row.userId !== userId) return false;
  await row.update({ isDismissed: true });
  return true;
}

export async function getUnreadCount({ userId }) {
  return Notification.count({ where: { userId, isRead: false, isDismissed: false } });
}
