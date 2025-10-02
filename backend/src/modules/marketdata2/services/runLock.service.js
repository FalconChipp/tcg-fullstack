// src/modules/marketdata2/services/runLock.service.js
// Coalescing in-memory lock for per-key operations.
// If another call arrives for the same key, it *joins* the in-flight promise,
// preventing duplicate work (e.g., double-click in admin starting the same ingest).

const locks = new Map(); // key -> { promise: Promise<any>, since: number }

/**
 * Returns true if a task for this key is currently running.
 */
export function isLocked(key) {
  return locks.has(key);
}

/**
 * Run `fn` ensuring only one in-flight invocation per `key`.
 * If a run is already in progress, callers will get the *same* promise.
 */
export async function runCoalesced(key, fn) {
  const inFlight = locks.get(key);
  if (inFlight) {
    return inFlight.promise; // join existing run
  }

  const promise = (async () => {
    try {
      return await fn();
    } finally {
      // always release the lock, success or error
      locks.delete(key);
    }
  })();

  locks.set(key, { promise, since: Date.now() });
  return promise;
}

/**
 * (Optional) Force release a key — useful only for recovery tools.
 * Avoid calling this during normal operation.
 */
export function _forceUnlock(key) {
  locks.delete(key);
}
