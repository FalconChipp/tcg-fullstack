// src/modules/messages/resolvers.js
//
// UPDATED (2026-01-29):
// - FIX (CRITICAL): UUID-safe IDs everywhere (removed Number(...) casts that broke UUIDs)
//   - myChats(): stop converting otherIds to Number (UUIDs became NaN => 0 conversations)
//   - sendMessage(): self-check now string-based
//   - mute/block mutations: removed Number(userId) casts (UUID-safe)
// - KEEP: agreement/banned guards + moderation + achievements + rules text query
// - NOTE: notifyUser still fires immediately on sendMessage (you said you want delayed reminders;
//         we can move this into an "unread reminder" job next)
//
// IMPORTANT:
// - This assumes your User.id, Message.senderId/receiverId, ChatMute.otherUserId, ChatBlock.blockedId are UUID/string.

import { Op } from "sequelize";
import {
  Message,
  User,
  ChatAgreement,
  ReportedUser,
  AdminAction,
  ChatMute,
  ChatBlock,
} from "../../models/index.js";
import { verifyJwt } from "../auth/helpers.js";
import {
  CHAT_RULES,
  requireAdmin,
  requireChatAgreement,
  requireNotChatBanned,
} from "./helpers.js";
import { maybeGrantAchievement } from "../achievements/helpers.js";
import { notifyUser } from "../../utils/notifications.js";

const DEFAULT_PAGE_SIZE = 20;

async function getAuthUser(token) {
  const payload = await requireChatAgreement(token);
  const user = await requireNotChatBanned(payload);
  return { payload, user };
}

function safeSnippet(text, max = 120) {
  if (typeof text !== "string") return "";
  const t = text.trim();
  return t.length <= max ? t : t.slice(0, max);
}

function isoOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Returns true if either direction has a block between these users.
 */
async function isBlockedBetween(userAId, userBId) {
  const a = String(userAId);
  const b = String(userBId);

  const block = await ChatBlock.findOne({
    where: {
      [Op.or]: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
  });
  return !!block;
}

/**
 * Returns true if receiver has muted sender (so we should suppress notifications/typing).
 */
async function isMutedForReceiver(receiverId, senderId) {
  const receiver = String(receiverId);
  const sender = String(senderId);

  const mute = await ChatMute.findOne({
    where: { userId: receiver, otherUserId: sender },
  });
  if (!mute) return false;

  if (!mute.mutedUntil) return true; // forever

  const until = new Date(mute.mutedUntil);
  if (Number.isNaN(until.getTime())) return true; // treat invalid as muted
  return until.getTime() > Date.now();
}

/**
 * Removes chat summaries that are blocked.
 */
async function filterBlockedOtherIds(meId, otherIds) {
  const me = String(meId);
  const ids = (otherIds || []).map(String).filter(Boolean);
  if (!ids.length) return new Set();

  const blocks = await ChatBlock.findAll({
    where: {
      [Op.or]: [
        { blockerId: me, blockedId: { [Op.in]: ids } },
        { blockedId: me, blockerId: { [Op.in]: ids } },
      ],
    },
  });

  const blocked = new Set();
  for (const b of blocks) {
    const other = String(b.blockerId) === me ? b.blockedId : b.blockerId;
    blocked.add(String(other));
  }
  return blocked;
}

const resolvers = {
  Query: {
    chatRulesText: async () => String(CHAT_RULES || "").trim(),

    myChats: async (_, { page = 1, pageSize = DEFAULT_PAGE_SIZE }, { token }) => {
      const { user } = await getAuthUser(token);

      const meId = String(user.id);

      const msgs = await Message.findAll({
        where: {
          [Op.or]: [
            { senderId: meId, deletedBySender: false },
            { receiverId: meId, deletedByReceiver: false },
          ],
        },
        order: [["createdAt", "DESC"]],
      });

      const map = new Map();
      for (const m of msgs) {
        const senderId = String(m.senderId);
        const receiverId = String(m.receiverId);
        const otherId = senderId === meId ? receiverId : senderId;

        if (!map.has(otherId)) {
          map.set(otherId, { lastMessage: m, unread: 0 });
        }
        if (receiverId === meId && !m.isRead) {
          map.get(otherId).unread += 1;
        }
      }

      // ✅ FIX: UUID-safe (no Number(...) casting)
      const otherIds = Array.from(map.keys()).map(String).filter(Boolean);

      // Block enforcement
      const blockedSet = await filterBlockedOtherIds(meId, otherIds);

      // Batch-load users for remaining IDs
      const visibleOtherIds = otherIds.filter((id) => !blockedSet.has(String(id)));
      const others = visibleOtherIds.length
        ? await User.findAll({ where: { id: { [Op.in]: visibleOtherIds } } })
        : [];

      const otherById = new Map(others.map((u) => [String(u.id), u]));

      const summaries = [];
      for (const [otherId, data] of map) {
        if (blockedSet.has(String(otherId))) continue;

        const otherUser = otherById.get(String(otherId)) || null;
        if (!otherUser) continue;

        summaries.push({
          user: otherUser,
          lastMessage: data.lastMessage,
          unreadCount: data.unread,
        });
      }

      summaries.sort(
        (a, b) =>
          new Date(b.lastMessage.createdAt).getTime() -
          new Date(a.lastMessage.createdAt).getTime()
      );

      const start = (page - 1) * pageSize;
      return summaries.slice(start, start + pageSize);
    },

    chatWithUser: async (
      _,
      { userId, page = 1, pageSize = DEFAULT_PAGE_SIZE },
      { token }
    ) => {
      const { user } = await getAuthUser(token);

      const meId = String(user.id);
      const otherId = String(userId);

      // Block enforcement
      const blocked = await isBlockedBetween(meId, otherId);
      if (blocked) return [];

      const where = {
        [Op.or]: [
          { senderId: meId, receiverId: otherId, deletedBySender: false },
          { senderId: otherId, receiverId: meId, deletedByReceiver: false },
        ],
      };

      return Message.findAll({
        where,
        order: [["createdAt", "ASC"]],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
    },

    unreadCount: async (_, __, { token }) => {
      const { user } = await getAuthUser(token);
      const meId = String(user.id);

      return Message.count({
        where: { receiverId: meId, isRead: false, deletedByReceiver: false },
      });
    },

    hasAgreedToChatRules: async (_, __, { token }) => {
      if (!token) return false;
      try {
        const payload = verifyJwt(token);
        const agreement = await ChatAgreement.findOne({
          where: { userId: String(payload.id) },
        });
        return !!agreement;
      } catch {
        return false;
      }
    },

    myMutedConversations: async (_, __, { token }) => {
      const { user } = await getAuthUser(token);
      return ChatMute.findAll({
        where: { userId: String(user.id) },
        order: [["updatedAt", "DESC"]],
      });
    },

    myBlockedUsers: async (_, __, { token }) => {
      const { user } = await getAuthUser(token);
      return ChatBlock.findAll({
        where: { blockerId: String(user.id) },
        order: [["createdAt", "DESC"]],
      });
    },

    adminQueryMessages: async (
      _,
      { filter = {}, page = 1, pageSize = DEFAULT_PAGE_SIZE },
      { token }
    ) => {
      requireAdmin(token);

      const where = {};
      if (filter.flaggedOnly) where.isFlagged = true;

      if (filter.userId) {
        where[Op.or] = [
          { senderId: String(filter.userId) },
          { receiverId: String(filter.userId) },
        ];
      }

      if (filter.isSystem !== undefined) where.isSystemMessage = filter.isSystem;
      if (filter.query) where.content = { [Op.like]: `%${filter.query}%` };

      return Message.findAll({
        where,
        order: [["createdAt", "DESC"]],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
    },

    adminQueryReportedMessages: async (
      _,
      { filter = {}, page = 1, pageSize = DEFAULT_PAGE_SIZE },
      { token }
    ) => {
      requireAdmin(token);

      const where = { isFlagged: true };

      if (filter.userId) {
        where[Op.or] = [
          { senderId: String(filter.userId) },
          { receiverId: String(filter.userId) },
        ];
      }

      if (filter.isSystem !== undefined) where.isSystemMessage = filter.isSystem;
      if (filter.query) where.content = { [Op.like]: `%${filter.query}%` };

      return Message.findAll({
        where,
        order: [["createdAt", "DESC"]],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
    },

    adminQueryReportedUsers: async (
      _,
      { filter = {}, page = 1, pageSize = DEFAULT_PAGE_SIZE },
      { token }
    ) => {
      requireAdmin(token);

      const where = { isCleared: false };
      if (filter.userId) where.userId = String(filter.userId);
      if (filter.reporterId) where.reporterId = String(filter.reporterId);

      return ReportedUser.findAll({
        where,
        include: [
          { model: User, as: "user" },
          { model: User, as: "reporter" },
        ],
        order: [["createdAt", "DESC"]],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
    },

    adminQueryChatBlocks: async (
      _,
      { filter = {}, page = 1, pageSize = DEFAULT_PAGE_SIZE },
      { token }
    ) => {
      requireAdmin(token);

      const where = {};
      if (filter.blockerId) where.blockerId = String(filter.blockerId);
      if (filter.blockedId) where.blockedId = String(filter.blockedId);

      return ChatBlock.findAll({
        where,
        order: [["createdAt", "DESC"]],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
    },
  },

  Mutation: {
    sendMessage: async (_, { receiverId, content, meta }, { token, io }) => {
      const { user } = await getAuthUser(token);

      const meId = String(user.id);
      const toId = String(receiverId);

      // ✅ FIX: UUID-safe self-check
      if (toId === meId) {
        throw new Error("Cannot message yourself");
      }

      // Block enforcement
      if (await isBlockedBetween(meId, toId)) {
        throw new Error("Cannot message this user");
      }

      const receiver = await User.findByPk(toId);
      if (!receiver) throw new Error("User not found");
      if (receiver.chatBanned || receiver.isBanned) throw new Error("Receiver banned");

      const cleanContent = typeof content === "string" ? content.trim() : "";
      if (!cleanContent) throw new Error("Message content is required");

      const message = await Message.create({
        senderId: meId,
        receiverId: toId,
        content: cleanContent,
        meta: meta ?? null,
      });

      // Mute enforcement: suppress notify + typing if receiver muted sender
      const muted = await isMutedForReceiver(toId, meId);

      if (!muted) {
        // NOTE: currently immediate.
        // You said you want delayed "unread reminder" emails instead of instant.
        // We'll move this into a scheduled job after frontend is stable.
        await notifyUser({
          userId: toId,
          type: "message",
          title: "New Message",
          body: safeSnippet(cleanContent, 120),
          meta: { senderId: meId, messageId: message.id },
        });
      }

      // Achievements (kept)
      const sentCount = await Message.count({ where: { senderId: meId } });
      if (sentCount === 1) {
        await maybeGrantAchievement(meId, "first_message_sent", { receiverId: toId });
      }

      const recvCount = await Message.count({ where: { receiverId: toId } });
      if (recvCount === 1) {
        await maybeGrantAchievement(toId, "first_message_received", { senderId: meId });
      }

      const chatExists = await Message.count({
        where: { senderId: toId, receiverId: meId },
      });
      if (chatExists > 0 && sentCount === 1) {
        await maybeGrantAchievement(meId, "first_chat_complete", { withUser: toId });
      }

      // Socket: always deliver message event so chat UI updates
      io?.to(String(toId)).emit("newMessage", {
        from: meId,
        messageId: message.id,
      });

      return message;
    },

    markChatRead: async (_, { userId }, { token }) => {
      const { user } = await getAuthUser(token);

      const meId = String(user.id);
      const otherId = String(userId);

      await Message.update(
        { isRead: true },
        {
          where: {
            senderId: otherId,
            receiverId: meId,
            deletedByReceiver: false,
          },
        }
      );

      return true;
    },

    deleteChat: async (_, { userId }, { token }) => {
      const { user } = await getAuthUser(token);

      const meId = String(user.id);
      const otherId = String(userId);

      await Message.update(
        { deletedBySender: true },
        { where: { senderId: meId, receiverId: otherId } }
      );

      await Message.update(
        { deletedByReceiver: true },
        { where: { senderId: otherId, receiverId: meId } }
      );

      await Message.destroy({
        where: {
          [Op.or]: [
            {
              senderId: meId,
              receiverId: otherId,
              deletedBySender: true,
              deletedByReceiver: true,
            },
            {
              senderId: otherId,
              receiverId: meId,
              deletedBySender: true,
              deletedByReceiver: true,
            },
          ],
        },
      });

      return true;
    },

    muteConversation: async (_, { userId, mutedUntil }, { token }) => {
      const { user } = await getAuthUser(token);

      const meId = String(user.id);
      const otherId = String(userId);

      if (otherId === meId) return true;

      const untilDate = mutedUntil ? new Date(mutedUntil) : null;
      if (mutedUntil && Number.isNaN(untilDate.getTime())) {
        throw new Error("Invalid mutedUntil date");
      }

      await ChatMute.upsert({
        userId: meId,
        otherUserId: otherId, // ✅ FIX: no Number(...)
        mutedUntil: untilDate,
      });

      return true;
    },

    unmuteConversation: async (_, { userId }, { token }) => {
      const { user } = await getAuthUser(token);

      await ChatMute.destroy({
        where: { userId: String(user.id), otherUserId: String(userId) },
      });

      return true;
    },

    blockUserFromChat: async (_, { userId, reason }, { token }) => {
      const { user } = await getAuthUser(token);

      const meId = String(user.id);
      const otherId = String(userId);

      if (otherId === meId) return true;

      await ChatBlock.upsert({
        blockerId: meId,
        blockedId: otherId, // ✅ FIX: no Number(...)
        reason: reason ?? null,
      });

      return true;
    },

    unblockUserFromChat: async (_, { userId }, { token }) => {
      const { user } = await getAuthUser(token);

      await ChatBlock.destroy({
        where: { blockerId: String(user.id), blockedId: String(userId) },
      });

      return true;
    },

    reportMessage: async (_, { messageId, reason }, { token }) => {
      const { user } = await getAuthUser(token);

      const msg = await Message.findByPk(messageId);
      if (!msg) throw new Error("Message not found");

      msg.isFlagged = true;
      msg.flagReason = reason;
      msg.flaggedById = String(user.id);
      await msg.save();

      return true;
    },

    reportUser: async (_, { userId, reason }, { token }) => {
      const { user } = await getAuthUser(token);
      await ReportedUser.create({
        userId: String(userId),
        reporterId: String(user.id),
        reason,
      });
      return true;
    },

    agreeToChatRules: async (_, __, { token }) => {
      if (!token) throw new Error("Not authenticated");
      const payload = verifyJwt(token);

      const userId = String(payload.id);

      const existing = await ChatAgreement.findOne({ where: { userId } });
      if (existing) return true;

      await ChatAgreement.create({ userId, agreedAt: new Date() });
      return true;
    },

    adminDeleteMessage: async (_, { id }, { token }) => {
      const admin = requireAdmin(token);

      await Message.destroy({ where: { id } });

      await AdminAction.create({
        adminId: String(admin.id),
        targetUserId: null,
        actionType: "delete_message",
        details: { id },
      });

      return true;
    },

    adminBanUserFromChat: async (_, { userId, reason }, { token }) => {
      const admin = requireAdmin(token);

      const u = await User.findByPk(String(userId));
      if (!u) throw new Error("User not found");

      u.chatBanned = true;
      await u.save();

      await AdminAction.create({
        adminId: String(admin.id),
        targetUserId: String(userId),
        actionType: "chat_ban",
        reason,
      });

      return true;
    },

    adminUnbanUserFromChat: async (_, { userId }, { token }) => {
      const admin = requireAdmin(token);

      const u = await User.findByPk(String(userId));
      if (!u) throw new Error("User not found");

      u.chatBanned = false;
      await u.save();

      await AdminAction.create({
        adminId: String(admin.id),
        targetUserId: String(userId),
        actionType: "chat_unban",
      });

      return true;
    },

    adminClearUserReport: async (_, { userId }, { token }) => {
      requireAdmin(token);
      await ReportedUser.update(
        { isCleared: true },
        { where: { userId: String(userId) } }
      );
      return true;
    },

    adminSendSystemMessage: async (_, { content, meta }, { token, io }) => {
      const admin = requireAdmin(token);

      const cleanContent = typeof content === "string" ? content.trim() : "";
      if (!cleanContent) throw new Error("Message content is required");

      const users = await User.findAll({ where: { isBanned: false } });

      for (const u of users) {
        if (String(u.id) === String(admin.id)) continue;
        if (u.chatBanned) continue;

        const msg = await Message.create({
          senderId: String(admin.id),
          receiverId: String(u.id),
          content: cleanContent,
          meta: meta ?? null,
          isSystemMessage: true,
        });

        await notifyUser({
          userId: String(u.id),
          type: "system",
          title: "System Message",
          body: safeSnippet(cleanContent, 120),
          meta: { adminId: String(admin.id), messageId: msg.id },
        });

        io?.to(String(u.id)).emit("newMessage", {
          from: String(admin.id),
          system: true,
          messageId: msg.id,
        });
      }

      return true;
    },
  },

  ChatBlock: {
    blocker: (b) => User.findByPk(String(b.blockerId)),
    blocked: (b) => User.findByPk(String(b.blockedId)),
  },

  Message: {
    sender: (msg) => User.findByPk(String(msg.senderId)),
    receiver: (msg) => User.findByPk(String(msg.receiverId)),
    flaggedBy: (msg) => (msg.flaggedById ? User.findByPk(String(msg.flaggedById)) : null),
  },
};

export default resolvers;
