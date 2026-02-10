// src/modules/notifications/resolvers.js
// CHANGED: exposes makeNotificationsResolvers({ models, auth, utils }) for testability
// Default export still uses your real imports & utils.

import { Notification, UserNotificationPref } from '../../models/index.js';
import {
  notifyUser as realNotifyUser,
  notifyBroadcast as realNotifyBroadcast,
  markAsRead as realMarkAsRead,
  markAllAsRead as realMarkAllAsRead,
  dismissNotification as realDismissNotification,
  getUnreadCount as realGetUnreadCount,
} from '../../utils/notifications.js';
import { requireAuth as realRequireAuth } from '../collection/helpers.js';
import { requireAdmin as realRequireAdmin } from '../users/helpers.js';

const DEFAULT_PAGE_SIZE = 20;

// NEW: factory so tests can inject models/auth/utils without path mocking
export function makeNotificationsResolvers({
  models,
  auth,
  utils,
}) {
  const {
    Notification: NotificationModel,
    UserNotificationPref: PrefModel,
  } = models;

  const {
    requireAuth,
    requireAdmin,
  } = auth;

  const {
    notifyUser,
    notifyBroadcast,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    getUnreadCount,
  } = utils;

  return {
    Query: {
      async myNotifications(_, { page = 1, pageSize = DEFAULT_PAGE_SIZE, filter = {} }, { token }) {
        const payload = requireAuth(token);
        const where = { userId: payload.id, isSilent: false };
        if (filter.type) where.type = filter.type;
        if (filter.isRead !== undefined) where.isRead = filter.isRead;
        if (filter.isDismissed !== undefined) where.isDismissed = filter.isDismissed;

        const { rows, count } = await NotificationModel.findAndCountAll({
          where,
          order: [['createdAt', 'DESC']],
          limit: pageSize,
          offset: (page - 1) * pageSize,
        });

        return { notifications: rows, total: count, page, pageSize };
      },

      async notification(_, { id }, { token }) {
        const payload = requireAuth(token);
        const n = await NotificationModel.findByPk(id);
        if (!n) return null;
        if (n.userId && n.userId !== payload.id && !payload.isAdmin) {
          throw new Error('Not authorized');
        }
        return n;
      },

      async unreadNotificationCount(_, __, { token }) {
        const payload = requireAuth(token);
        // FIX: utils expect an object { userId }
        return getUnreadCount({ userId: payload.id });
      },

      async myNotificationPrefs(_, __, { token }) {
        const me = requireAuth(token);
        const prefs = await PrefModel.findByPk(me.id);
        return {
          inappEnabled: prefs?.inappEnabled ?? true,
          emailEnabled: prefs?.emailEnabled ?? true,
          pushEnabled: prefs?.pushEnabled ?? false,
          digest: prefs?.digest ?? 'instant',
          quietStart: prefs?.quietStart ?? null,
          quietEnd: prefs?.quietEnd ?? null,
        };
      },
    },

    Mutation: {
      async markNotificationRead(_, { id }, { token }) {
        const payload = requireAuth(token);
        // FIX: utils expect an object { id, userId }
        await markAsRead({ id, userId: payload.id });
        return true;
      },

      async markAllNotificationsRead(_, __, { token }) {
        const payload = requireAuth(token);
        // FIX: utils expect an object { userId }
        await markAllAsRead({ userId: payload.id });
        return true;
      },

      async dismissNotification(_, { id }, { token }) {
        const payload = requireAuth(token);
        // FIX: utils expect an object { id, userId }
        await dismissNotification({ id, userId: payload.id });
        return true;
      },

      async adminSendBroadcastNotification(_, { input }, { token }) {
        await requireAdmin(token);
        await notifyBroadcast({ ...input });
        return true;
      },

      async adminDeleteNotification(_, { id }, { token }) {
        await requireAdmin(token);
        await NotificationModel.destroy({ where: { id } });
        return true;
      },

      async setNotificationPrefs(_, args, { token }) {
        const me = requireAuth(token);
        const [row] = await PrefModel.findOrCreate({
          where: { userId: me.id },
          defaults: { userId: me.id },
        });
        await row.update({
          inappEnabled: args.inappEnabled ?? row.inappEnabled,
          emailEnabled: args.emailEnabled ?? row.emailEnabled,
          pushEnabled: args.pushEnabled ?? row.pushEnabled,
          digest: args.digest ?? row.digest,
          quietStart: args.quietStart ?? row.quietStart,
          quietEnd: args.quietEnd ?? row.quietEnd,
        });
        return true;
      },
    },
  };
}

// Default export: wires real deps for production
const resolvers = makeNotificationsResolvers({
  models: { Notification, UserNotificationPref },
  auth: { requireAuth: realRequireAuth, requireAdmin: realRequireAdmin },
  utils: {
    notifyUser: realNotifyUser,
    notifyBroadcast: realNotifyBroadcast,
    markAsRead: realMarkAsRead,
    markAllAsRead: realMarkAllAsRead,
    dismissNotification: realDismissNotification,
    getUnreadCount: realGetUnreadCount,
  },
});

export default resolvers;
