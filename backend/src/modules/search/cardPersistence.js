// src/modules/search/cardPersistence.js
// TEMP: legacy search persistence disabled while marketdata is live.
// Exports safe async no-ops for any legacy imports. No model imports here.

const noopAsync = async () => 0;

// Common named exports used around the legacy search module:
export const saveOrUpdateCard = noopAsync;
export const upsertCards = noopAsync;
export const persistCards = noopAsync;
export const indexCards = noopAsync;
export const rebuildIndex = noopAsync;
export const backfill = noopAsync;
export const ensureIndexes = noopAsync;
export const syncAll = noopAsync;

// Default export that returns a no-op for any other function name
const api = new Proxy(
  {},
  {
    get: () => noopAsync,
  }
);

export default api;
