// src/modules/marketdata2/services/net.js
// Minimal HTTP helpers used across md2 services.
// - fetchWithTimeout(url, options, timeoutMs)
// - sleep(ms)
// (plus optional fetchJsonWithTimeout & retry wrapper)
//
// Changes:
// - NEW named export `sleep` so adapters can backoff without local duplicates.
// - Keeps existing named export `fetchWithTimeout`.
// - Provides default export for convenience.

const DEFAULT_TIMEOUT_MS = Number(process.env.MD2_HTTP_TIMEOUT_MS || 8000);

/** Sleep helper (ms). */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

/**
 * Fetch with AbortController-based timeout.
 * Throws Error('timeout <ms>ms') on timeout so callers can distinguish easily.
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(new Error('timeout')), Math.max(1, timeoutMs));
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err) {
    // Normalize timeout message
    const msg = (err && (err.name === 'AbortError' || /timeout/i.test(String(err.message))))
      ? `timeout ${timeoutMs}ms`
      : (err?.message || 'fetch failed');
    const e = new Error(msg);
    e.cause = err;
    throw e;
  } finally {
    clearTimeout(id);
  }
}

/** Optional JSON helper (kept small & tolerant). */
export async function fetchJsonWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const res = await fetchWithTimeout(url, options, timeoutMs);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const msg = `HTTP ${res.status}${text ? ' — ' + text.slice(0, 160).replace(/\s+/g, ' ') : ''}`;
    const e = new Error(msg);
    e.status = res.status;
    throw e;
  }
  return res.json();
}

/**
 * Optional tiny retry wrapper with exponential backoff.
 * Usage:
 *   await withRetry(() => fetchWithTimeout(...), { tries: 3, baseMs: 300, capMs: 4000 })
 */
export async function withRetry(fn, {
  tries = 3,
  baseMs = 300,
  capMs = 4000,
  shouldRetry = (e) => /timeout|502|503|504|429/i.test(String(e?.message)),
  label = 'retry'
} = {}) {
  let attempt = 0;
  let lastErr = null;
  while (attempt < tries) {
    attempt++;
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt >= tries || !shouldRetry(e)) break;
      const delay = Math.min(capMs, Math.round(baseMs * Math.pow(2, attempt - 1)));
      // eslint-disable-next-line no-console
      if (process.env.LOG_LEVEL === 'debug') console.debug(`[${label}] attempt failed`, { attempt, err: String(e?.message || e), delay });
      await sleep(delay);
    }
  }
  throw lastErr || new Error('withRetry failed');
}

export default { fetchWithTimeout, fetchJsonWithTimeout, withRetry, sleep };
