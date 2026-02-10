// src/modules/integrations/discord/oauth.service.js
// UPDATED (2026-01-26):
// - ADDED: refreshAccessToken(refreshToken)
// - KEEP: buildAuthorizeUrl, exchangeCodeForToken, fetchMe

const BASE = process.env.DISCORD_OAUTH_BASE || "https://discord.com/api";
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

export function buildAuthorizeUrl(state, scope = "identify") {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    scope,
    redirect_uri: REDIRECT_URI,
    state,
    prompt: "consent",
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  });

  const resp = await fetch(`${BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("[Discord OAuth] token exchange failed", {
      status: resp.status,
      statusText: resp.statusText,
      body: text,
      sent: { client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" },
    });
    throw new Error(`token exchange failed: ${resp.status}`);
  }

  return resp.json();
}

// ✅ NEW: refresh access token when expired
export async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    redirect_uri: REDIRECT_URI,
  });

  const resp = await fetch(`${BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("[Discord OAuth] refresh failed", {
      status: resp.status,
      statusText: resp.statusText,
      body: text,
    });
    throw new Error(`refresh failed: ${resp.status}`);
  }

  return resp.json(); // { access_token, expires_in, refresh_token?, scope, token_type }
}

export async function fetchMe(accessToken) {
  const resp = await fetch(`${BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    const text = await resp.text();
    console.error("[Discord OAuth] /users/@me failed", resp.status, text);
    throw new Error(`@me failed: ${resp.status}`);
  }
  return resp.json();
}
