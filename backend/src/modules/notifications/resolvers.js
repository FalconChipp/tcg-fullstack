import { Notification } from '../../models/index.js';
import {
  notifyUser,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  getUnreadCount,
} from '../../utils/notifications.js';
import { requireAuth } from '../collection/helpers.js';
import { requireAdmin } from '../users/helpers.js';

const DEFAULT_PAGE_SIZE = 20;

const resolvers = {
  Query: {
    myNotifications: async (_, { page = 1, pageSize = DEFAULT_PAGE_SIZE, filter = {} }, { token }) => {
      const payload = requireAuth(token);
      const where = { userId: payload.id };
      if (filter.type) where.type = filter.type;
      if (filter.isRead !== undefined) where.isRead = filter.isRead;
      if (filter.isDismissed !== undefined) where.isDismissed = filter.isDismissed;
      const { rows, count } = await Notification.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      return { notifications: rows, total: count, page, pageSize };
    },
    notification: async (_, { id }, { token }) => {
      const payload = requireAuth(token);
      const n = await Notification.findByPk(id);
      if (!n) return null;
      if (n.userId && n.userId !== payload.id && !payload.isAdmin) {
        throw new Error('Not authorized');
      }
      return n;
    },
    unreadNotificationCount: async (_, __, { token }) => {
      const payload = requireAuth(token);
      return getUnreadCount(payload.id);
    },
  },
  Mutation: {
    markNotificationRead: async (_, { id }, { token }) => {
      const payload = requireAuth(token);
      await markAsRead(id, payload.id, payload.isAdmin);
      return true;
    },
    markAllNotificationsRead: async (_, __, { token }) => {
      const payload = requireAuth(token);
      await markAllAsRead(payload.id);
      return true;
    },
    dismissNotification: async (_, { id }, { token }) => {
      const payload = requireAuth(token);
      await dismissNotification(id, payload.id, payload.isAdmin);
      return true;
    },
    adminSendBroadcastNotification: async (_, { input }, { token }) => {
      requireAdmin(token);
      await notifyUser({ ...input, isBroadcast: true });
      return true;
    },
    adminDeleteNotification: async (_, { id }, { token }) => {
      requireAdmin(token);
      await Notification.destroy({ where: { id } });
      return true;
    },
  },
};

export default resolvers;
