// src/modules/integrations/discord/oauth.service.js
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
    // Log everything that might be relevant (safe to log in dev)
    console.error("[Discord OAuth] token exchange failed", {
      status: resp.status,
      statusText: resp.statusText,
      body: text,
      // Helpful visibility in dev:
      sent: {
        client_id: CLIENT_ID,
        // do NOT log client_secret
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      },
    });
    throw new Error(`token exchange failed: ${resp.status}`);
  }

  return resp.json(); // { access_token, token_type, expires_in, refresh_token?, scope }
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
