// src/routes/discordAuth.js
// OAuth linking with a signed `state` so the callback doesn't need req.user/cookies.
//
// UPDATED (2026-01-22):
// - CHANGE: Request `identify guilds` scope (enables future server config UI)
// - NEW: Optionally store Discord access/refresh token ENCRYPTED for later guild checks
// - KEEP: Signed state with JWT_SECRET, 10m expiry
// - KEEP: Redirect back to FRONTEND_BASE_URL with ?linked=discord

import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchMe,
} from "../modules/intergrations/discord/oauth.service.js";
import { UserDiscordLink } from "../models/index.js";

const router = express.Router();

// REQUIRED
const STATE_SECRET = process.env.JWT_SECRET;

// Optional: base URL of your frontend to complete the redirect after linking
const FRONTEND_BASE = process.env.FRONTEND_BASE_URL || "http://localhost:3000";

// NEW (optional): encrypt stored Discord tokens at rest
// Set this to a random 32+ char secret in env
const DISCORD_TOKEN_SECRET = process.env.DISCORD_TOKEN_SECRET || "";

/* ========================================================================== */
/*                              AUTH HELPERS                                  */
/* ========================================================================== */

async function verifyAuthHeader(header) {
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  const { verifyJwt } = await import("../modules/auth/helpers.js");
  try {
    return verifyJwt(token);
  } catch {
    return null;
  }
}

async function requireAuth(req, res, next) {
  if (req.user?.id) return next();

  const hdr = await verifyAuthHeader(req.headers.authorization || "");
  if (hdr?.id) {
    req.user = hdr;
    return next();
  }
  return res.status(401).json({ ok: false, error: "unauthorized" });
}

/* ========================================================================== */
/*                           SIGNED STATE (JWT)                               */
/* ========================================================================== */

function signState(payload) {
  if (!STATE_SECRET) throw new Error("JWT_SECRET missing for state signing");
  return jwt.sign(payload, STATE_SECRET, { expiresIn: "10m" });
}

function verifyStateToken(token) {
  if (!STATE_SECRET) throw new Error("JWT_SECRET missing for state signing");
  return jwt.verify(token, STATE_SECRET);
}

function normalizeReturnPath(p) {
  const fallback = "/account?tab=security";
  if (!p || typeof p !== "string") return fallback;
  return p.startsWith("/") ? p : `/${p}`;
}

/* ========================================================================== */
/*                           TOKEN ENCRYPTION (OPT)                           */
/* ========================================================================== */

function canEncryptTokens() {
  return typeof DISCORD_TOKEN_SECRET === "string" && DISCORD_TOKEN_SECRET.length >= 32;
}

function encrypt(text) {
  if (!canEncryptTokens()) return null;

  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(DISCORD_TOKEN_SECRET).digest(); // 32 bytes
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const enc = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // store as iv.tag.data (base64)
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(".");
}

/* ========================================================================== */
/*                               START ENDPOINTS                              */
/* ========================================================================== */

router.get("/auth/discord/start-url", requireAuth, (req, res) => {
  const returnPath =
    typeof req.query.return === "string" ? req.query.return : "/account?tab=security";

  const state = signState({ u: String(req.user.id), r: returnPath });

  // CHANGED: request guilds too (for future server config UI)
  const url = buildAuthorizeUrl(state, "identify guilds");

  return res.json({ url });
});

router.get("/auth/discord/start", requireAuth, (req, res) => {
  const returnPath =
    typeof req.query.return === "string" ? req.query.return : "/account?tab=security";

  const state = signState({ u: String(req.user.id), r: returnPath });
  const url = buildAuthorizeUrl(state, "identify guilds");

  return res.redirect(url);
});

/* ========================================================================== */
/*                                 CALLBACK                                   */
/* ========================================================================== */

router.get("/auth/discord/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send("Missing code/state");

    let parsed;
    try {
      parsed = verifyStateToken(String(state));
    } catch (e) {
      console.error("[DiscordAuth] invalid state:", e?.message || e);
      return res.status(401).send("Invalid state");
    }

    const userId = String(parsed.u || "");
    const returnPath = normalizeReturnPath(parsed.r);
    if (!userId) return res.status(400).send("Missing user in state");

    const token = await exchangeCodeForToken(String(code));
    const me = await fetchMe(token.access_token);

    // OPTIONAL: store encrypted tokens so we can later call /users/@me/guilds
    const accessTokenEnc = token?.access_token ? encrypt(token.access_token) : null;
    const refreshTokenEnc = token?.refresh_token ? encrypt(token.refresh_token) : null;

    await UserDiscordLink.upsert({
      userId,
      discordUserId: me.id,
      discordUsername: me.global_name || me.username || null,
      avatar: me.avatar || null,
      linkedAt: new Date(),

      discordAccessTokenEnc: accessTokenEnc,
      discordRefreshTokenEnc: refreshTokenEnc,
      discordTokenExpiresAt: token?.expires_in 
        ? new Date(Date.now() + token.expires_in * 1000)
        : null, 
    });

    const sep = returnPath.includes("?") ? "&" : "?";
    const redirectTo = `${FRONTEND_BASE}${returnPath}${sep}linked=discord`;
    return res.redirect(redirectTo);
  } catch (e) {
    console.error("[DiscordAuth] callback error:", e);
    return res.status(500).send("Discord linking error");
  }
});

/* ========================================================================== */
/*                                  UNLINK                                    */
/* ========================================================================== */

router.post("/auth/discord/unlink", requireAuth, async (req, res) => {
  await UserDiscordLink.destroy({ where: { userId: String(req.user.id) } });
  return res.json({ ok: true });
});

export default router;
