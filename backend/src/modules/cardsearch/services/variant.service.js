// src/modules/cardsearch/services/variant.service.js
// Shared helpers for normalising provider variant labels to the canonical keys we store
// in the price tables (m_PriceObservation.variant, m_PriceLatest.variant, etc.).
//
// The collectors were previously auto-injecting a "normal" fallback whenever a provider
// only returned a single variant. That caused the downstream lookup layer to query for
// non-existent `normal` rows (see the repeated `sv08-19x normal` SELECTs in the staging
// logs) even when a card is configured as holo-only, so the UI showed missing or stale
// prices. By centralising the canonicalisation rules here we can ensure that adapters
// remap any generic provider price onto the sole configured variant instead of inventing
// additional variants.

const VARIANT_CANON_MAP = new Map([
  ["normal", "normal"],
  ["standard", "normal"],
  ["regular", "normal"],
  ["base", "normal"],
  ["default", "normal"],
  ["nonholo", "normal"],
  ["nonholofoil", "normal"],
  ["nonfoil", "normal"],
  ["unlimited", "normal"],
  ["reverse", "reverse"],
  ["reverseholo", "reverse"],
  ["reverseholofoil", "reverse"],
  ["reversefoil", "reverse"],
  ["reverseholographic", "reverse"],
  ["holoreverse", "reverse"],
  ["holo", "holo"],
  ["holfoil", "holo"],
  ["holofoil", "holo"],
  ["holographic", "holo"],
  ["shiny", "holo"],
  ["foil", "foil"],
  ["1stedition", "firstEdition"],
  ["firstedition", "firstEdition"],
  ["firsteditionholo", "firstEdition"],
  ["firsteditionholofoil", "firstEdition"],
]);

const DEFAULT_FALLBACK = "normal";

/**
 * Canonicalise a provider variant label to one of the enum values supported by the
 * price tables. Falls back to "normal" unless a different fallback is provided.
 *
 * @param {string|null|undefined} value
 * @param {{ fallback?: string|null, heuristic?: boolean }} [opts]
 * @returns {"normal"|"reverse"|"holo"|"firstEdition"|"foil"|null}
 */
export function canonicalVariantKey(value, opts = {}) {
  const fallback = Object.prototype.hasOwnProperty.call(opts, "fallback")
    ? opts.fallback
    : DEFAULT_FALLBACK;
  const heuristic = opts.heuristic !== false;

  if (value == null) {
    return fallback ?? null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return fallback ?? null;
  }

  const normalized = raw.toLowerCase();
  const compact = normalized.replace(/[\s_-]+/g, "");

  if (VARIANT_CANON_MAP.has(compact)) {
    return VARIANT_CANON_MAP.get(compact);
  }
  if (VARIANT_CANON_MAP.has(normalized)) {
    return VARIANT_CANON_MAP.get(normalized);
  }

  if (heuristic) {
    if (compact.includes("reverse")) return "reverse";
    if (compact.includes("first")) return "firstEdition";
    if (compact.includes("holo")) return "holo";
    if (compact.includes("foil")) return "foil";
  }

  return fallback ?? null;
}

/**
 * Convenience helper to turn any iterable of variant labels into a canonical Set.
 * Empty inputs return a Set containing just "normal" unless opts.includeNormal is false.
 */
export function canonicalVariantSet(iterable, opts = {}) {
  const hasFallback = Object.prototype.hasOwnProperty.call(opts, "fallback");
  const fallback = hasFallback
    ? opts.fallback
    : opts.includeNormal === false
      ? null
      : "normal";

  const out = new Set();

  if (iterable) {
    for (const value of iterable) {
      const canon = canonicalVariantKey(value, { fallback: null });
      if (!canon) continue;
      out.add(canon);
    }
  }

  if (out.size === 0 && fallback) {
    out.add(fallback);
  }

  return out;
}

export default {
  canonicalVariantKey,
  canonicalVariantSet,
};
