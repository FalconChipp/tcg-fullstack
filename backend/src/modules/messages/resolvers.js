// backend/src/modules/messages/resolvers.js
//
// UPDATED (2026-02-16)
//
// CHANGES (this revision):
// - ADD: Remote push send on new message (Expo) via push module
// - ADD: Remote push send on admin system message (optional, mirrors in-app notify)
// - KEEP: Existing mute logic (no push if receiver muted the sender)
// - KEEP: Existing socket + in-app notify behavior
//
// NOTE:
// - This assumes you created: src/modules/push/service.js exporting `sendPushToUserAsync(...)`
// - This sends payload: { type: "dm", userId: "<SENDER_ID>" } so the app can route to /messages/[userId]

import { Op } from "sequelize";
import {
  Message,
  User,
  Profile,
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

import { sendPushToUserAsync } from "../push/push.service.js";

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

/* =============================================================================
   ✅ User ID resolution (public id -> PK)
============================================================================= */

function userAttrs() {
  return User?.rawAttributes || {};
}

function pickFirstExistingKey(obj, keys) {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) return k;
  }
  return null;
}

/**
 * Detects which field (if any) your User model uses as a public identifier.
 * Adjust the priority list as needed.
 */
function getUserPublicIdKey() {
  const attrs = userAttrs();
  return pickFirstExistingKey(attrs, [
    "uuid",
    "publicId",
    "externalId",
    "userUuid",
    "uid",
    "authId",
    "clerkId",
    "firebaseUid",
  ]);
}

/**
 * Resolve any client-supplied id into the real DB PK (users.id).
 * - Accepts:
 *   - users.id (PK) (numeric or string)
 *   - users.<publicIdKey> (uuid/publicId/etc) if present
 */
async function resolveUserPkFromAnyId(inputId) {
  const raw = String(inputId || "").trim();
  if (!raw) {
    const err = new Error("user_id_required");
    err.code = "BAD_USER_INPUT";
    throw err;
  }

  const publicKey = getUserPublicIdKey();

  const isNumeric = /^\d+$/.test(raw);
  const or = [];

  if (isNumeric) or.push({ id: Number(raw) });
  or.push({ id: raw });

  if (publicKey) or.push({ [publicKey]: raw });

  const u = await User.findOne({
    where: { [Op.or]: or },
    attributes: ["id", ...(publicKey ? [publicKey] : []), "username"],
  });

  if (!u) {
    const err = new Error("user_not_found");
    err.code = "USER_NOT_FOUND";
    throw err;
  }

  return u.id;
}

/**
 * Convert a DB PK -> the "public" id value (if your model has one).
 * If you don't have a public id column, this falls back to PK.
 */
function userPkToPublicId(userModelOrRow) {
  const publicKey = getUserPublicIdKey();
  if (!publicKey) return String(userModelOrRow?.id ?? "");
  const v = userModelOrRow?.[publicKey];
  return String(v ?? userModelOrRow?.id ?? "");
}

/* =============================================================================
   ✅ Avatar normalization for chat
============================================================================= */

/**
 * ✅ NEW:
 * Your avatars are stored in profiles.avatar (e.g. "/uploads/avatars/...png")
 * but myChats returns `user { avatar }` (User.avatar).
 *
 * This helper ensures user.avatar is populated from Profile.avatar if missing.
 */
function normalizeUserAvatarFromProfile(userInstanceOrPlain) {
  if (!userInstanceOrPlain) return userInstanceOrPlain;

  // If it's a Sequelize instance, convert to a plain object so we can safely override fields
  const u =
    typeof userInstanceOrPlain.toJSON === "function"
      ? userInstanceOrPlain.toJSON()
      : { ...userInstanceOrPlain };

  const profileAvatar =
    u?.Profile?.avatar ??
    u?.profile?.avatar ??
    userInstanceOrPlain?.Profile?.avatar ??
    userInstanceOrPlain?.profile?.avatar ??
    null;

  // Prefer User.avatar if present, otherwise fallback to Profile.avatar
  const resolvedAvatar = u?.avatar ?? profileAvatar ?? null;

  return {
    ...u,
    avatar: resolvedAvatar,
  };
}

/**
 * ✅ NEW:
 * Per-request cache to avoid repeated user lookups for Message fields.
 * Now includes Profile so avatar works in threads too.
 */
function getUserCache(ctx) {
  if (!ctx) return null;
  if (!ctx.__userByPkCache) ctx.__userByPkCache = new Map();
  return ctx.__userByPkCache;
}

async function findUserByPkCached(ctx, pk) {
  const cache = getUserCache(ctx);
  const key = String(pk);
  if (cache && cache.has(key)) return cache.get(key);

  // ✅ CHANGED: include Profile so we can fallback to Profile.avatar
  const u = await User.findByPk(pk, {
    include: [{ model: Profile, required: false }],
  });

  const normalized = u ? normalizeUserAvatarFromProfile(u) : null;

  if (cache) cache.set(key, normalized);
  return normalized;
}

/* =============================================================================
   Auth helpers
============================================================================= */

async function requireUserFromContext(ctx) {
  if (!ctx?.user?.id) throw new Error("Not authenticated");
  const u = await User.findByPk(ctx.user.id);
  if (!u) throw new Error("User not found");
  return u;
}

async function enforceMessagingAccess(ctx) {
  if (ctx?.token) {
    await requireChatAgreement(ctx.token);
    await requireNotChatBanned(ctx.token);
  }

  const userModel = await requireUserFromContext(ctx);
  requireCanMessage(userModel);

  return userModel;
}

async function assertNotBlocked(mePk, otherPk) {
  const row = await ChatBlock.findOne({
    where: {
      [Op.or]: [
        { blockerId: mePk, blockedId: otherPk },
        { blockerId: otherPk, blockedId: mePk },
      ],
    },
  });

  if (row) {
    const err = new Error("Chat access denied");
    err.code = "CHAT_BLOCKED";
    throw err;
  }
}

async function isMuted(viewerPk, otherPk) {
  const row = await ChatMute.findOne({
    where: { userId: viewerPk, otherUserId: otherPk },
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

function attachReportDetails(existingMeta, details, extra = {}) {
  const base = existingMeta && typeof existingMeta === "object" ? existingMeta : {};
  return {
    ...base,
    ...extra,
    reportDetails: details || null,
  };
}

function adminActionAttrs() {
  return AdminAction?.rawAttributes || {};
}

function buildAdminActionPayload({ adminId, targetUserId, actionType, reason }) {
  const attrs = adminActionAttrs();

  const adminKey = pickFirstExistingKey(attrs, ["adminId", "adminUserId", "performedById"]);
  const targetKey = pickFirstExistingKey(attrs, ["userId", "targetUserId", "subjectUserId"]);
  const typeKey = pickFirstExistingKey(attrs, ["actionType", "type"]);
  const reasonKey = pickFirstExistingKey(attrs, ["reason", "note", "details"]);

  const payload = {};

  if (!adminKey) throw new Error("AdminAction model missing adminId/adminUserId field");
  if (!typeKey) throw new Error("AdminAction model missing actionType/type field");

  payload[adminKey] = adminId;
  payload[typeKey] = actionType;

  if (targetKey) payload[targetKey] = targetUserId;

  if (reasonKey) {
    const r = String(reason || "").trim();
    payload[reasonKey] = r ? r.slice(0, 500) : null;
  }

  return payload;
}

function buildAdminActionWhere({ targetUserId, actionType }) {
  const attrs = adminActionAttrs();

  const targetKey = pickFirstExistingKey(attrs, ["userId", "targetUserId", "subjectUserId"]);
  const typeKey = pickFirstExistingKey(attrs, ["actionType", "type"]);

  if (!typeKey) throw new Error("AdminAction model missing actionType/type field");

  const where = {};
  where[typeKey] = actionType;

  if (targetKey) where[targetKey] = targetUserId;

  return where;
}

export default {
  Query: {
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

      const byOther = new Map();

      for (const msg of rows) {
        if (!visibleToMe(me.id, msg)) continue;

        const senderId = String(getSenderId(msg) || "");
        const receiverId = String(getReceiverId(msg) || "");
        if (!senderId || !receiverId) continue;

        const otherPk = senderId === String(me.id) ? receiverId : senderId;
        if (!otherPk) continue;

        if (!byOther.has(otherPk)) {
          byOther.set(otherPk, { lastMessage: msg, unreadCount: 0 });
        }

        const isToMe = receiverId === String(me.id);
        const isUnread = !getBool(msg, "isRead", "is_read", false);
        const deletedByReceiver = getBool(msg, "deletedByReceiver", "deleted_by_receiver", false);

        if (isToMe && isUnread && !deletedByReceiver) {
          const t = byOther.get(otherPk);
          t.unreadCount += 1;
        }
      }

      const allOtherPks = Array.from(byOther.keys());
      const start = (p - 1) * limit;
      const end = start + limit;
      const pageOtherPks = allOtherPks.slice(start, end);

      if (!pageOtherPks.length) return [];

      // ✅ CHANGED: include Profile so we can use profiles.avatar
      const users = await User.findAll({
        where: { id: { [Op.in]: pageOtherPks } },
        include: [{ model: Profile, required: false }],
      });

      const userMap = new Map(users.map((u) => [String(u.id), u]));

      const out = [];
      for (const otherPk of pageOtherPks) {
        const otherUser = userMap.get(String(otherPk));
        if (!otherUser) continue;

        const t = byOther.get(otherPk);

        // ✅ CHANGED: normalize avatar from Profile.avatar when User.avatar is null
        const normalizedUser = normalizeUserAvatarFromProfile(otherUser);

        out.push({
          user: normalizedUser,
          lastMessage: t?.lastMessage || null,
          unreadCount: Number(t?.unreadCount || 0),
        });
      }

      return out;
    },

    chatWithUser: async (_, { userId, page, pageSize }, ctx) => {
      const me = await enforceMessagingAccess(ctx);

      const otherPk = await resolveUserPkFromAnyId(userId);

      await assertNotBlocked(String(me.id), String(otherPk));

      const p = clampPage(page);
      const limit = clampPageSize(pageSize);
      const offset = (p - 1) * limit;

      const msgs = await Message.findAll({
        where: {
          [Op.or]: [
            { senderId: me.id, receiverId: otherPk },
            { senderId: otherPk, receiverId: me.id },
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
      await requireAdmin(ctx.token);

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
      await requireAdmin(ctx.token);

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
      await requireAdmin(ctx.token);

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
      await requireAdmin(ctx.token);

      const p = clampPage(page);
      const limit = clampPageSize(pageSize);
      const offset = (p - 1) * limit;

      const where = {};
      if (filter?.userId) where.userId = String(filter.userId);
      if (filter?.reporterId) where.reporterId = String(filter.reporterId);
      if (filter?.isCleared != null) where.isCleared = !!filter.isCleared;

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

      const otherPk = await resolveUserPkFromAnyId(receiverId);

      if (String(otherPk) === String(me.id)) throw new Error("cannot_message_self");

      await assertNotBlocked(String(me.id), String(otherPk));

      const clean = String(content || "").trim();
      if (!clean) throw new Error("message_body_required");
      if (clean.length > 2000) throw new Error("message_too_long");

      const msg = await Message.create({
        senderId: me.id,
        receiverId: otherPk,
        content: clean,
        meta: meta ?? null,

        isRead: false,
        deletedBySender: false,
        deletedByReceiver: false,
        isFlagged: false,
        isSystemMessage: false,
      });

      try {
        await maybeGrantAchievement(me.id, "first_message");
      } catch {}

      // ✅ CHANGED: If not muted, send BOTH in-app notification + remote push
      try {
        const muted = await isMuted(String(otherPk), String(me.id));
        if (!muted) {
          // In-app notification (your existing system)
          await notifyUser({
            userId: String(otherPk),
            type: "chat_message",
            title: "New Message",
            body: `New message from ${me.username || "a user"}`,
            linkUrl: "/messages",
          });

          // ✅ ADD: Remote push notification (Expo) — tap routes to /messages/[userId]
          await sendPushToUserAsync({
            userId: String(otherPk),
            title: "New Message",
            body: `${me.username || "Someone"}: ${clean.slice(0, 90)}`,
            data: { type: "dm", userId: String(me.id) },
          });
        }
      } catch {}

      try {
        if (ctx?.io) {
          ctx.io.to(String(otherPk)).emit("newMessage", { from: String(me.id) });
          ctx.io.to(`user:${String(otherPk)}`).emit("newMessage", { from: String(me.id) });
        }
      } catch {}

      return msg;
    },

    markChatRead: async (_, { userId }, ctx) => {
      const me = await enforceMessagingAccess(ctx);

      const otherPk = await resolveUserPkFromAnyId(userId);

      await Message.update(
        { isRead: true },
        {
          where: {
            senderId: otherPk,
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

      const otherPk = await resolveUserPkFromAnyId(userId);

      await Message.update(
        { deletedBySender: true },
        { where: { senderId: me.id, receiverId: otherPk } }
      );
      await Message.update(
        { deletedByReceiver: true },
        { where: { senderId: otherPk, receiverId: me.id } }
      );

      return true;
    },

    reportMessage: async (_, { messageId, reason, details }, ctx) => {
      const me = await requireUserFromContext(ctx);

      const id = String(messageId || "").trim();
      const r = String(reason || "").trim();
      const d = details != null ? String(details).trim() : "";

      if (!id) throw new Error("message_id_required");
      if (!r) throw new Error("reason_required");

      const msg = await Message.findByPk(id);
      if (!msg) throw new Error("message_not_found");
      if (!visibleToMe(me.id, msg)) throw new Error("not_allowed");

      msg.isFlagged = true;
      msg.flagReason = r.slice(0, 500);
      msg.flaggedById = me.id;

      msg.meta = attachReportDetails(msg.meta, d || null, {
        reportedAt: new Date().toISOString(),
        reportMode: "MESSAGE",
      });

      await msg.save();
      return true;
    },

    reportUser: async (_, { userId, reason, details }, ctx) => {
      const me = await requireUserFromContext(ctx);

      const otherPk = await resolveUserPkFromAnyId(userId);

      const r = String(reason || "").trim();
      const d = details != null ? String(details).trim() : "";

      if (!r) throw new Error("reason_required");

      await ReportedUser.create({
        userId: otherPk,
        reporterId: me.id,
        reason: r.slice(0, 255),
        details: d ? d.slice(0, 4000) : null,
        isCleared: false,
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
      await requireAdmin(ctx.token);
      const msgId = String(id || "").trim();
      if (!msgId) throw new Error("message_id_required");
      await Message.destroy({ where: { id: msgId } });
      return true;
    },

    adminBanUserFromChat: async (_, { userId, reason }, ctx) => {
      await requireAdmin(ctx.token);

      const admin = await requireUserFromContext(ctx);

      const targetPk = await resolveUserPkFromAnyId(userId);

      const payload = buildAdminActionPayload({
        adminId: admin.id,
        targetUserId: String(targetPk),
        actionType: "CHAT_BAN",
        reason: String(reason || "").trim(),
      });

      await AdminAction.create(payload);
      return true;
    },

    adminUnbanUserFromChat: async (_, { userId }, ctx) => {
      await requireAdmin(ctx.token);

      const targetPk = await resolveUserPkFromAnyId(userId);

      const where = buildAdminActionWhere({
        targetUserId: String(targetPk),
        actionType: "CHAT_BAN",
      });

      await AdminAction.destroy({ where });
      return true;
    },

    adminClearUserReport: async (_, { userId }, ctx) => {
      await requireAdmin(ctx.token);

      const targetPk = await resolveUserPkFromAnyId(userId);

      await ReportedUser.update(
        { isCleared: true },
        { where: { userId: String(targetPk), isCleared: false } }
      );

      return true;
    },

    adminSendSystemMessage: async (_, { receiverId, content, meta }, ctx) => {
      await requireAdmin(ctx.token);

      const me = await requireUserFromContext(ctx);

      const otherPk = await resolveUserPkFromAnyId(receiverId);

      const clean = String(content || "").trim();
      if (!clean) throw new Error("content_required");

      await Message.create({
        senderId: me.id,
        receiverId: otherPk,
        content: clean,
        meta: meta ?? null,

        isRead: false,
        deletedBySender: false,
        deletedByReceiver: false,
        isFlagged: false,
        isSystemMessage: true,
      });

      // ✅ CHANGED: Send in-app + remote push (system messages usually should still notify)
      try {
        await notifyUser({
          userId: String(otherPk),
          type: "system_message",
          title: "System Message",
          body: clean.slice(0, 120),
          linkUrl: "/messages",
        });

        // ✅ ADD: Remote push for system message
        await sendPushToUserAsync({
          userId: String(otherPk),
          title: "System Message",
          body: clean.slice(0, 140),
          data: { type: "dm", userId: String(me.id) },
        });
      } catch {}

      try {
        if (ctx?.io) {
          ctx.io.to(String(otherPk)).emit("newMessage", { from: String(me.id) });
          ctx.io.to(`user:${String(otherPk)}`).emit("newMessage", { from: String(me.id) });
        }
      } catch {}

      return true;
    },

    muteConversation: async (_, { userId, mutedUntil }, ctx) => {
      const me = await requireUserFromContext(ctx);

      const otherPk = await resolveUserPkFromAnyId(userId);

      if (String(otherPk) === String(me.id)) throw new Error("cannot_mute_self");

      const until = mutedUntil ? new Date(mutedUntil) : null;

      await ChatMute.findOrCreate({
        where: { userId: me.id, otherUserId: otherPk },
        defaults: { userId: me.id, otherUserId: otherPk, mutedUntil: until },
      });

      if (until) {
        await ChatMute.update(
          { mutedUntil: until },
          { where: { userId: me.id, otherUserId: otherPk } }
        );
      }

      return true;
    },

    unmuteConversation: async (_, { userId }, ctx) => {
      const me = await requireUserFromContext(ctx);

      const otherPk = await resolveUserPkFromAnyId(userId);

      await ChatMute.destroy({ where: { userId: me.id, otherUserId: otherPk } });
      return true;
    },

    blockUserFromChat: async (_, { userId, reason }, ctx) => {
      const me = await requireUserFromContext(ctx);

      const otherPk = await resolveUserPkFromAnyId(userId);

      if (String(otherPk) === String(me.id)) throw new Error("cannot_block_self");

      await ChatBlock.findOrCreate({
        where: { blockerId: me.id, blockedId: otherPk },
        defaults: {
          blockerId: me.id,
          blockedId: otherPk,
          reason: String(reason || "").trim().slice(0, 500) || null,
        },
      });

      return true;
    },

    unblockUserFromChat: async (_, { userId }, ctx) => {
      const me = await requireUserFromContext(ctx);

      const otherPk = await resolveUserPkFromAnyId(userId);

      await ChatBlock.destroy({ where: { blockerId: me.id, blockedId: otherPk } });
      return true;
    },
  },

  Message: {
    id: (m) => m?.id,

    // Sender/receiver IDs stored in Message are PKs, return "public id" if you have one
    senderId: async (m, _args, ctx) => {
      const pk = getSenderId(m);
      if (!pk) return "";
      const u = await findUserByPkCached(ctx, pk);
      return u ? userPkToPublicId(u) : String(pk);
    },
    receiverId: async (m, _args, ctx) => {
      const pk = getReceiverId(m);
      if (!pk) return "";
      const u = await findUserByPkCached(ctx, pk);
      return u ? userPkToPublicId(u) : String(pk);
    },

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

    // ✅ CHANGED: include Profile + normalize avatar
    sender: async (m) => {
      const id = getSenderId(m);
      if (!id) return null;
      const u = await User.findByPk(id, { include: [{ model: Profile, required: false }] });
      return u ? normalizeUserAvatarFromProfile(u) : null;
    },
    receiver: async (m) => {
      const id = getReceiverId(m);
      if (!id) return null;
      const u = await User.findByPk(id, { include: [{ model: Profile, required: false }] });
      return u ? normalizeUserAvatarFromProfile(u) : null;
    },
    flaggedBy: async (m) => {
      const id = m?.flaggedById ?? m?.flagged_by_id;
      if (!id) return null;
      const u = await User.findByPk(id, { include: [{ model: Profile, required: false }] });
      return u ? normalizeUserAvatarFromProfile(u) : null;
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
