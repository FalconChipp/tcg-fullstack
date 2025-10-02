// Token-bucket per host + minimal instrumentation.

import createLogger from './logger.js';
const log = createLogger('ratelimiter');

const buckets = new Map();

export function getBucket(host, { capacity = 6, refillMs = 1000 } = {}) {
  let b = buckets.get(host);
  if (!b) {
    b = { tokens: capacity, capacity, refillMs, last: Date.now(), waits: 0, host };
    buckets.set(host, b);
  }
  return b;
}

function refill(b) {
  const now = Date.now();
  const elapsed = now - b.last;
  const add = Math.floor(elapsed / b.refillMs);
  if (add > 0) {
    b.tokens = Math.min(b.capacity, b.tokens + add);
    b.last = now;
  }
}

export async function limit(host, fn, { label } = {}) {
  const b = getBucket(host, {});
  for (;;) {
    refill(b);
    if (b.tokens > 0) {
      b.tokens--;
      try {
        return await fn();
      } finally {}
    }
    b.waits++;
    if (b.waits % 10 === 1) {
      log.debug('waiting for tokens', { host, label, tokens: b.tokens });
    }
    await new Promise(r => setTimeout(r, b.refillMs / 2));
  }
}

export function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}
