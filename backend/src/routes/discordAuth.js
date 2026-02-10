// backend/src/routes/discordAuth.js
// OAuth linking with a signed `state` so the callback doesn't need req.user/cookies.
//
// UPDATED (2026-02-03):
// - ADD: Safety gating: requireCapability(user, "canConnectDiscord") for start + callback + unlink
// - ADD: Validate user exists before linking in callback
// - CHANGED: Harden return-path normalization (prevents protocol-relative // paths)
// - KEEP: Signed state with JWT_SECRET, 10m expiry
// - KEEP: Scope "identify guilds"
// - KEEP: Optional encrypted token storage

import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchMe,
} from "../modules/intergrations/discord/oauth.service.js";

import { UserDiscordLink, User } from "../models/index.js";
import { requireCapability } from "../modules/safety/guards.js";

const router = express.Router();

// REQUIRED
const STATE_SECRET = process.env.JWT_SECRET;

// Optional: base URL of your frontend to complete the redirect after linking
const FRONTEND_BASE = process.env.FRONTEND_BASE_URL || "http://localhost:3000";

// Optional: encrypt stored Discord tokens at rest
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

// CHANGED: also enforce canConnectDiscord
async function requireAuth(req, res, next) {
  try {
    // Prefer attachUser() if present
    if (!req.user?.id) {
      const hdr = await verifyAuthHeader(req.headers.authorization || "");
      if (hdr?.id) req.user = hdr;
    }

    if (!req.user?.id) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    // ✅ ADDED: safety gate for discord linking
    requireCapability(req.user, "canConnectDiscord", { action: "connect Discord" });

    return next();
  } catch (e) {
    return res.status(403).json({
      ok: false,
      error: "forbidden",
      reason: "capability_denied",
      message: e?.message || "Not allowed to connect Discord",
    });
  }
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

// CHANGED: stricter. Only allow a normal relative path like "/account?tab=security".
// Blocks "//evil.com" protocol-relative tricks and weird whitespace.
function normalizeReturnPath(p) {
  const fallback = "/account?tab=security";
  if (!p || typeof p !== "string") return fallback;

  const s = p.trim();

  // Must be a single-leading-slash relative path.
  if (!s.startsWith("/")) return fallback;

  // Block protocol-relative paths like "//evil.com"
  if (s.startsWith("//")) return fallback;

  // Optionally block path traversal patterns (not strictly necessary for redirects,
  // but keeps things tidy and predictable).
  if (s.includes("\\") || s.includes("\0")) return fallback;

  return s;
}

/* ========================================================================== */
/*                           TOKEN ENCRYPTION (OPT)                           */
/* ========================================================================== */

function canEncryptTokens() {
  return typeof DISCORD_TOKEN_SECRET === "string" && DISCORD_TOKEN_SECRET.length >= 32;
}

function tokenKey32() {
  return crypto.createHash("sha256").update(DISCORD_TOKEN_SECRET).digest(); // 32 bytes
}

function encrypt(text) {
  if (!canEncryptTokens()) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", tokenKey32(), iv);

  const enc = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // store as iv.tag.data (base64)
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

/* ========================================================================== */
/*                               START ENDPOINTS                              */
/* ========================================================================== */

// GET /auth/discord/start-url?return=/account?tab=security
router.get("/auth/discord/start-url", requireAuth, (req, res) => {
  const returnPath =
    typeof req.query.return === "string" ? normalizeReturnPath(req.query.return) : "/account?tab=security";

  const state = signState({ u: String(req.user.id), r: returnPath });

  // Scope includes guilds so we can validate membership for sharing later
  const url = buildAuthorizeUrl(state, "identify guilds");

  return res.json({ url });
});

// GET /auth/discord/start?return=/account?tab=security
router.get("/auth/discord/start", requireAuth, (req, res) => {
  const returnPath =
    typeof req.query.return === "string" ? normalizeReturnPath(req.query.return) : "/account?tab=security";

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

    // ✅ ADDED: ensure user exists + apply safety gate before linking
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).send("User not found");

    try {
      requireCapability(user, "canConnectDiscord", { action: "connect Discord" });
    } catch (e) {
      // Redirect user back with a hint instead of linking
      const sep = returnPath.includes("?") ? "&" : "?";
      const redirectTo = `${FRONTEND_BASE}${returnPath}${sep}linked=discord&error=not_allowed`;
      return res.redirect(redirectTo);
    }

    const token = await exchangeCodeForToken(String(code));
    const me = await fetchMe(token.access_token);

    // Store encrypted tokens so we can later call /users/@me/guilds
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
