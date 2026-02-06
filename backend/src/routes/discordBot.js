// backend/src/routes/discordBot.js
//
// UPDATED (2026-02-02):
// - ADD: Auth + safety gate (canConnectDiscord) so minors/unauthorized users can't access Discord install flow
// - ADD: guildId validation (Discord snowflake format)
// - ADD: cache headers (short) to reduce repeated calls
// - KEEP: env-configurable permissions + invite URL generation

import express from "express";
import { requireCapability } from "../modules/safety/guards.js";

const router = express.Router();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

// Minimal permission set (env override supported)
const DEFAULT_PERMISSIONS = process.env.DISCORD_BOT_PERMISSIONS || "274878221376";

/* ============================== helpers ============================== */

function requireDiscordAccess(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  try {
    // ✅ Gate "Discord connection/installation" behind safety rule
    requireCapability(req.user, "canConnectDiscord", { action: "connect Discord" });
  } catch (e) {
    return res.status(403).json({
      ok: false,
      error: "forbidden",
      reason: "capability_denied",
      message: e?.message || "Not allowed to connect Discord",
    });
  }

  return next();
}

// Discord snowflake IDs are numeric strings (typically 17-20 digits)
function isValidSnowflake(id) {
  if (!id) return false;
  const s = String(id).trim();
  return /^[0-9]{15,25}$/.test(s);
}

function buildBotInviteUrl({ guildId } = {}) {
  if (!CLIENT_ID) throw new Error("DISCORD_CLIENT_ID missing");

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: "bot applications.commands",
    permissions: String(DEFAULT_PERMISSIONS),
  });

  // Optional preselect guild
  if (guildId) params.set("guild_id", String(guildId));

  // Optional: avoid user choosing other servers (only use if you really want)
  // params.set("disable_guild_select", "true");

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

/* ============================== routes ============================== */

// CHANGED: gated behind auth + canConnectDiscord
router.get("/discord/bot/invite-url", requireDiscordAccess, (req, res) => {
  try {
    const rawGuildId = typeof req.query.guildId === "string" ? req.query.guildId : null;
    const guildId = rawGuildId && isValidSnowflake(rawGuildId) ? rawGuildId.trim() : null;

    if (rawGuildId && !guildId) {
      return res.status(400).json({ ok: false, error: "Invalid guildId" });
    }

    // Small cache to reduce hammering (optional)
    res.setHeader("Cache-Control", "private, max-age=60");

    const url = buildBotInviteUrl({ guildId });
    return res.json({ ok: true, url });
  } catch (e) {
    console.error("[DiscordBot] invite-url error:", e);
    return res.status(500).json({ ok: false, error: "Failed to build invite url" });
  }
});

export default router;
