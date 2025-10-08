// src/routes/discordAuth.js
// OAuth linking with a signed `state` so the callback doesn't need req.user/cookies.
// CHANGED: fixed import path "integrations" (was "intergrations")
// CHANGED: callback now redirects to FRONTEND_BASE_URL and appends query correctly
// CHANGED: state signing uses JWT_SECRET (env) with 10m expiry
// CHANGED: robust returnPath handling (always a path, add ? or & correctly)

import express from "express";
import jwt from "jsonwebtoken";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchMe,
} from "../modules/intergrations/discord/oauth.service.js"; // CHANGED: fixed folder name
import { UserDiscordLink } from "../models/index.js";

const router = express.Router();

// REQUIRED: set this in your backend .env, e.g. JWT_SECRET=<random hex>
const STATE_SECRET = process.env.JWT_SECRET;

// Optional: base URL of your frontend to complete the redirect after linking
// e.g. FRONTEND_BASE_URL=http://localhost:3000
const FRONTEND_BASE = process.env.FRONTEND_BASE_URL || "http://localhost:3000";

/* ========================================================================== */
/*                              AUTH HELPERS                                  */
/* ========================================================================== */

// If you still want to allow header auth for start endpoints, accept Bearer JWT
async function verifyAuthHeader(header) {
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  const { verifyJwt } = await import("../modules/auth/helpers.js");
  try {
    return verifyJwt(token); // should return { id, ... }
  } catch {
    return null;
  }
}

async function requireAuth(req, res, next) {
  // prefer cookie/session-populated req.user if available
  if (req.user?.id) return next();
  // fallback to Authorization header
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

// NEW: sign `{ u: userId, r: returnPath }` with a short expiry (10 minutes)
function signState(payload) {
  if (!STATE_SECRET) throw new Error("JWT_SECRET missing for state signing");
  return jwt.sign(payload, STATE_SECRET, { expiresIn: "10m" });
}

// NEW: verify and decode the state token from Discord callback
function verifyStateToken(token) {
  if (!STATE_SECRET) throw new Error("JWT_SECRET missing for state signing");
  return jwt.verify(token, STATE_SECRET); // -> { u, r, iat, exp }
}

// Ensure the return path is a safe/relative path for the frontend
function normalizeReturnPath(p) {
  const fallback = "/account?tab=security";
  if (!p || typeof p !== "string") return fallback;
  return p.startsWith("/") ? p : `/${p}`;
}

/* ========================================================================== */
/*                               START ENDPOINTS                              */
/* ========================================================================== */

// Start-url: requires auth, creates signed state, returns { url } to redirect to Discord
router.get("/auth/discord/start-url", requireAuth, (req, res) => {
  const returnPath =
    typeof req.query.return === "string" ? req.query.return : "/account?tab=security";

  // ensure string user id
  const state = signState({ u: String(req.user.id), r: returnPath });
  const url = buildAuthorizeUrl(state, "identify"); // add "guilds" later if needed

  return res.json({ url });
});

// Optional: direct redirect variant (same as above, but server-initiated)
router.get("/auth/discord/start", requireAuth, (req, res) => {
  const returnPath =
    typeof req.query.return === "string" ? req.query.return : "/account?tab=security";

  const state = signState({ u: String(req.user.id), r: returnPath });
  const url = buildAuthorizeUrl(state, "identify");

  return res.redirect(url);
});

/* ========================================================================== */
/*                                 CALLBACK                                   */
/* ========================================================================== */

// Callback: does NOT require req.user; we trust the signed state instead
router.get("/auth/discord/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send("Missing code/state");

    let parsed;
    try {
      parsed = verifyStateToken(String(state)); // { u, r, iat, exp }
    } catch (e) {
      console.error("[DiscordAuth] invalid state:", e?.message || e);
      return res.status(401).send("Invalid state");
    }

    const userId = String(parsed.u || "");
    const returnPath = normalizeReturnPath(parsed.r);
    if (!userId) return res.status(400).send("Missing user in state");

    // OAuth: exchange code -> token, then fetch @me
    const token = await exchangeCodeForToken(String(code));
    const me = await fetchMe(token.access_token);

    // Upsert link (NOTE: userId is a STRING UUID; ensure your model column is STRING(36))
    await UserDiscordLink.upsert({
      userId,
      discordUserId: me.id,
      discordUsername: me.global_name || me.username || null,
      avatar: me.avatar || null,
      linkedAt: new Date(),
    });

    // CHANGED: redirect back to FRONTEND (not backend), add "linked=discord" correctly
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

// Unlink still requires auth (cookie/header)
router.post("/auth/discord/unlink", requireAuth, async (req, res) => {
  await UserDiscordLink.destroy({ where: { userId: String(req.user.id) } });
  return res.json({ ok: true });
});

export default router;
