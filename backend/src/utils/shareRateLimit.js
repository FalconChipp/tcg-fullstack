// backend/src/utils/shareRateLimit.js
// NEW/UPDATED (2026-01-27):
// - FIX: bucket variable names (minuteBuckets/dayBuckets were mismatched)
// - ADD: optional dedupe window to prevent spam clicking the same share
// - ADD: payload hashing for dedupe key (per-user)
// - EXPORT: checkShareRateLimit(userId, payload)

import crypto from "crypto";

const minuteBuckets = new Map();
const dayBuckets = new Map();

// Dedupe map: key -> expiresAt
const dedupeBuckets = new Map();

const PER_MINUTE = 5;
const PER_DAY = 50;

// If user shares the *same payload* repeatedly, block for this long
const DEDUPE_WINDOW_MS = 20_000; // 20s (tweak as you like)

// --- internal helpers ---

function stableStringify(obj) {
  // Stable stringify to make hashing consistent
  const seen = new WeakSet();

  const sorter = (value) => {
    if (value && typeof value === "object") {
      if (seen.has(value)) return null;
      seen.add(value);

      if (Array.isArray(value)) return value.map(sorter);

      const out = {};
      Object.keys(value)
        .sort()
        .forEach((k) => {
          out[k] = sorter(value[k]);
        });
      return out;
    }
    return value;
  };

  return JSON.stringify(sorter(obj));
}

function hashPayload(payload) {
  try {
    const str = stableStringify(payload ?? {});
    return crypto.createHash("sha256").update(str).digest("hex").slice(0, 24);
  } catch {
    return "";
  }
}

function cleanupDedupe(now) {
  // Avoid unbounded growth
  for (const [k, exp] of dedupeBuckets.entries()) {
    if (!exp || exp <= now) dedupeBuckets.delete(k);
  }
}

// --- main export ---

export function checkShareRateLimit(userId, payload) {
  // If unauthenticated, you can decide to block or allow.
  // Your route requires auth anyway, so this is mostly defensive.
  if (!userId) return { ok: true };

  const now = Date.now();

  // 0) Dedupe: same payload repeatedly
  cleanupDedupe(now);

  const payloadHash = hashPayload(payload);
  if (payloadHash) {
    const dedupeKey = `share:dedupe:${String(userId)}:${payloadHash}`;
    const existingExp = dedupeBuckets.get(dedupeKey);

    if (existingExp && existingExp > now) {
      return { ok: false, reason: "duplicate" };
    }

    dedupeBuckets.set(dedupeKey, now + DEDUPE_WINDOW_MS);
  }

  // 1) Per-minute
  const m = minuteBuckets.get(userId) || { count: 0, ts: now };
  if (now - m.ts > 60_000) {
    m.count = 0;
    m.ts = now;
  }
  m.count++;
  minuteBuckets.set(userId, m);

  if (m.count > PER_MINUTE) {
    return { ok: false, reason: "minute" };
  }

  // 2) Per-day
  const d = dayBuckets.get(userId) || { count: 0, ts: now };
  if (now - d.ts > 86_400_000) {
    d.count = 0;
    d.ts = now;
  }
  d.count++;
  dayBuckets.set(userId, d);

  if (d.count > PER_DAY) {
    return { ok: false, reason: "day" };
  }

  return { ok: true };
}
