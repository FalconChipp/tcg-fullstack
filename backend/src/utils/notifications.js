// src/utils/notifications.js — ESM
// CHANGED: adds makeNotifyUser({ models, email, push }) factory for testability.

import { Notification, User, UserNotificationPref } from '../models/index.js';
import buildNotificationEmail from '../emails/notifications/index.js';
import { sendMail } from './email.js';
import { emitUserNotification } from './socket.js';

function parseTimeString(value) {
  if (!value || typeof value !== 'string') return null;
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return { hours, minutes };
}

function isWithinQuietHours({ quietStart, quietEnd }, now = new Date()) {
  const start = parseTimeString(quietStart);
  const end = parseTimeString(quietEnd);
  if (!start || !end) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;

  if (startMinutes === endMinutes) return false;

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

// NEW: DI-friendly factory
export function makeNotifyUser({ models, email, push }) {
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
    isBroadcast = false,
    expiresAt = null,
    sendInApp = true,
    sendEmail = true,
    sendPush = true,
  }) {
    const prefs = await PrefModel.findByPk(userId);
    const inappOk = sendInApp && (!prefs || prefs.inappEnabled !== false);
    const emailOk = sendEmail && (!prefs || prefs.emailEnabled !== false);
    const pushOk = sendPush && !!push && (!prefs || prefs.pushEnabled !== false);
    const digestMode = prefs?.digest || 'instant';
    const withinQuiet = prefs ? isWithinQuietHours(prefs) : false;
    const shouldStore = !isSilent && (inappOk || emailOk || pushOk);

    let notificationRow = null;
    if (shouldStore) {
      notificationRow = await NotificationModel.create({
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
        isSilent: !inappOk,
        isBroadcast: !!isBroadcast,
      });
    }

    const shouldSendNow = !withinQuiet && digestMode === 'instant' && !isSilent;

    if (emailOk && shouldSendNow) {
      const user = await UserModel.findByPk(userId);
      if (user?.email) {
        try {
          const template = buildNotificationEmail(type, {
            title,
            body,
            linkUrl,
            ...(meta || {}),
          });
          await send({
            to: user.email,
            subject: template?.subject || title,
            html:
              template?.html ||
              `<p>${body}</p>${linkUrl ? `<p><a href="${linkUrl}">${linkUrl}</a></p>` : ''}`,
          });
          if (notificationRow) {
            await notificationRow.update({ emailSentAt: new Date() });
          }
        } catch (err) {
          console.error('[EMAIL] notifyUser failed:', err?.message || err);
        }
      }
    }

    if (pushOk && shouldSendNow) {
      try {
        await push.sendPush({
          userId,
          title,
          body,
          linkUrl,
          meta,
          type,
        });
      } catch (err) {
        console.error('[PUSH] notifyUser failed:', err?.message || err);
      }
    }

    if (notificationRow && !notificationRow.isSilent) {
      emitUserNotification(userId, {
        id: notificationRow.id,
        type: notificationRow.type,
        title: notificationRow.title,
        body: notificationRow.body,
        iconUrl: notificationRow.iconUrl,
        linkUrl: notificationRow.linkUrl,
        createdAt: notificationRow.createdAt,
        isRead: notificationRow.isRead,
        isDismissed: notificationRow.isDismissed,
        isBroadcast: notificationRow.isBroadcast,
      });
    }

    return notificationRow;
  };
}

// Default notifyUser (real deps)
export const notifyUser = makeNotifyUser({
  models: { Notification, User, UserNotificationPref },
  email: { sendMail },
  push: null,
});
export default notifyUser;

export async function notifyBroadcast(input, { chunkSize = 50 } = {}) {
  const users = await User.findAll({ attributes: ['id'], raw: true });
  let sent = 0;
  for (let i = 0; i < users.length; i += chunkSize) {
    const slice = users.slice(i, i + chunkSize);
    await Promise.all(
      slice.map((row) =>
        notifyUser({
          ...input,
          userId: row.id,
          isBroadcast: true,
        })
      )
    );
    sent += slice.length;
  }
  return sent;
}

// The following helpers remain unchanged; they accept objects as args.
export async function markAsRead({ id, userId }) {
  const row = await Notification.findByPk(id);
  if (!row || row.userId !== userId) return false;
  await row.update({ isRead: true });
  return true;
}

export async function markAllAsRead({ userId }) {
  await Notification.update(
    { isRead: true },
    { where: { userId, isRead: false, isSilent: false } }
  );
  return true;
}

export async function dismissNotification({ id, userId }) {
  const row = await Notification.findByPk(id);
  if (!row || row.userId !== userId) return false;
  await row.update({ isDismissed: true });
  return true;
}

export async function getUnreadCount({ userId }) {
  return Notification.count({
    where: { userId, isRead: false, isDismissed: false, isSilent: false },
  });
}
