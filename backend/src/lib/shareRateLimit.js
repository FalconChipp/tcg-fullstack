// shareRateLimit.js

// -------------------------------
// Buckets
// -------------------------------

const minuteBuckets = new Map();
const dayBuckets = new Map();
const dedupeBuckets = new Map(); // ✅ NEW

// -------------------------------
// Limits
// -------------------------------

const PER_MINUTE = 5;
const PER_DAY = 50;
const DEDUPE_WINDOW_MS = 30 * 1000; // 30 seconds

// -------------------------------
// Simple stable hash (stringify)
// -------------------------------

function hashPayload(payload) {
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

// -------------------------------
// Main checker
// -------------------------------

export function checkShareRateLimit(userId, payload) {
  if (!userId) return { ok: true };

  const now = Date.now();

  /* -------------------------------------------------
     1) Duplicate payload protection
  ------------------------------------------------- */

  if (payload) {
    const hash = hashPayload(payload);
    const dedupeKey = `${userId}:${hash}`; // ✅ HERE

    const lastTime = dedupeBuckets.get(dedupeKey);

    if (lastTime && now - lastTime < DEDUPE_WINDOW_MS) {
      return {
        ok: false,
        reason: "duplicate",
      };
    }

    dedupeBuckets.set(dedupeKey, now);
  }

  /* -------------------------------------------------
     2) Per-minute limit
  ------------------------------------------------- */

  const m = minuteBuckets.get(userId) || { count: 0, ts: now };

  if (now - m.ts > 60000) {
    m.count = 0;
    m.ts = now;
  }

  m.count++;
  minuteBuckets.set(userId, m);

  if (m.count > PER_MINUTE) {
    return { ok: false, reason: "minute" };
  }

  /* -------------------------------------------------
     3) Per-day limit
  ------------------------------------------------- */

  const d = dayBuckets.get(userId) || { count: 0, ts: now };

  if (now - d.ts > 86400000) {
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
