// backend/src/modules/messages/resolvers.js
//
// UPDATED (2026-02-06):
// - FIX: Align resolvers to your actual schema (myChats/chatWithUser/sendMessage/etc).
// - FIX: HARD enforcement of messaging restrictions server-side:
//        requireChatAgreement + requireNotChatBanned + requireCanMessage
// - RESTORE: chat agreement queries/mutation, admin actions.
// - FIX (CRITICAL): Add Message field resolvers that coerce NULL -> safe defaults
//        for GraphQL non-null fields (Boolean! etc). This prevents myChats/chatWithUser
//        from failing and returning an empty UI when legacy DB rows contain NULLs.
// - FIX: Normalize sender/receiver/content mapping so both camelCase + snake_case DB
//        shapes work during migrations.
// - KEEP: block/mute/report flows mapped to your schema names.
//

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

import {
  CHAT_RULES,
  requireAdmin,
  requireChatAgreement,
  requireNotChatBanned,
} from "./helpers.js";

import { maybeGrantAchievement } from "../achievements/helpers.js";
import { notifyUser } from "../../utils/notifications.js";
import { requireCanMessage } from "../safety/capabilities.js";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function clampPageSize(n) {
  const v = Number(n || DEFAULT_PAGE_SIZE);
  return Math.max(1, Math.min(MAX_PAGE_SIZE, v));
}
function clampPage(n) {
  const v = Number(n || 1);
  return Math.max(1, v);
}

// -----------------------------
// Normalizers (camelCase <-> snake_case)
// -----------------------------
function getSenderId(row) {
  return row?.senderId ?? row?.sender_id ?? null;
}
function getReceiverId(row) {
  return row?.receiverId ?? row?.receiver_id ?? row?.recipient_id ?? null;
}
function getContent(row) {
  return row?.content ?? row?.body ?? null;
}
function getBool(row, camel, snake, fallback = false) {
  const v = row?.[camel] ?? row?.[snake];
  if (v === null || v === undefined) return fallback;
  return !!v;
}
function getMaybeString(row, camel, snake) {
  const v = row?.[camel] ?? row?.[snake];
  if (v === null || v === undefined) return null;
  const s = String(v);
  return s.length ? s : null;
}
function toISO(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function requireUserFromContext(ctx) {
  if (!ctx?.user?.id) throw new Error("Not authenticated");
  const u = await User.findByPk(ctx.user.id);
  if (!u) throw new Error("User not found");
  return u;
}

async function enforceMessagingAccess(ctx) {
  // ✅ Restore chat agreement + ban enforcement
  if (ctx?.token) {
    await requireChatAgreement(ctx.token);
    await requireNotChatBanned(ctx.token);
  }

  // ✅ Safety enforcement (full/child/teen w/out parent)
  const userModel = await requireUserFromContext(ctx);
  requireCanMessage(userModel);

  return userModel;
}

async function assertNotBlocked(meId, otherId) {
  const row = await ChatBlock.findOne({
    where: {
      [Op.or]: [
        { blockerId: meId, blockedId: otherId },
        { blockerId: otherId, blockedId: meId },
      ],
    },
  });

  if (row) {
    const err = new Error("Chat access denied");
    err.code = "CHAT_BLOCKED";
    throw err;
  }
}

async function isMuted(viewerId, otherUserId) {
  const row = await ChatMute.findOne({
    where: { userId: viewerId, otherUserId },
  });
  return !!row;
}

function visibleToMe(meId, msg) {
  if (!msg) return false;

  const senderId = String(getSenderId(msg) || "");
  const receiverId = String(getReceiverId(msg) || "");

  const deletedBySender = getBool(msg, "deletedBySender", "deleted_by_sender", false);
  const deletedByReceiver = getBool(msg, "deletedByReceiver", "deleted_by_receiver", false);

  if (senderId && senderId === String(meId) && deletedBySender) return false;
  if (receiverId && receiverId === String(meId) && deletedByReceiver) return false;

  return true;
}

export default {
  Query: {
    // myChats(page, pageSize): [ChatSummary!]!
    myChats: async (_, { page, pageSize }, ctx) => {
      const me = await enforceMessagingAccess(ctx);

      const p = clampPage(page);
      const limit = clampPageSize(pageSize);

      const rows = await Message.findAll({
        where: {
          [Op.or]: [{ senderId: me.id }, { receiverId: me.id }],
        },
        order: [["createdAt", "DESC"]],
        limit: 5000,
      });

      // Group by "other user" thread
      const byOther = new Map(); // otherId -> { lastMessage, unreadCount }

      for (const msg of rows) {
        if (!visibleToMe(me.id, msg)) continue;

        const senderId = String(getSenderId(msg) || "");
        const receiverId = String(getReceiverId(msg) || "");
        if (!senderId || !receiverId) continue;

        const otherId = senderId === String(me.id) ? receiverId : senderId;
        if (!otherId) continue;

        if (!byOther.has(otherId)) {
          byOther.set(otherId, { lastMessage: msg, unreadCount: 0 });
        }

        const isToMe = receiverId === String(me.id);
        const isUnread = !getBool(msg, "isRead", "is_read", false);

        const deletedByReceiver = getBool(msg, "deletedByReceiver", "deleted_by_receiver", false);

        if (isToMe && isUnread && !deletedByReceiver) {
          const t = byOther.get(otherId);
          t.unreadCount += 1;
        }
      }

      const allOtherIds = Array.from(byOther.keys());

      // paginate threads
      const start = (p - 1) * limit;
      const end = start + limit;
      const pageOtherIds = allOtherIds.slice(start, end);

      if (!pageOtherIds.length) return [];

      const users = await User.findAll({
        where: { id: { [Op.in]: pageOtherIds } },
      });
      const userMap = new Map(users.map((u) => [String(u.id), u]));

      // IMPORTANT: ChatSummary.user is NON-NULL in your schema.
      // If we can't load the other user for any reason, skip that thread
      // rather than returning null and nuking the whole GraphQL response.
      const out = [];
      for (const otherId of pageOtherIds) {
        const otherUser = userMap.get(String(otherId));
        if (!otherUser) continue;

        const t = byOther.get(otherId);
        out.push({
          user: otherUser,
          lastMessage: t?.lastMessage || null,
          unreadCount: Number(t?.unreadCount || 0),
        });
      }

      return out;
    },

    // chatWithUser(userId, page, pageSize): [Message!]!
    chatWithUser: async (_, { userId, page, pageSize }, ctx) => {
      const me = await enforceMessagingAccess(ctx);
      const otherId = String(userId || "").trim();
      if (!otherId) throw new Error("user_id_required");

      await assertNotBlocked(String(me.id), otherId);

      const p = clampPage(page);
      const limit = clampPageSize(pageSize);
      const offset = (p - 1) * limit;

      const msgs = await Message.findAll({
        where: {
          [Op.or]: [
            { senderId: me.id, receiverId: otherId },
            { senderId: otherId, receiverId: me.id },
          ],
        },
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });

      return msgs.filter((m) => visibleToMe(me.id, m));
    },

    unreadCount: async (_, __, ctx) => {
      const me = await enforceMessagingAccess(ctx);
      const count = await Message.count({
        where: {
          receiverId: me.id,
          isRead: false,
          deletedByReceiver: false,
        },
      });
      return Number(count || 0);
    },

    hasAgreedToChatRules: async (_, __, ctx) => {
      if (!ctx?.user?.id) return false;
      const row = await ChatAgreement.findOne({ where: { userId: ctx.user.id } });
      return !!row;
    },

    chatRulesText: async () => CHAT_RULES,

    myMutedConversations: async (_, __, ctx) => {
      const me = await requireUserFromContext(ctx);
      return ChatMute.findAll({
        where: { userId: me.id },
        order: [["createdAt", "DESC"]],
      });
    },

    myBlockedUsers: async (_, __, ctx) => {
      const me = await requireUserFromContext(ctx);
      return ChatBlock.findAll({
        where: { blockerId: me.id },
        order: [["createdAt", "DESC"]],
      });
    },

    adminQueryChatBlocks: async (_, { page, pageSize, filter }, ctx) => {
      requireAdmin(ctx.token);

      const p = clampPage(page);
      const limit = clampPageSize(pageSize);
      const offset = (p - 1) * limit;

      const where = {};
      if (filter?.blockerId) where.blockerId = String(filter.blockerId);
      if (filter?.blockedId) where.blockedId = String(filter.blockedId);

      return ChatBlock.findAll({
        where,
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });
    },

    adminQueryMessages: async (_, { filter, page, pageSize }, ctx) => {
      requireAdmin(ctx.token);

      const p = clampPage(page);
      const limit = clampPageSize(pageSize);
      const offset = (p - 1) * limit;

      const where = {};
      if (filter?.senderId) where.senderId = String(filter.senderId);
      if (filter?.receiverId) where.receiverId = String(filter.receiverId);
      if (filter?.isFlagged != null) where.isFlagged = !!filter.isFlagged;

      return Message.findAll({
        where,
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });
    },

    adminQueryReportedMessages: async (_, { page, pageSize, filter }, ctx) => {
      requireAdmin(ctx.token);

      const p = clampPage(page);
      const limit = clampPageSize(pageSize);
      const offset = (p - 1) * limit;

      const where = { isFlagged: true };
      if (filter?.flagReason) where.flagReason = String(filter.flagReason);

      return Message.findAll({
        where,
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });
    },

    adminQueryReportedUsers: async (_, { page, pageSize, filter }, ctx) => {
      requireAdmin(ctx.token);

      const p = clampPage(page);
      const limit = clampPageSize(pageSize);
      const offset = (p - 1) * limit;

      const where = {};
      if (filter?.userId) where.userId = String(filter.userId);
      if (filter?.reporterId) where.reporterId = String(filter.reporterId);

      return ReportedUser.findAll({
        where,
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });
    },
  },

  Mutation: {
    sendMessage: async (_, { receiverId, content, meta }, ctx) => {
      const me = await enforceMessagingAccess(ctx);

      const otherId = String(receiverId || "").trim();
      if (!otherId) throw new Error("receiver_id_required");
      if (String(otherId) === String(me.id)) throw new Error("cannot_message_self");

      await assertNotBlocked(String(me.id), otherId);

      const clean = String(content || "").trim();
      if (!clean) throw new Error("message_body_required");
      if (clean.length > 2000) throw new Error("message_too_long");

      const msg = await Message.create({
        senderId: me.id,
        receiverId: otherId,
        content: clean,
        meta: meta ?? null,

        // ✅ ensure non-null fields (for schema)
        isRead: false,
        deletedBySender: false,
        deletedByReceiver: false,
        isFlagged: false,
        isSystemMessage: false,
      });

      try {
        await maybeGrantAchievement(me.id, "first_message");
      } catch {
        // ignore
      }

      try {
        const muted = await isMuted(String(otherId), String(me.id));
        if (!muted) {
          await notifyUser(otherId, {
            type: "chat_message",
            title: "New Message",
            body: `New message from ${me.username || "a user"}`,
            linkUrl: "/messages",
          });
        }
      } catch {
        // ignore
      }

      // keep frontend listener compatibility
      try {
        if (ctx?.io) {
          ctx.io.to(String(otherId)).emit("newMessage", { from: String(me.id) });
          ctx.io.to(`user:${String(otherId)}`).emit("newMessage", { from: String(me.id) });
        }
      } catch {
        // ignore
      }

      return msg;
    },

    markChatRead: async (_, { userId }, ctx) => {
      const me = await enforceMessagingAccess(ctx);
      const otherId = String(userId || "").trim();
      if (!otherId) throw new Error("user_id_required");

      await Message.update(
        { isRead: true },
        {
          where: {
            senderId: otherId,
            receiverId: me.id,
            isRead: false,
            deletedByReceiver: false,
          },
        }
      );

      return true;
    },

    deleteChat: async (_, { userId }, ctx) => {
      const me = await requireUserFromContext(ctx);
      const otherId = String(userId || "").trim();
      if (!otherId) throw new Error("user_id_required");

      await Message.update(
        { deletedBySender: true },
        { where: { senderId: me.id, receiverId: otherId } }
      );
      await Message.update(
        { deletedByReceiver: true },
        { where: { senderId: otherId, receiverId: me.id } }
      );

      return true;
    },

    reportMessage: async (_, { messageId, reason }, ctx) => {
      const me = await requireUserFromContext(ctx);

      const id = String(messageId || "").trim();
      const r = String(reason || "").trim();
      if (!id) throw new Error("message_id_required");
      if (!r) throw new Error("reason_required");

      const msg = await Message.findByPk(id);
      if (!msg) throw new Error("message_not_found");
      if (!visibleToMe(me.id, msg)) throw new Error("not_allowed");

      msg.isFlagged = true;
      msg.flagReason = r.slice(0, 500);
      msg.flaggedById = me.id;
      await msg.save();

      return true;
    },

    reportUser: async (_, { userId, reason }, ctx) => {
      const me = await requireUserFromContext(ctx);

      const otherId = String(userId || "").trim();
      const r = String(reason || "").trim();
      if (!otherId) throw new Error("user_id_required");
      if (!r) throw new Error("reason_required");

      await ReportedUser.create({
        userId: otherId,
        reporterId: me.id,
        reason: r.slice(0, 2000),
      });

      return true;
    },

    agreeToChatRules: async (_, __, ctx) => {
      const me = await requireUserFromContext(ctx);

      const [row] = await ChatAgreement.findOrCreate({
        where: { userId: me.id },
        defaults: { userId: me.id, agreedAt: new Date() },
      });

      if (!row.agreedAt) {
        row.agreedAt = new Date();
        await row.save();
      }

      return true;
    },

    adminDeleteMessage: async (_, { id }, ctx) => {
      requireAdmin(ctx.token);
      const msgId = String(id || "").trim();
      if (!msgId) throw new Error("message_id_required");
      await Message.destroy({ where: { id: msgId } });
      return true;
    },

    adminBanUserFromChat: async (_, { userId, reason }, ctx) => {
      requireAdmin(ctx.token);
      const targetId = String(userId || "").trim();
      if (!targetId) throw new Error("user_id_required");

      await AdminAction.create({
        userId: targetId,
        type: "CHAT_BAN",
        reason: String(reason || "").trim().slice(0, 500) || null,
        createdAt: new Date(),
      });

      return true;
    },

    adminUnbanUserFromChat: async (_, { userId }, ctx) => {
      requireAdmin(ctx.token);
      const targetId = String(userId || "").trim();
      if (!targetId) throw new Error("user_id_required");

      await AdminAction.destroy({
        where: { userId: targetId, type: "CHAT_BAN" },
      });

      return true;
    },

    adminClearUserReport: async (_, { userId }, ctx) => {
      requireAdmin(ctx.token);
      const targetId = String(userId || "").trim();
      if (!targetId) throw new Error("user_id_required");

      await ReportedUser.destroy({ where: { userId: targetId } });
      return true;
    },

    adminSendSystemMessage: async (_, { content, meta }, ctx) => {
      requireAdmin(ctx.token);

      const clean = String(content || "").trim();
      if (!clean) throw new Error("content_required");

      await Message.create({
        senderId: null,
        receiverId: null,
        content: clean,
        meta: meta ?? null,

        // satisfy schema defaults
        isRead: true,
        deletedBySender: false,
        deletedByReceiver: false,
        isFlagged: false,
        isSystemMessage: true,
      });

      return true;
    },

    muteConversation: async (_, { userId, mutedUntil }, ctx) => {
      const me = await requireUserFromContext(ctx);
      const otherId = String(userId || "").trim();
      if (!otherId) throw new Error("user_id_required");
      if (String(otherId) === String(me.id)) throw new Error("cannot_mute_self");

      const until = mutedUntil ? new Date(mutedUntil) : null;

      await ChatMute.findOrCreate({
        where: { userId: me.id, otherUserId: otherId },
        defaults: { userId: me.id, otherUserId: otherId, mutedUntil: until },
      });

      if (until) {
        await ChatMute.update(
          { mutedUntil: until },
          { where: { userId: me.id, otherUserId: otherId } }
        );
      }

      return true;
    },

    unmuteConversation: async (_, { userId }, ctx) => {
      const me = await requireUserFromContext(ctx);
      const otherId = String(userId || "").trim();
      if (!otherId) throw new Error("user_id_required");

      await ChatMute.destroy({ where: { userId: me.id, otherUserId: otherId } });
      return true;
    },

    blockUserFromChat: async (_, { userId, reason }, ctx) => {
      const me = await requireUserFromContext(ctx);
      const otherId = String(userId || "").trim();
      if (!otherId) throw new Error("user_id_required");
      if (String(otherId) === String(me.id)) throw new Error("cannot_block_self");

      await ChatBlock.findOrCreate({
        where: { blockerId: me.id, blockedId: otherId },
        defaults: {
          blockerId: me.id,
          blockedId: otherId,
          reason: String(reason || "").trim().slice(0, 500) || null,
        },
      });

      return true;
    },

    unblockUserFromChat: async (_, { userId }, ctx) => {
      const me = await requireUserFromContext(ctx);
      const otherId = String(userId || "").trim();
      if (!otherId) throw new Error("user_id_required");

      await ChatBlock.destroy({ where: { blockerId: me.id, blockedId: otherId } });
      return true;
    },
  },

  // =========================================================
  // CRITICAL: Message field resolvers to satisfy your schema
  // (prevents NULL Boolean! values from killing myChats/chatWithUser)
  // =========================================================
  Message: {
    id: (m) => m?.id,

    senderId: (m) => String(getSenderId(m) || ""),
    receiverId: (m) => String(getReceiverId(m) || ""),

    content: (m) => String(getContent(m) ?? ""),

    isRead: (m) => getBool(m, "isRead", "is_read", false),

    deletedBySender: (m) => getBool(m, "deletedBySender", "deleted_by_sender", false),
    deletedByReceiver: (m) => getBool(m, "deletedByReceiver", "deleted_by_receiver", false),

    meta: (m) => m?.meta ?? null,

    isFlagged: (m) => getBool(m, "isFlagged", "is_flagged", false),
    flagReason: (m) => getMaybeString(m, "flagReason", "flag_reason"),
    flaggedById: (m) => getMaybeString(m, "flaggedById", "flagged_by_id"),

    isSystemMessage: (m) => getBool(m, "isSystemMessage", "is_system_message", false),
    reminderSentAt: (m) => toISO(m?.reminderSentAt ?? m?.reminder_sent_at),

    createdAt: (m) => toISO(m?.createdAt ?? m?.created_at),
    updatedAt: (m) => toISO(m?.updatedAt ?? m?.updated_at),
    expiresAt: (m) => toISO(m?.expiresAt ?? m?.expires_at),

    sender: async (m) => {
      const id = getSenderId(m);
      return id ? User.findByPk(id) : null;
    },
    receiver: async (m) => {
      const id = getReceiverId(m);
      return id ? User.findByPk(id) : null;
    },
    flaggedBy: async (m) => {
      const id = m?.flaggedById ?? m?.flagged_by_id;
      return id ? User.findByPk(id) : null;
    },
  },

  ChatBlock: {
    blocker: async (row) => (row?.blockerId ? User.findByPk(row.blockerId) : null),
    blocked: async (row) => (row?.blockedId ? User.findByPk(row.blockedId) : null),
  },

  ReportedUser: {
    user: async (row) => (row?.userId ? User.findByPk(row.userId) : null),
    reporter: async (row) => (row?.reporterId ? User.findByPk(row.reporterId) : null),
  },
};
