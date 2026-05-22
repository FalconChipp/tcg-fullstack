// frontend/app/api/discord/share-entry/route.js
//
// UPDATED (2026-01-27):
// - ADDED: server-enforced rate limiting (per-minute + per-day) on share-entry.
// - ADDED: dedupe protection to block identical shares in a short window.
// - KEEP: existing upstream proxy to BACKEND_DISCORD_SHARE_URL with x-sbf-key and Authorization passthrough.

import crypto from "crypto";
import { NextResponse } from "next/server";

// import {
//   checkShareRateLimit,
//   hashPayloadStable,
// } from "@/server/ratelimits/shareRateLimit";

import { checkShareRateLimit, hashPayloadStable } from "@/server/rateLimits/shareRateLimit";

/* ----------------------------- helpers ----------------------------- */

function firstForwardedFor(req) {
  const xff = req.headers.get("x-forwarded-for") || "";
  return xff.split(",")[0]?.trim() || "";
}

function authHash(auth) {
  return crypto.createHash("sha256").update(String(auth)).digest("hex").slice(0, 16);
}

/**
 * Prefer real user id (best), else auth header hash, else IP.
 * This lets you limit even if req.user isn't available in Next route.
 */
function buildIdentityKey(req, body, auth) {
  const userId =
    body?.requestedBy?.userId ||
    body?.requestedBy?.id ||
    body?.userId ||
    null;

  if (userId) return `u:${String(userId)}`;

  if (auth) return `t:${authHash(auth)}`;

  const ip = firstForwardedFor(req) || "unknown";
  return `ip:${ip}`;
}

/**
 * Dedupe should hash stable fields only (avoid viewUrl/time changing).
 */
function buildDedupeKey(identityKey, body) {
  const stable = {
    type: body?.type || null,
    guildId: body?.guildId || null,
    channelId: body?.channelId || null,

    // entry/card identity
    entryId: body?.entryId || body?.id || null,
    cardId: body?.card?.cardId || body?.card?.id || body?.cardId || null,
    variation: body?.card?.variation || body?.variation || null,

    // user-entered text should be included (so different messages are allowed)
    message: (body?.message || "").trim(),
  };

  const h = hashPayloadStable(stable);
  return `share:dedupe:${identityKey}:${h}`;
}

/* ----------------------------- handler ----------------------------- */

export async function POST(req) {
  const reqId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    const auth = req.headers.get("authorization") || "";
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    // ✅ NEW: enforce limits HERE (this route is the one being hit repeatedly)
    const identityKey = buildIdentityKey(req, body, auth);
    const dedupeKey = buildDedupeKey(identityKey, body);

    const limit = checkShareRateLimit(identityKey, { dedupeKey });
    if (!limit.ok) {
      const headers = {};
      if (typeof limit.retryAfterSec === "number") {
        headers["Retry-After"] = String(limit.retryAfterSec);
      }

      return NextResponse.json(
        {
          ok: false,
          error: "You've hit the share limit. Please wait and try again",
          reason: limit.reason, // "minute" | "day" | "dedupe"
          retryAfterSec: limit.retryAfterSec ?? null,
          reqId,
        },
        { status: 429, headers }
      );
    }

    // Route to collection or wishlist endpoint based on type
    const shareType = body?.type === "wishlist" ? "wishlist" : "collection";
    const backend = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4010";
    const target = `${backend.replace(/\/+$/, "")}/discord/share/${shareType}`;

    // Map dialog payload to what user-service expects
    const card = body?.entry?.card ?? body?.entry ?? body?.card ?? {};
    const upstreamBody = {
      guildId:   body?.guildId   ?? null,
      channelId: body?.channelId ?? null,
      cardId:    card.id   ?? card.cardId   ?? body?.cardId   ?? null,
      cardName:  card.name ?? card.tcgName  ?? body?.cardName ?? "Unknown card",
      variation: body?.entry?.variation ?? card.variation ?? body?.variation ?? null,
      quantity:  body?.entry?.quantity  ?? card.quantity  ?? body?.quantity  ?? 1,
      imageUrl:  card.image ?? card.imageUrl ?? body?.imageUrl ?? null,
      message:   body?.message ?? null,
    };

    let upstream;
    try {
      upstream = await fetch(target, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth ? { Authorization: auth } : {}),
        },
        body: JSON.stringify(upstreamBody),
      });
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          error: "Upstream fetch failed",
          details: err?.message || String(err),
          target,
          reqId,
        },
        { status: 502 }
      );
    }

    const text = await upstream.text();
    let upstreamResponse = null;
    try {
      upstreamResponse = text ? JSON.parse(text) : null;
    } catch {
      upstreamResponse = text || null;
    }

    if (!upstream.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            (upstreamResponse && upstreamResponse.error) ||
            (upstreamResponse && upstreamResponse.message) ||
            `Upstream error ${upstream.status}`,
          upstreamStatus: upstream.status,
          upstreamBody: upstreamResponse,
          target,
          reqId,
        },
        { status: upstream.status }
      );
    }

    return NextResponse.json(upstreamResponse || { ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Server error", reqId },
      { status: 500 }
    );
  }
}
