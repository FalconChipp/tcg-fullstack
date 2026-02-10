// src/modules/intergrations/discord/tokens.js
// NEW (2026-01-26):
// - decrypt stored tokens (AES-256-GCM) using DISCORD_TOKEN_SECRET
// - refresh access token if expired (uses refreshAccessToken())
// - persist rotated tokens back into UserDiscordLink

import crypto from "crypto";
import { UserDiscordLink } from "../../models/index.js";
import { refreshAccessToken } from "./oauth.service.js";

const DISCORD_TOKEN_SECRET = process.env.DISCORD_TOKEN_SECRET || "";

function canUseSecret() {
  return typeof DISCORD_TOKEN_SECRET === "string" && DISCORD_TOKEN_SECRET.length >= 32;
}

function makeKey() {
  // 32 bytes from sha256
  return crypto.createHash("sha256").update(DISCORD_TOKEN_SECRET).digest();
}

export function decrypt(enc) {
  if (!canUseSecret()) return null;
  if (!enc || typeof enc !== "string") return null;

  const parts = enc.split(".");
  if (parts.length !== 3) return null;

  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", makeKey(), iv);
  decipher.setAuthTag(tag);

  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  return out.toString("utf8");
}

export function encrypt(text) {
  if (!canUseSecret()) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", makeKey(), iv);

  const enc = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

function isExpired(expiresAt, skewMs = 60_000) {
  if (!expiresAt) return true;
  const t = new Date(expiresAt).getTime();
  if (!Number.isFinite(t)) return true;
  return Date.now() + skewMs >= t;
}

export async function getValidUserAccessToken(userId) {
  const link = await UserDiscordLink.findOne({ where: { userId: String(userId) } });
  if (!link) return { ok: false, error: "discord_not_linked" };

  const access = decrypt(link.discordAccessTokenEnc);
  const refresh = decrypt(link.discordRefreshTokenEnc);

  // If token exists and not expired, use it
  if (access && !isExpired(link.discordTokenExpiresAt)) {
    return { ok: true, accessToken: access };
  }

  // Need refresh
  if (!refresh) return { ok: false, error: "discord_refresh_missing" };

  const next = await refreshAccessToken(refresh);

  const nextAccess = next?.access_token || null;
  const nextRefresh = next?.refresh_token || null; // may be omitted

  const expiresAt = next?.expires_in
    ? new Date(Date.now() + next.expires_in * 1000)
    : new Date(Date.now() + 60 * 60 * 1000);

  await UserDiscordLink.update(
    {
      discordAccessTokenEnc: nextAccess ? encrypt(nextAccess) : link.discordAccessTokenEnc,
      discordRefreshTokenEnc: nextRefresh ? encrypt(nextRefresh) : link.discordRefreshTokenEnc,
      discordTokenExpiresAt: expiresAt,
    },
    { where: { userId: String(userId) } }
  );

  if (!nextAccess) return { ok: false, error: "discord_refresh_failed" };
  return { ok: true, accessToken: nextAccess };
}
