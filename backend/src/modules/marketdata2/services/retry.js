// Exponential backoff with jitter + logging hooks (better error logging).

import createLogger from './logger.js';
const log = createLogger('retry');

export async function withRetry(fn, {
  retries = 4,
  min = 250,
  max = 4000,
  label = 'retry',
  onError,
} = {}) {
  let attempt = 0;
  let lastErr = null;

  for (;;) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      attempt++;
      const msg = String(err?.message || err);
      if (onError) onError(err, attempt);
      log.debug('attempt failed', { label, attempt, err: msg });

      if (attempt > retries) {
        log.error('giving up', { label, retries, err: msg });
        throw err;
      }

      const base = Math.min(max, min * 2 ** (attempt - 1));
      const wait = Math.round(base / 2 + Math.random() * base / 2);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}
