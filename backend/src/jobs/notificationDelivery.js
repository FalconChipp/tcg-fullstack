import { Op } from 'sequelize';
import emailBase from '../emails/emailBase.js';
import buildNotificationEmail from '../emails/notifications/index.js';
import { Notification, User, UserNotificationPref } from '../models/index.js';
import { sendMail } from '../utils/email.js';

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

function buildDigestEmail(notifications) {
  const itemsHtml = notifications
    .map((notification) => {
      const link = notification.linkUrl
        ? `<a href="${notification.linkUrl}" style="color:#2963FF;text-decoration:none;">View</a>`
        : '';
      return `
        <li style="margin:10px 0;padding-bottom:10px;border-bottom:1px solid #e6e8ef;">
          <div style="font-weight:600;color:#232346;">${notification.title}</div>
          <div style="color:#606480;font-size:14px;">${notification.body || ''}</div>
          ${link ? `<div style="margin-top:6px;">${link}</div>` : ''}
        </li>
      `;
    })
    .join('');

  return emailBase({
    title: 'Your daily notifications',
    heading: 'Here’s what you missed',
    content: `
      <p style="color:#44475a;font-size:14px;line-height:22px;">
        You have ${notifications.length} new notification${
      notifications.length === 1 ? '' : 's'
    }.
      </p>
      <ul style="padding:0;margin:12px 0 0 0;list-style:none;">
        ${itemsHtml}
      </ul>
    `,
  });
}

async function sendInstantPendingEmails(logger) {
  const pending = await Notification.findAll({
    where: {
      emailSentAt: null,
      isSilent: false,
      userId: { [Op.ne]: null },
    },
    order: [['createdAt', 'ASC']],
    limit: 500,
  });

  if (!pending.length) return;

  const prefsCache = new Map();
  const userCache = new Map();

  for (const notification of pending) {
    if (!notification.userId) continue;
    let prefs = prefsCache.get(notification.userId);
    if (!prefsCache.has(notification.userId)) {
      prefs = await UserNotificationPref.findByPk(notification.userId);
      prefsCache.set(notification.userId, prefs);
    }
    if (prefs?.emailEnabled === false) continue;
    if ((prefs?.digest || 'instant') !== 'instant') continue;
    if (prefs && isWithinQuietHours(prefs)) continue;

    let user = userCache.get(notification.userId);
    if (!userCache.has(notification.userId)) {
      user = await User.findByPk(notification.userId);
      userCache.set(notification.userId, user);
    }
    if (!user?.email) continue;

    try {
      const template = buildNotificationEmail(notification.type, {
        title: notification.title,
        body: notification.body,
        linkUrl: notification.linkUrl,
        ...(notification.meta || {}),
      });
      await sendMail({
        to: user.email,
        subject: template?.subject || notification.title,
        html:
          template?.html ||
          `<p>${notification.body}</p>${
            notification.linkUrl
              ? `<p><a href="${notification.linkUrl}">${notification.linkUrl}</a></p>`
              : ''
          }`,
      });
      await notification.update({ emailSentAt: new Date() });
    } catch (err) {
      logger?.error?.(
        `[notificationDelivery] instant email failed: ${err?.message || err}`
      );
    }
  }
}

async function sendDailyDigest(logger) {
  const prefs = await UserNotificationPref.findAll({
    where: { digest: 'daily', emailEnabled: true },
  });

  if (!prefs.length) return;

  for (const pref of prefs) {
    const user = await User.findByPk(pref.userId);
    if (!user?.email) continue;

    const notifications = await Notification.findAll({
      where: {
        userId: pref.userId,
        emailSentAt: null,
        isSilent: false,
      },
      order: [['createdAt', 'ASC']],
      limit: 200,
    });

    if (!notifications.length) continue;

    try {
      const html = buildDigestEmail(notifications);
      await sendMail({
        to: user.email,
        subject: 'Your daily SixByFive TCG notifications',
        html,
      });

      const ids = notifications.map((n) => n.id);
      await Notification.update(
        { emailSentAt: new Date() },
        { where: { id: { [Op.in]: ids } } }
      );
    } catch (err) {
      logger?.error?.(
        `[notificationDelivery] daily digest failed: ${err?.message || err}`
      );
    }
  }
}

export function startNotificationDeliveryJobs(logger) {
  const hourly = setInterval(() => {
    sendInstantPendingEmails(logger);
  }, 1000 * 60 * 60);

  const daily = setInterval(() => {
    sendDailyDigest(logger);
  }, 1000 * 60 * 60 * 24);

  sendInstantPendingEmails(logger);
  sendDailyDigest(logger);

  return [hourly, daily];
}
