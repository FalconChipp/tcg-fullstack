// frontend/app/api/discord/guild-channels/route.js
// ADDED (2026-01-26):
// - App Router route handler
// - Proxies backend GET /api/discord/share/guilds/:guildId/channels
// - Returns { channels: [...] }

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const reqId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const backend = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4010";
  const { searchParams } = new URL(req.url);
  const guildId = String(searchParams.get("guildId") || "").trim();

  if (!guildId) {
    return NextResponse.json({ ok: false, error: "guildId is required", reqId }, { status: 400 });
  }

  const target = `${backend.replace(/\/+$/, "")}/discord/share/guilds/${encodeURIComponent(guildId)}/channels`;
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

  return NextResponse.json({ channels: body?.channels || [] }, { status: 200 });
}
