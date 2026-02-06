// backend/src/modules/messages/helpers.js
//
// UPDATED (2026-02-06):
// - FIX: verifyJwt may be SYNC -> never call .catch on it
// - ADD: verifyJwtSafe() supports sync OR async verifyJwt implementations
// - FIX: Throw GraphQLError with stable extension codes (not INTERNAL_SERVER_ERROR)
// - FIX: Robust token extraction from ctx (ctx.token, ctx.req headers, ctx.request headers)
// - FIX: AdminAction ban lookup no longer assumes "userId" column
//        -> auto-detects relevant column names using AdminAction.rawAttributes
// - KEEP: CHAT_RULES constant
//
// NOTE:
// - This file intentionally avoids hardcoding AdminAction column names.
// - If AdminAction doesn't support chat bans at all, isChatBanned() will safely return false.

import { GraphQLError } from "graphql";
import { ChatAgreement, AdminAction } from "../../models/index.js";
import { verifyJwt } from "../auth/helpers.js";

export const CHAT_RULES = `
Be respectful.
No harassment, hate speech, or threats.
No sharing personal info.
No scams/spam.
Report abusive behaviour.
`.trim();

/* =========================================================
   Error helpers
========================================================= */

function throwGql(code, message, extra = {}) {
  throw new GraphQLError(message, {
    extensions: {
      code,
      ...extra,
    },
  });
}

/* =========================================================
   Token helpers
========================================================= */

export function getTokenFromContext(ctx) {
  const direct = ctx?.token;
  if (direct) return stripBearer(direct);

  const authHeader =
    ctx?.req?.headers?.authorization ||
    ctx?.request?.headers?.get?.("authorization") ||
    ctx?.headers?.authorization;

  if (!authHeader) return null;
  return stripBearer(authHeader);
}

function stripBearer(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  if (s.toLowerCase().startsWith("bearer ")) return s.slice(7).trim();
  return s;
}

/**
 * Supports verifyJwt implemented as sync OR async
 */
async function verifyJwtSafe(token) {
  try {
    const out = verifyJwt(token);
    return await Promise.resolve(out);
  } catch {
    return null;
  }
}

export async function requireAuthedUserId(ctx) {
  const token = getTokenFromContext(ctx);
  if (!token) throwGql("NOT_AUTHENTICATED", "Not authenticated");

  const payload = await verifyJwtSafe(token);
  const userId = payload?.userId || payload?.id || payload?.sub || null;

  if (!userId) throwGql("NOT_AUTHENTICATED", "Not authenticated");
  return { userId, token, payload };
}

/* =========================================================
   Agreement + ban enforcement
========================================================= */

export async function requireChatAgreement(ctxOrToken) {
  const token =
    typeof ctxOrToken === "string"
      ? stripBearer(ctxOrToken)
      : getTokenFromContext(ctxOrToken);

  if (!token) throwGql("CHAT_AGREEMENT_REQUIRED", "Chat agreement required");

  const payload = await verifyJwtSafe(token);
  const userId = payload?.userId || payload?.id || payload?.sub || null;
  if (!userId) throwGql("CHAT_AGREEMENT_REQUIRED", "Chat agreement required");

  const row = await ChatAgreement.findOne({ where: { userId } });
  if (!row) throwGql("CHAT_AGREEMENT_REQUIRED", "Chat agreement required");

  return { userId };
}

/* =========================================================
   ✅ AdminAction column detection helpers
========================================================= */

function pickAttr(model, candidates) {
  const attrs = model?.rawAttributes || {};
  for (const name of candidates) {
    if (attrs[name]) return name;
  }
  return null;
}

function buildAdminActionWhereForChatBan(userId) {
  // Common patterns across codebases:
  const userField = pickAttr(AdminAction, [
    "userId",
    "user_id",
    "targetUserId",
    "target_user_id",
    "affectedUserId",
    "affected_user_id",
    "subjectUserId",
    "subject_user_id",
  ]);

  // The “action” column also varies a lot:
  const actionField = pickAttr(AdminAction, [
    "action",
    "type",
    "kind",
    "event",
    "name",
  ]);

  // If we can't find a user column, we can't enforce bans from this table.
  // (We fail open so chat doesn't crash your app.)
  if (!userField) return null;

  const where = { [userField]: userId };

  // If there is no action/type column, we can only treat “any record” as a ban,
  // which is dangerous. So we also fail open here.
  if (!actionField) return null;

  // Support multiple possible ban values (keep your existing one first)
  where[actionField] = ["chat_ban", "CHAT_BAN", "ban_chat", "CHAT_DENY"];

  return { where, userField, actionField };
}

async function isChatBanned(userId) {
  const built = buildAdminActionWhereForChatBan(userId);
  if (!built) return false;

  // Order column varies:
  const orderField = pickAttr(AdminAction, [
    "createdAt",
    "created_at",
    "timestamp",
    "created",
    "updatedAt",
    "updated_at",
  ]);

  const query = {
    where: built.where,
    limit: 1,
  };

  if (orderField) query.order = [[orderField, "DESC"]];

  try {
    const ban = await AdminAction.findOne(query);
    return !!ban;
  } catch (e) {
    // If schema mismatch, never take chat down.
    // Fail open and log.
    console.warn("[chat] AdminAction ban check failed (fail-open):", e?.message || e);
    return false;
  }
}

export async function requireNotChatBanned(ctxOrToken) {
  const token =
    typeof ctxOrToken === "string"
      ? stripBearer(ctxOrToken)
      : getTokenFromContext(ctxOrToken);

  if (!token) throwGql("NOT_AUTHENTICATED", "Not authenticated");

  const payload = await verifyJwtSafe(token);
  const userId = payload?.userId || payload?.id || payload?.sub || null;
  if (!userId) throwGql("NOT_AUTHENTICATED", "Not authenticated");

  const banned = await isChatBanned(userId);
  if (banned) {
    throwGql("CHAT_BANNED", "Chat access denied");
  }

  return { userId };
}

/* =========================================================
   Admin guard
========================================================= */

export async function requireAdmin(tokenOrCtx) {
  const token =
    typeof tokenOrCtx === "string"
      ? stripBearer(tokenOrCtx)
      : getTokenFromContext(tokenOrCtx);

  if (!token) throwGql("FORBIDDEN", "Admin only");

  const payload = await verifyJwtSafe(token);
  const isAdmin = !!(payload?.isAdmin || payload?.role === "admin");

  if (!isAdmin) throwGql("FORBIDDEN", "Admin only");
  return true;
}
