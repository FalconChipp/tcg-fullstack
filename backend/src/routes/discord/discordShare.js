// backend/src/routes/discord/discordShare.js
//
// UPDATED (2026-02-02):
// - ADD: Safety enforcement for all Discord share actions via requireCapability(user, "canShareToDiscord")
// - CHANGED: requireUserAuth -> requireShareAuth (auth + capability gate in one place)
// - CHANGED: requestedBy.username no longer falls back to email (avoid leaking emails to Discord)
// - ADD: message normalization + max length protection
// - REMOVE: unused UserDiscordLink import (model is accessed via models/index.js in token helper)
//
// Notes:
// - This assumes req.user is attached by attachUser() middleware before this router is mounted.
// - This router is "user-initiated" (not bot-initiated). Bot calls are done via callBotJson() with x-sbf-key.

import express from "express";
import crypto from "crypto";

import { UserDiscordLink } from "../../models/index.js";
import { refreshAccessToken } from "../../modules/intergrations/discord/oauth.service.js";
import { requireCapability } from "../../modules/safety/guards.js";
import { checkShareRateLimit } from "../../utils/shareRateLimit.js";

const router = express.Router();

/* ============================== helpers ============================== */

function normalizeMessage(v, maxLen = 400) {
  if (!v) return "";
  const s = String(v).trim();
  if (!s) return "";
  // Prevent huge payloads / spam walls
  return s.length > maxLen ? `${s.slice(0, maxLen).trim()}…` : s;
}

/**
 * CHANGED: auth + capability gate in one middleware
 * - Requires logged-in user (req.user)
 * - Enforces safety capability: canShareToDiscord
 */
function requireShareAuth(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  try {
    // ✅ NEW: safety enforcement for Discord sharing
    requireCapability(req.user, "canShareToDiscord", { action: "share to Discord" });
  } catch (e) {
    // requireCapability throws; return clean 403 to client
    return res.status(403).json({
      ok: false,
      error: "forbidden",
      reason: "capability_denied",
      message: e?.message || "Not allowed to share to Discord",
    });
  }

  return next();
}

/* -------------------- BOT SERVICE HTTP HELPERS -------------------- */

async function callBotJson(path, { method = "GET", body = null } = {}) {
  const base = process.env.DISCORD_BOT_BASE_URL;
  const key = process.env.DISCORD_BOT_API_KEY;

  if (!base) throw new Error("DISCORD_BOT_BASE_URL missing");
  if (!key) throw new Error("DISCORD_BOT_API_KEY missing");

  const url = `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

  const r = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-sbf-key": key,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await r.text().catch(() => "");
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!r.ok) {
    const details = json ? JSON.stringify(json) : text;
    const err = new Error(`Bot HTTP ${r.status} ${r.statusText} :: ${details}`);
    err.status = r.status;
    err.details = json || text;
    throw err;
  }

  return json;
}

// share-entry call
async function callBotShareEntry(payload) {
  return callBotJson("/api/share-entry", { method: "POST", body: payload });
}

// bot guilds + channels
async function callBotGuilds() {
  return callBotJson("/api/guilds", { method: "GET" });
}

async function callBotGuildChannels(guildId) {
  return callBotJson(`/api/guilds/${encodeURIComponent(String(guildId))}/channels`, { method: "GET" });
}

/* -------------------- DISCORD OAUTH TOKEN HELPERS -------------------- */

const DISCORD_TOKEN_SECRET = process.env.DISCORD_TOKEN_SECRET || "";

function canDecryptTokens() {
  return typeof DISCORD_TOKEN_SECRET === "string" && DISCORD_TOKEN_SECRET.length >= 32;
}

function tokenKey32() {
  return crypto.createHash("sha256").update(DISCORD_TOKEN_SECRET).digest();
}

// Encrypted format: iv.tag.data (base64), matches your discordAuth.js
function decryptToken(enc) {
  if (!canDecryptTokens()) return null;
  if (!enc || typeof enc !== "string") return null;

  const parts = enc.split(".");
  if (parts.length !== 3) return null;

  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", tokenKey32(), iv);
  decipher.setAuthTag(tag);

  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  return out.toString("utf8");
}

function encryptToken(text) {
  if (!canDecryptTokens()) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", tokenKey32(), iv);

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

async function getValidDiscordAccessTokenForUser(userId) {
  if (!canDecryptTokens()) {
    return { ok: false, error: "DISCORD_TOKEN_SECRET missing_or_too_short" };
  }

  const link = await UserDiscordLink.findOne({ where: { userId: String(userId) } });
  if (!link) return { ok: false, error: "discord_not_linked" };

  const access = decryptToken(link.discordAccessTokenEnc);
  const refresh = decryptToken(link.discordRefreshTokenEnc);

  if (access && !isExpired(link.discordTokenExpiresAt)) {
    return { ok: true, accessToken: access };
  }

  if (!refresh) return { ok: false, error: "discord_refresh_missing" };

  let next;
  try {
    next = await refreshAccessToken(refresh);
  } catch (e) {
    console.error("[DiscordShare] refreshAccessToken failed:", e?.message || e);
    return { ok: false, error: "discord_refresh_failed" };
  }

  const nextAccess = next?.access_token || null;
  const nextRefresh = next?.refresh_token || null;
  const expiresAt = next?.expires_in
    ? new Date(Date.now() + next.expires_in * 1000)
    : new Date(Date.now() + 60 * 60 * 1000);

  await UserDiscordLink.update(
    {
      discordAccessTokenEnc: nextAccess ? encryptToken(nextAccess) : link.discordAccessTokenEnc,
      discordRefreshTokenEnc: nextRefresh ? encryptToken(nextRefresh) : link.discordRefreshTokenEnc,
      discordTokenExpiresAt: expiresAt,
    },
    { where: { userId: String(userId) } }
  );

  if (!nextAccess) return { ok: false, error: "discord_refresh_failed" };
  return { ok: true, accessToken: nextAccess };
}

async function fetchDiscordUserGuilds(discordAccessToken) {
  const r = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${discordAccessToken}` },
  });

  const text = await r.text().catch(() => "");
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!r.ok) {
    return { ok: false, error: "discord_guilds_failed", status: r.status, details: json || text };
  }

  return { ok: true, guilds: Array.isArray(json) ? json : [] };
}

function userIsMemberOfGuild(userGuilds, guildId) {
  const gid = String(guildId || "");
  if (!gid) return false;
  return Array.isArray(userGuilds) && userGuilds.some((g) => String(g?.id) === gid);
}

/* -------------------- ENTRY NORMALIZATION HELPERS -------------------- */

function pickPriceGBPFromLatestPrices(latestPrices, variation) {
  if (!Array.isArray(latestPrices) || latestPrices.length === 0) return null;

  const exact = latestPrices.find(
    (p) =>
      (p?.currency === "GBP" || p?.gbp != null) &&
      String(p?.variation || "").toLowerCase() === String(variation || "").toLowerCase()
  );
  if (exact && typeof exact.gbp === "number") return exact.gbp;

  const normal = latestPrices.find(
    (p) =>
      (p?.currency === "GBP" || p?.gbp != null) &&
      String(p?.variation || "").toLowerCase() === "normal"
  );
  if (normal && typeof normal.gbp === "number") return normal.gbp;

  const any = latestPrices.find((p) => typeof p?.gbp === "number");
  return any?.gbp ?? null;
}

function buildProfileUrl({ type, user, entry, cardId, variation }) {
  const base = process.env.FRONTEND_BASE_URL || process.env.WEB_APP_URL || "https://tcg.sixbyfive.com";
  const cleanBase = base.replace(/\/+$/, "");

  const profileTemplate = process.env.FRONTEND_PROFILE_PATH || "/profile/:username";
  const username = user?.username || user?.handle || user?.displayName || null;
  if (!username) return `${cleanBase}/account?tab=security`;

  const profilePath = profileTemplate.replace(":username", encodeURIComponent(String(username)));
  const url = new URL(`${cleanBase}${profilePath}`);

  if (cardId) url.searchParams.set("openCard", String(cardId));
  url.searchParams.set("from", type);
  if (entry?.id) url.searchParams.set("entryId", String(entry.id));
  if (variation) url.searchParams.set("variation", String(variation));

  return url.toString();
}

function normalizeEntryToBotPayload({ type, entry, user, message }) {
  const card = entry?.card || {};
  const variation = entry?.variation ?? entry?.variationKey ?? null;

  const priceGBP = pickPriceGBPFromLatestPrices(card?.latestPrices, variation);
  const cardCanonicalId = entry?.cardId ?? card?.id ?? null;

  // ✅ CHANGED: never fall back to email for Discord display — avoid accidental PII leaks
  const safeUsername = user?.username || "SBF User";

  return {
    type,
    entryId: String(entry?.id || ""),

    channelId: null,
    message: normalizeMessage(message),

    requestedBy: {
      userId: String(user?.id || ""),
      username: safeUsername,
    },

    card: {
      id: card?.id ?? entry?.cardId ?? null,
      cardId: cardCanonicalId,
      name: card?.name ?? null,
      number: card?.number ?? null,
      setCode: card?.setCode ?? null,
      setName: card?.set?.name ?? null,
      rarity: card?.rarity ?? null,
      variation: variation,
      images: {
        small: card?.images?.small ?? null,
        large: card?.images?.large ?? null,
      },
    },

    collection:
      type === "collection"
        ? {
            quantity: entry?.quantity ?? 1,
            condition: entry?.condition ?? null,
            binderName: entry?.binderName ?? null,
          }
        : null,

    wishlist:
      type === "wishlist"
        ? {
            status: entry?.status ?? null,
            quantity: entry?.quantity ?? 1,
          }
        : null,

    pricing: {
      priceGBP,
      updatedAt:
        Array.isArray(card?.latestPrices) && card.latestPrices[0]?.updatedAt
          ? card.latestPrices[0].updatedAt
          : null,
    },

    links: {
      view: buildProfileUrl({
        type,
        user,
        entry,
        cardId: cardCanonicalId,
        variation,
      }),
    },
  };
}

/* ============================== target selection routes ============================== */

// CHANGED: use requireShareAuth (auth + safety)
router.get("/share/guilds", requireShareAuth, async (req, res) => {
  try {
    const tok = await getValidDiscordAccessTokenForUser(req.user.id);
    if (!tok.ok) return res.status(400).json({ ok: false, error: tok.error });

    const ug = await fetchDiscordUserGuilds(tok.accessToken);
    if (!ug.ok) {
      return res.status(400).json({ ok: false, error: ug.error, details: ug.details });
    }

    let botGuilds;
    try {
      const bg = await callBotGuilds();
      botGuilds = Array.isArray(bg?.guilds) ? bg.guilds : Array.isArray(bg) ? bg : [];
    } catch (e) {
      const status = e?.status || 500;
      return res.status(502).json({
        ok: false,
        error: "bot_guilds_endpoint_missing_or_failed",
        details: String(e?.message || e),
        hint: "Implement GET /api/guilds in your bot service (returns { guilds:[{id,name,iconURL?}] }).",
        status,
      });
    }

    const botIds = new Set(botGuilds.map((g) => String(g?.id || "")));
    const shareable = ug.guilds
      .filter((g) => botIds.has(String(g?.id || "")))
      .map((g) => ({
        id: String(g.id),
        name: g.name,
        icon: g.icon || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.json({ ok: true, guilds: shareable });
  } catch (e) {
    console.error("[DiscordShare] /share/guilds error:", e);
    return res.status(500).json({ ok: false, error: "share targets failed", details: String(e?.message || e) });
  }
});

// CHANGED: use requireShareAuth (auth + safety)
router.get("/share/guilds/:guildId/channels", requireShareAuth, async (req, res) => {
  try {
    const guildId = String(req.params.guildId || "").trim();
    if (!guildId) return res.status(400).json({ ok: false, error: "guildId is required" });

    let channels;
    try {
      const bc = await callBotGuildChannels(guildId);
      channels = Array.isArray(bc?.channels) ? bc.channels : Array.isArray(bc) ? bc : [];
    } catch (e) {
      const status = e?.status || 500;
      return res.status(502).json({
        ok: false,
        error: "bot_channels_endpoint_missing_or_failed",
        details: String(e?.message || e),
        hint: "Implement GET /api/guilds/:guildId/channels in your bot service (returns { channels:[{id,name,type}] }).",
        status,
      });
    }

    channels.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
    return res.json({ ok: true, channels });
  } catch (e) {
    console.error("[DiscordShare] /share/guilds/:guildId/channels error:", e);
    return res.status(500).json({ ok: false, error: "share targets failed", details: String(e?.message || e) });
  }
});

/* ============================== share routes ============================== */

// CHANGED: use requireShareAuth (auth + safety)
router.post("/share/collection", requireShareAuth, async (req, res) => {
  try {
    const { guildId, channelId, entry, message } = req.body || {};
    const gid = String(guildId || "").trim();
    const cid = String(channelId || "").trim();

    if (!cid) return res.status(400).json({ ok: false, error: "channelId is required" });
    if (!entry?.id || !entry?.cardId || !entry?.card?.name) {
      return res.status(400).json({ ok: false, error: "entry is missing required fields (id, cardId, card.name)" });
    }

    const safeMsg = normalizeMessage(message);

    const limit = checkShareRateLimit(req.user.id, {
      type: "collection",
      guildId: gid || null,
      channelId: cid,
      entry: {
        id: entry.id,
        cardId: entry.cardId,
        variation: entry.variation ?? entry.variationKey ?? null,
      },
      message: safeMsg,
    });

    if (!limit.ok) {
      const msg =
        limit.reason === "duplicate"
          ? "You have just shared the same collection entry. Please wait before sharing again."
          : limit.reason === "minute"
            ? "You're sharing too fast."
            : "Daily share limit reached.";

      return res.status(429).json({ ok: false, error: "rate_limited", reason: limit.reason, message: msg });
    }

    if (gid) {
      const tok = await getValidDiscordAccessTokenForUser(req.user.id);
      if (!tok.ok) return res.status(400).json({ ok: false, error: tok.error });

      const ug = await fetchDiscordUserGuilds(tok.accessToken);
      if (!ug.ok) return res.status(400).json({ ok: false, error: ug.error, details: ug.details });

      if (!userIsMemberOfGuild(ug.guilds, gid)) {
        return res.status(403).json({ ok: false, error: "not_a_member_of_guild" });
      }
    }

    const payload = normalizeEntryToBotPayload({
      type: "collection",
      entry,
      user: req.user,
      message: safeMsg,
    });
    payload.channelId = cid;
    if (gid) payload.guildId = gid;

    const result = await callBotShareEntry(payload);
    return res.json({ ok: true, result });
  } catch (e) {
    console.error("[DiscordShare] collection error:", e);
    return res.status(500).json({ ok: false, error: "share failed", details: String(e?.message || e) });
  }
});

// CHANGED: use requireShareAuth (auth + safety)
router.post("/share/wishlist", requireShareAuth, async (req, res) => {
  try {
    const { guildId, channelId, entry, message } = req.body || {};
    const gid = String(guildId || "").trim();
    const cid = String(channelId || "").trim();

    if (!cid) return res.status(400).json({ ok: false, error: "channelId is required" });
    if (!entry?.id || !entry?.cardId || !entry?.card?.name) {
      return res.status(400).json({ ok: false, error: "entry is missing required fields (id, cardId, card.name)" });
    }

    const safeMsg = normalizeMessage(message);

    const limit = checkShareRateLimit(req.user.id, {
      type: "wishlist",
      guildId: gid || null,
      channelId: cid,
      entry: {
        id: entry.id,
        cardId: entry.cardId,
        variation: entry.variation ?? entry.variationKey ?? null,
      },
      message: safeMsg,
    });

    if (!limit.ok) {
      const msg =
        limit.reason === "duplicate"
          ? "You have just shared the same wishlist entry. Please wait before sharing again."
          : limit.reason === "minute"
            ? "You're sharing too fast."
            : "Daily share limit reached.";

      return res.status(429).json({ ok: false, error: "rate_limited", reason: limit.reason, message: msg });
    }

    if (gid) {
      const tok = await getValidDiscordAccessTokenForUser(req.user.id);
      if (!tok.ok) return res.status(400).json({ ok: false, error: tok.error });

      const ug = await fetchDiscordUserGuilds(tok.accessToken);
      if (!ug.ok) return res.status(400).json({ ok: false, error: ug.error, details: ug.details });

      if (!userIsMemberOfGuild(ug.guilds, gid)) {
        return res.status(403).json({ ok: false, error: "not_a_member_of_guild" });
      }
    }

    const payload = normalizeEntryToBotPayload({
      type: "wishlist",
      entry,
      user: req.user,
      message: safeMsg,
    });
    payload.channelId = cid;
    if (gid) payload.guildId = gid;

    const result = await callBotShareEntry(payload);
    return res.json({ ok: true, result });
  } catch (e) {
    console.error("[DiscordShare] wishlist error:", e);
    return res.status(500).json({ ok: false, error: "share failed", details: String(e?.message || e) });
  }
});

export default router;
