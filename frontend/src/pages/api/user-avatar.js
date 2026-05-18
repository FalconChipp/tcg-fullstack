// pages/api/user-avatar.js
// NEW (2026-01-11):
// - Fetches a user's avatar via backend GraphQL by username
// - Returns a normalized absolute URL (or empty string)
// - Uses Cache-Control: no-store to prevent stale 304/caching issues during export

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");

    const username = typeof req.query.username === "string" ? req.query.username.trim() : "";
    if (!username) {
      res.status(400).json({ error: "Missing username" });
      return;
    }

    // IMPORTANT:
    // Use your backend GraphQL endpoint (adjust if yours differs)
    // Example: http://localhost:4000/graphql or https://backendtcg.sixbyfive.com/graphql
    const BACKEND_URL =
      process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT?.replace(/\/graphql\/?$/, "") ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.BACKEND_URL ||
      "http://localhost:4010";

    const GRAPHQL_URL =
      BACKEND_URL.endsWith("/graphql") ? BACKEND_URL : `${BACKEND_URL.replace(/\/$/, "")}/graphql`;

    const userQuery = `
      query GetUser($username: String!) {
        userProfile(username: $username) {
          id
          avatar
          user {
            id
            username
            avatar
          }
        }
      }
    `;

    const upstream = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // If your backend requires auth for profile data, add token forwarding here.
      },
      body: JSON.stringify({
        query: userQuery,
        variables: { username },
      }),
      cache: "no-store",
    });

    if (!upstream.ok) {
      res.status(502).json({ error: `GraphQL upstream failed: ${upstream.status}` });
      return;
    }

    const json = await upstream.json();

    if (json?.errors?.length) {
      res.status(502).json({ error: "GraphQL returned errors", details: json.errors });
      return;
    }

    const p = json?.data?.userProfile || null;
    const raw =
      (typeof p?.user?.avatar === "string" && p.user.avatar.trim()) ||
      (typeof p?.avatar === "string" && p.avatar.trim()) ||
      "";

    if (!raw) {
      res.status(200).json({ avatar: "" });
      return;
    }

    // Normalize to absolute URL
    const isAbs = /^https?:\/\//i.test(raw);
    const normalized = isAbs
      ? raw
      : `${BACKEND_URL.replace(/\/$/, "")}${raw.startsWith("/") ? "" : "/"}${raw}`;

    res.status(200).json({ avatar: normalized });
  } catch (err) {
    res.status(500).json({ error: "user-avatar error" });
  }
}
