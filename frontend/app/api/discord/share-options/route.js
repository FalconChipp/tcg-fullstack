// frontend/app/api/discord/share-options/route.js
// ADDED (2026-01-26):
// - App Router route handler (matches your working share-entry handler location)
// - Proxies backend GET /api/discord/share/guilds
// - Passes Authorization through (optional)
// - Forces no-store caching to avoid dev caching weirdness

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const reqId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const backend = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
  const target = `${backend.replace(/\/+$/, "")}/api/discord/share/guilds`;

  const auth = req.headers.get("authorization") || "";

  let upstream;
  try {
    upstream = await fetch(target, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: auth } : {}),
      },
      cache: "no-store",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Upstream fetch failed", details: err?.message || String(err), target, reqId },
      { status: 502 }
    );
  }

  const text = await upstream.text().catch(() => "");
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text || null;
  }

  if (!upstream.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: body?.error || body?.message || `Upstream error ${upstream.status}`,
        upstreamStatus: upstream.status,
        upstreamBody: body,
        target,
        reqId,
      },
      { status: upstream.status }
    );
  }

  // Frontend expects: { guilds: [...] }
  return NextResponse.json({ guilds: body?.guilds || [] }, { status: 200 });
}
