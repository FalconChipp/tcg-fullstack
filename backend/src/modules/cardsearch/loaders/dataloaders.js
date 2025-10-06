// src/modules/cardsearch/dataloaders.js
// Request-scoped dataloaders for Card Search.
// - Dependency-free minimal DataLoader implementation (batch+cache per instance)
// - Batches within event loop tick; resolves in key order
// - Loaders provided:
//     • setByCode:              code -> Set row
//     • variantsByCardId:       card_id -> [variants]
//     • latestPricesByCardId:   card_id -> [latest price rows ordered DESC by updated_at]
//     • rollupsByCardVariant:   (card_id, variant) -> [rollup rows]
// - All loaders accept simple scalar keys except rollups which uses a composite key string.
//
// Usage per request:
//   import { createLoaders } from "./dataloaders.js";
//   const loaders = createLoaders();
//   // pass into GraphQL context, e.g., ctx.loaders
//
// In resolvers:
//   const set = await ctx.loaders.setByCode.load(parent.setCode);

import {
  m_Set,
  m_CardVariant,
  m_PriceLatest,
} from "../models/index.js";
import { computeRollupsSnapshot } from "../services/rollup.service.js";

/* ============================================================================
 * Minimal DataLoader
 * ========================================================================== */

class MiniLoader {
  /**
   * @param {(keys: readonly any[]) => Promise<any[]>} batchFn
   * @param {{ cacheKeyFn?: (k:any)=>any, cache?: Map<any, any> }} [opts]
   */
  constructor(batchFn, opts = {}) {
    if (typeof batchFn !== "function") throw new Error("MiniLoader requires a batch function");
    this._batchFn = batchFn;
    this._cacheKeyFn = opts.cacheKeyFn || ((k) => k);
    this._cache = opts.cache || new Map();

    /** @type {Array<{ key:any, resolve:(v:any)=>void, reject:(e:any)=>void }>} */
    this._queue = [];
    this._scheduled = false;
  }

  /**
   * Load a single key.
   * @param {any} key
   * @returns {Promise<any>}
   */
  load(key) {
    const ck = this._cacheKeyFn(key);
    if (this._cache.has(ck)) return Promise.resolve(this._cache.get(ck));

    return new Promise((resolve, reject) => {
      this._queue.push({ key, resolve, reject });
      if (!this._scheduled) {
        this._scheduled = true;
        queueMicrotask(() => this._dispatch());
      }
    });
  }

  /**
   * Load many keys; resolves to array in the same order.
   * @param {any[]} keys
   */
  loadMany(keys) {
    return Promise.all(keys.map((k) => this.load(k)));
  }

  /**
   * Prime cache with a value for a key if absent.
   * @param {any} key
   * @param {any} value
   */
  prime(key, value) {
    const ck = this._cacheKeyFn(key);
    if (!this._cache.has(ck)) this._cache.set(ck, value);
    return this;
  }

  /** Remove a cached key */
  clear(key) {
    const ck = this._cacheKeyFn(key);
    this._cache.delete(ck);
    return this;
  }

  /** Clear all cache */
  clearAll() {
    this._cache.clear();
    return this;
  }

  async _dispatch() {
    this._scheduled = false;
    const batch = this._queue;
    this._queue = [];
    if (batch.length === 0) return;

    const keys = batch.map((i) => i.key);
    try {
      const results = await this._batchFn(keys);

      if (!Array.isArray(results) || results.length !== keys.length) {
        throw new Error("MiniLoader batchFn must return an array of the same length as keys");
      }

      for (let i = 0; i < keys.length; i++) {
        const { key, resolve, reject } = batch[i];
        const ck = this._cacheKeyFn(key);
        const val = results[i];
        this._cache.set(ck, val);
        resolve(val);
      }
    } catch (err) {
      for (const { reject } of batch) reject(err);
    }
  }
}

/* ============================================================================
 * Helpers
 * ========================================================================== */

function keyCardVariant(cardId, variant) {
  return `${cardId}::${String(variant || "normal").toLowerCase()}`;
}

function splitCardVariantKey(k) {
  const i = String(k).indexOf("::");
  if (i === -1) return { card_id: k, variant: "normal" };
  return { card_id: k.slice(0, i), variant: k.slice(i + 2) };
}

/* ============================================================================
 * Loader factories
 * ========================================================================== */

/**
 * Create request-scoped dataloaders.
 * Call once per request and pass into your GraphQL context.
 */
export function createLoaders() {
  // -- Sets by code ----------------------------------------------------------
  const setByCode = new MiniLoader(async (codes) => {
    const uniq = Array.from(new Set(codes.map((c) => String(c))));
    const rows = await m_Set.findAll({
      where: { code: { [Op.in]: uniq } },
      // keep attributes lean
      attributes: ["code", "abbr", "name", "series", "released_at", "total", "lang"],
    });

    const map = new Map(rows.map((r) => [r.get("code"), r.get()]));
    return codes.map((c) => map.get(String(c)) || null);
  });

  // -- Variants by card_id ---------------------------------------------------
  const variantsByCardId = new MiniLoader(async (cardIds) => {
    const uniq = Array.from(new Set(cardIds.map(String)));
    const rows = await m_CardVariant.findAll({
      where: { card_id: { [Op.in]: uniq } },
      attributes: ["card_id", "variant", "display_name"],
      order: [["variant", "ASC"]],
    });

    /** @type {Map<string, Array<any>>} */
    const byId = new Map();
    for (const r of rows) {
      const obj = r.get();
      const list = byId.get(obj.card_id) || byId.set(obj.card_id, []).get(obj.card_id);
      list.push(obj);
    }

    return cardIds.map((id) => byId.get(String(id)) || []);
  });

  // -- Latest prices by card_id ----------------------------------------------
  const latestPricesByCardId = new MiniLoader(async (cardIds) => {
    const uniq = Array.from(new Set(cardIds.map(String)));
    const rows = await m_PriceLatest.findAll({
      where: { card_id: { [Op.in]: uniq } },
      order: [["updated_at", "DESC"]],
    });

    /** @type {Map<string, Array<any>>} */
    const byId = new Map();
    for (const r of rows) {
      const obj = r.get();
      const list = byId.get(obj.card_id) || byId.set(obj.card_id, []).get(obj.card_id);
      list.push(obj);
    }

    return cardIds.map((id) => byId.get(String(id)) || []);
  });

  // -- Rollups by (card_id, variant) -----------------------------------------
  const rollupsByCardVariant = new MiniLoader(
    async (compositeKeys) => {
      const pairs = compositeKeys.map(splitCardVariantKey);

      const results = await Promise.all(
        pairs.map(({ card_id, variant }) =>
          computeRollupsSnapshot(card_id, variant, {})
        )
      );

      const map = new Map();
      pairs.forEach(({ card_id, variant }, idx) => {
        const key = keyCardVariant(card_id, variant);
        map.set(key, results[idx] || []);
      });

      return compositeKeys.map((k) => map.get(String(k)) || []);
    },
    { cacheKeyFn: (k) => String(k) }
  );

  return {
    setByCode,
    variantsByCardId,
    latestPricesByCardId,
    rollupsByCardVariant,

    /** Utility: build the composite key for rollups loader */
    keyCardVariant,
    /** Clear all internal caches (rarely needed; per-request loaders are short-lived) */
    clearAll() {
      setByCode.clearAll();
      variantsByCardId.clearAll();
      latestPricesByCardId.clearAll();
      rollupsByCardVariant.clearAll();
    },
  };
}

/* ============================================================================
 * Default export
 * ========================================================================== */

export default {
  createLoaders,
};
