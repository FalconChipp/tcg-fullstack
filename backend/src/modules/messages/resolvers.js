import { Op } from 'sequelize';
import {
  Message,
  User,
  ChatAgreement,
  ReportedUser,
  AdminAction,
  Notification,
} from '../../models/index.js';
import { verifyJwt } from '../auth/helpers.js';
import { requireAdmin } from './helpers.js';
import { requireChatAgreement, requireNotChatBanned } from './helpers.js';
import { maybeGrantAchievement } from '../achievements/helpers.js';

const DEFAULT_PAGE_SIZE = 20;

async function getAuthUser(token) {
  const payload = await requireChatAgreement(token);
  const user = await requireNotChatBanned(payload);
  return { payload, user };
}

const resolvers = {
  Query: {
    myChats: async (_, { page = 1, pageSize = DEFAULT_PAGE_SIZE }, { token }) => {
      const { user } = await getAuthUser(token);
      const msgs = await Message.findAll({
        where: {
          [Op.or]: [
            { senderId: user.id, deletedBySender: false },
            { receiverId: user.id, deletedByReceiver: false },
          ],
        },
        order: [['createdAt', 'DESC']],
      });
      const map = new Map();
      for (const m of msgs) {
        const otherId = m.senderId === user.id ? m.receiverId : m.senderId;
        if (!map.has(otherId)) {
          map.set(otherId, { lastMessage: m, unread: 0 });
        }
        if (m.receiverId === user.id && !m.isRead) {
          map.get(otherId).unread++;
        }
      }
      const summaries = [];
      for (const [otherId, data] of map) {
        const otherUser = await User.findByPk(otherId);
        summaries.push({
          user: otherUser,
          lastMessage: data.lastMessage,
          unreadCount: data.unread,
        });
      }
      summaries.sort(
        (a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
      );
      const start = (page - 1) * pageSize;
      return summaries.slice(start, start + pageSize);
    },
    chatWithUser: async (_, { userId, page = 1, pageSize = DEFAULT_PAGE_SIZE }, { token }) => {
      const { user } = await getAuthUser(token);
      const where = {
        [Op.or]: [
          { senderId: user.id, receiverId: userId, deletedBySender: false },
          { senderId: userId, receiverId: user.id, deletedByReceiver: false },
        ],
      };
      return Message.findAll({
        where,
        order: [['createdAt', 'ASC']],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
    },
    unreadCount: async (_, __, { token }) => {
      const { user } = await getAuthUser(token);
      return Message.count({
        where: { receiverId: user.id, isRead: false, deletedByReceiver: false },
      });
    },
    hasAgreedToChatRules: async (_, __, { token }) => {
      if (!token) return false;
      try {
        const payload = verifyJwt(token);
        const agreement = await ChatAgreement.findOne({ where: { userId: payload.id } });
        return !!agreement;
      } catch {
        return false;
      }
    },
    adminQueryMessages: async (_, { filter = {}, page = 1, pageSize = DEFAULT_PAGE_SIZE }, { token }) => {
      requireAdmin(token);
      const where = {};
      if (filter.flaggedOnly) where.isFlagged = true;
      if (filter.userId) {
        where[Op.or] = [{ senderId: filter.userId }, { receiverId: filter.userId }];
      }
      if (filter.isSystem !== undefined) where.isSystemMessage = filter.isSystem;
      if (filter.query) where.content = { [Op.like]: `%${filter.query}%` };
      return Message.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
    },
    adminQueryReportedMessages: async (_, { page = 1, pageSize = DEFAULT_PAGE_SIZE }, { token }) => {
      requireAdmin(token);
      return Message.findAll({
        where: { isFlagged: true },
        order: [['createdAt', 'DESC']],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
    },
    adminQueryReportedUsers: async (_, { page = 1, pageSize = DEFAULT_PAGE_SIZE }, { token }) => {
      requireAdmin(token);
      return ReportedUser.findAll({
        where: { isCleared: false },
        include: [
          { model: User, as: 'user' },
          { model: User, as: 'reporter' },
        ],
        order: [['createdAt', 'DESC']],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
    },
  },
  Mutation: {
    sendMessage: async (_, { receiverId, content, meta }, { token, io }) => {
      const { user } = await getAuthUser(token);
      if (receiverId === user.id) throw new Error('Cannot message yourself');
      const receiver = await User.findByPk(receiverId);
      if (!receiver) throw new Error('User not found');
      if (receiver.chatBanned || receiver.isBanned) throw new Error('Receiver banned');
      const message = await Message.create({ senderId: user.id, receiverId, content, meta });
      await Notification.create({
        userId: receiverId,
        type: 'message',
        title: 'New Message',
        body: content.slice(0, 120),
        data: { senderId: user.id, messageId: message.id },
      });
      // TODO: emit socket.io event or other notification
      const sentCount = await Message.count({ where: { senderId: user.id } });
      if (sentCount === 1) await maybeGrantAchievement(user.id, 'first_message_sent', { receiverId });
      const recvCount = await Message.count({ where: { receiverId } });
      if (recvCount === 1) await maybeGrantAchievement(receiverId, 'first_message_received', { senderId: user.id });
      const chatExists = await Message.count({ where: { senderId: receiverId, receiverId: user.id } });
      if (chatExists > 0 && sentCount === 1)
        await maybeGrantAchievement(user.id, 'first_chat_complete', { withUser: receiverId });
      io?.to(receiverId).emit('newMessage', { from: user.id });
      return message;
    },
    markChatRead: async (_, { userId }, { token }) => {
      const { user } = await getAuthUser(token);
      await Message.update({ isRead: true }, { where: { senderId: userId, receiverId: user.id } });
      return true;
    },
    deleteChat: async (_, { userId }, { token }) => {
      const { user } = await getAuthUser(token);
      await Message.update(
        { deletedBySender: true },
        { where: { senderId: user.id, receiverId: userId } }
      );
      await Message.update(
        { deletedByReceiver: true },
        { where: { senderId: userId, receiverId: user.id } }
      );
      await Message.destroy({
        where: {
          [Op.or]: [
            { senderId: user.id, receiverId: userId, deletedBySender: true, deletedByReceiver: true },
            { senderId: userId, receiverId: user.id, deletedBySender: true, deletedByReceiver: true },
          ],
        },
      });
      return true;
    },
    reportMessage: async (_, { messageId, reason }, { token }) => {
      const { user } = await getAuthUser(token);
      const msg = await Message.findByPk(messageId);
      if (!msg) throw new Error('Message not found');
      msg.isFlagged = true;
      msg.flagReason = reason;
      msg.flaggedById = user.id;
      await msg.save();
      // TODO: notify admins
      return true;
    },
    reportUser: async (_, { userId, reason }, { token }) => {
      const { user } = await getAuthUser(token);
      await ReportedUser.create({ userId, reporterId: user.id, reason });
      // TODO: notify admins
      return true;
    },
    agreeToChatRules: async (_, __, { token }) => {
      if (!token) throw new Error('Not authenticated');
      const payload = verifyJwt(token);
      const existing = await ChatAgreement.findOne({ where: { userId: payload.id } });
      if (existing) return true;
      await ChatAgreement.create({ userId: payload.id, agreedAt: new Date() });
      return true;
    },
    adminDeleteMessage: async (_, { id }, { token }) => {
      const admin = requireAdmin(token);
      await Message.destroy({ where: { id } });
      await AdminAction.create({
        adminId: admin.id,
        targetUserId: null,
        actionType: 'delete_message',
        details: { id },
      });
      return true;
    },
    adminBanUserFromChat: async (_, { userId, reason }, { token }) => {
      const admin = requireAdmin(token);
      const user = await User.findByPk(userId);
      if (!user) throw new Error('User not found');
      user.chatBanned = true;
      await user.save();
      await AdminAction.create({
        adminId: admin.id,
        targetUserId: userId,
        actionType: 'chat_ban',
        reason,
      });
      return true;
    },
    adminUnbanUserFromChat: async (_, { userId }, { token }) => {
      const admin = requireAdmin(token);
      const user = await User.findByPk(userId);
      if (!user) throw new Error('User not found');
      user.chatBanned = false;
      await user.save();
      await AdminAction.create({
        adminId: admin.id,
        targetUserId: userId,
        actionType: 'chat_unban',
      });
      return true;
    },
    adminClearUserReport: async (_, { userId }, { token }) => {
      requireAdmin(token);
      await ReportedUser.update({ isCleared: true }, { where: { userId } });
      return true;
    },
    adminSendSystemMessage: async (_, { content, meta }, { token, io }) => {
      const admin = requireAdmin(token);
      const users = await User.findAll({ where: { isBanned: false } });
      for (const u of users) {
        if (u.id === admin.id) continue;
        if (u.chatBanned) continue;
        const msg = await Message.create({
          senderId: admin.id,
          receiverId: u.id,
          content,
          meta,
          isSystemMessage: true,
        });
        await Notification.create({
          userId: u.id,
          type: 'system',
          title: 'System Message',
          body: content.slice(0, 120),
          data: { adminId: admin.id, messageId: msg.id },
        });
        // TODO: emit socket.io event or other notification for system messages
        io?.to(u.id).emit('newMessage', { from: admin.id, system: true });
      }
      return true;
    },
  },
  Message: {
    sender: (msg) => User.findByPk(msg.senderId),
    receiver: (msg) => User.findByPk(msg.receiverId),
    flaggedBy: (msg) => (msg.flaggedById ? User.findByPk(msg.flaggedById) : null),
  },
};

export default resolvers;
