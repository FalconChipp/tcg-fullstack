// frontend/src/server/ratelimits/shareRateLimit.js
//
// NEW (2026-01-27):
// - In-memory rate limiter + dedupe for share spam.
// - Per-minute + per-day counters per identity key.
// - Dedupe blocks identical payloads in a short window.
// NOTE: In-memory resets on restart and does NOT coordinate across multiple instances.
//       If you scale horizontally/serverless, move to Redis/Upstash.

import crypto from "crypto";

const minuteBuckets = new Map();
const dayBuckets = new Map();
const dedupeBuckets = new Map();

export const PER_MINUTE = 5;
export const PER_DAY = 50;

export const DEDUPE_WINDOW_MS = 30_000;

const GC_EVERY_MS = 60_000;
let lastGc = 0;

function nowMs() {
  return Date.now();
}

function maybeGc() {
  const now = nowMs();
  if (now - lastGc < GC_EVERY_MS) return;
  lastGc = now;

  for (const [k, v] of minuteBuckets.entries()) {
    if (!v || now - v.ts > 120_000) minuteBuckets.delete(k);
  }
  for (const [k, v] of dayBuckets.entries()) {
    if (!v || now - v.ts > 2 * 86_400_000) dayBuckets.delete(k);
  }
  for (const [k, v] of dedupeBuckets.entries()) {
    if (!v || now - v.ts > DEDUPE_WINDOW_MS) dedupeBuckets.delete(k);
  }
}

// Stable stringify to keep hash consistent even if key order differs
function stableStringify(obj) {
  if (obj == null) return "";
  if (typeof obj !== "object") return String(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;

  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${k}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function hashPayloadStable(obj) {
  const s = stableStringify(obj);
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 24);
}

/**
 * @param {string} key identity (userId/tokenHash/ip)
 * @param {{dedupeKey?:string|null}} opts
 */
export function checkShareRateLimit(key, { dedupeKey = null } = {}) {
  maybeGc();
  if (!key) return { ok: true };

  const now = nowMs();

  // ---- minute ----
  const m = minuteBuckets.get(key) || { count: 0, ts: now };
  if (now - m.ts > 60_000) {
    m.count = 0;
    m.ts = now;
  }
  m.count += 1;
  minuteBuckets.set(key, m);

  if (m.count > PER_MINUTE) {
    const retryAfterSec = Math.max(1, Math.ceil((60_000 - (now - m.ts)) / 1000));
    return { ok: false, reason: "minute", retryAfterSec };
  }

  // ---- day ----
  const d = dayBuckets.get(key) || { count: 0, ts: now };
  if (now - d.ts > 86_400_000) {
    d.count = 0;
    d.ts = now;
  }
  d.count += 1;
  dayBuckets.set(key, d);

  if (d.count > PER_DAY) {
    const retryAfterSec = Math.max(60, Math.ceil((86_400_000 - (now - d.ts)) / 1000));
    return { ok: false, reason: "day", retryAfterSec };
  }

  // ---- dedupe ----
  if (dedupeKey) {
    const prev = dedupeBuckets.get(dedupeKey);
    if (prev && now - prev.ts < DEDUPE_WINDOW_MS) {
      const retryAfterSec = Math.max(1, Math.ceil((DEDUPE_WINDOW_MS - (now - prev.ts)) / 1000));
      return { ok: false, reason: "dedupe", retryAfterSec };
    }
    dedupeBuckets.set(dedupeKey, { ts: now });
  }

  return { ok: true };
}
