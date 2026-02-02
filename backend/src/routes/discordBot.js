// src/routes/discordBot.js
//
// NEW (2026-01-22):
// - Returns an invite URL to install the SixByFive bot into a Discord server.
// - This is NOT user OAuth. It’s the standard bot installation URL.
// - Optional: allow passing guildId to preselect the server in Discord UI.

import express from "express";

const router = express.Router();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

// Minimal permission set:
// - Send Messages
// - Embed Links
// - Read Message History
// - Use External Emojis (optional)
// - Add Reactions (optional)
// - Manage Roles (only if you want the bot to grant roles after linking)
const DEFAULT_PERMISSIONS = process.env.DISCORD_BOT_PERMISSIONS || "274878221376"; 
// ^ change this if you want (I’ll explain below)

function buildBotInviteUrl({ guildId } = {}) {
  if (!CLIENT_ID) throw new Error("DISCORD_CLIENT_ID missing");

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: "bot applications.commands",
    permissions: DEFAULT_PERMISSIONS,
  });

  // Optional preselect guild
  if (guildId) params.set("guild_id", String(guildId));
  // Optional: avoid user choosing other servers (only use if you really want)
  // params.set("disable_guild_select", "true");

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

router.get("/discord/bot/invite-url", (req, res) => {
  try {
    const guildId = typeof req.query.guildId === "string" ? req.query.guildId : null;
    const url = buildBotInviteUrl({ guildId });
    res.json({ ok: true, url });
  } catch (e) {
    console.error("[DiscordBot] invite-url error:", e);
    res.status(500).json({ ok: false, error: "Failed to build invite url" });
  }
});

export default router;
