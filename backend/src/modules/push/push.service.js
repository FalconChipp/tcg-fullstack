// src/modules/push/push.service.js
//
// UPDATED (2026-02-17)
//
// CHANGES:
// - KEEP: sendExpoPushAsync (token list sender, chunked)
// - ADD: sendPushToUserAsync({ userId, title, body, data })
//        - Pulls tokens from DB (user_push_tokens)
//        - Validates tokens
//        - Sends via Expo in chunks
// - ADD: optional token cleanup hook placeholder (if you later want to remove invalid tokens)

import { Expo } from "expo-server-sdk";
import { Op } from "sequelize";

// ✅ ADD: read tokens from your existing model export
import { UserPushToken } from "../../models/index.js";

const expo = new Expo();

export function isValidExpoToken(token) {
  return !!token && Expo.isExpoPushToken(token);
}

/**
 * Send a push to a list of Expo tokens
 *
 * @param {Object} args
 * @param {string[]} args.tokens
 * @param {string} args.title
 * @param {string} args.body
 * @param {Object} [args.data]
 */
export async function sendExpoPushAsync({ tokens, title, body, data = {} }) {
  const validTokens = (tokens || []).filter((t) => isValidExpoToken(t));

  if (!validTokens.length) {
    return { ok: false, error: "No valid Expo push tokens to send to." };
  }

  const messages = validTokens.map((to) => ({
    to,
    title,
    body,
    data,
    sound: "default",
  }));

  const chunks = expo.chunkPushNotifications(messages);

  try {
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e?.message || "Failed to send push" };
  }
}

/**
 * ✅ NEW: Send push notification to a specific user (DB lookup -> expo sender)
 *
 * @param {Object} args
 * @param {string} args.userId
 * @param {string} args.title
 * @param {string} args.body
 * @param {Object} [args.data]
 */
export async function sendPushToUserAsync({ userId, title, body, data = {} }) {
  const uid = String(userId || "").trim();
  if (!uid) return { ok: false, error: "user_id_required" };

  // Pull latest tokens for the user
  const rows = await UserPushToken.findAll({
    where: { userId: uid },
    attributes: ["expoPushToken"],
    order: [["lastSeenAt", "DESC"]],
    limit: 25, // safety: don’t spam if somehow lots of tokens exist
  });

  const tokens = rows
    .map((r) => r?.expoPushToken)
    .filter(Boolean);

  // Optional: dedupe
  const uniqueTokens = Array.from(new Set(tokens));

  // Send
  const res = await sendExpoPushAsync({
    tokens: uniqueTokens,
    title,
    body,
    data,
  });

  // Optional future cleanup:
  // If you later process Expo receipts and discover tokens are invalid,
  // you can delete them from user_push_tokens here.
  // (Right now sendPushNotificationsAsync doesn't directly tell you which token failed.)

  return res;
}
