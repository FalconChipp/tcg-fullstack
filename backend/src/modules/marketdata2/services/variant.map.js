// src/modules/marketdata2/services/variant.map.js
// PURPOSE
// - Provide a single source of truth for variant normalization across providers.
// - Map TCGdex `detailed_variants` + TCGplayer per-variant keys + legacy/alias strings
//   into a compact, canonical set used by marketdata2.
//
// CANONICAL ENUM (keep small and stable for DB keys / rollups):
//   normal | reverseHolofoil | holofoil | firstEdition
//
// EXPORTS
// - normalizeVariantKey(input: string | null | undefined) -> canonical string
// - mapDetailedVariantsToCanonical(list: string[]) -> canonical[] (deduped)
// - listKnownVariants() -> canonical[] (ordered)
// - isKnownVariant(v: string) -> boolean
//
// NOTES
// - Unknown inputs fallback to 'normal' but we still return the raw string when asked explicitly
//   via mapDetailedVariantsToCanonical so callers can log/inspect if needed.
// - If you later decide to add more variants (e.g., "stamped", "staff", "preRelease"),
//   extend CANONICAL and the ALIASES map accordingly, then re-run backfills.

const CANONICAL = ['normal', 'reverseHolofoil', 'holofoil', 'firstEdition'];

/**
 * ALIASES:
 *  - Keys are normalized by lowercasing and removing spaces, hyphens, and underscores.
 *  - Values are canonical variant strings.
 */
const ALIASES = new Map([
  // ---- normal / non-holo ----
  ['normal', 'normal'],
  ['nonholo', 'normal'],
  ['nonholofoil', 'normal'],
  ['none', 'normal'],
  ['base', 'normal'],
  ['regular', 'normal'],
  ['standard', 'normal'],

  // ---- reverse holo ----
  ['reverse', 'reverseHolofoil'],
  ['reverseholo', 'reverseHolofoil'],
  ['reverseholofoil', 'reverseHolofoil'],
  ['revholo', 'reverseHolofoil'],
  ['rev', 'reverseHolofoil'],

  // ---- holo ----
  ['holo', 'holofoil'],
  ['holofoil', 'holofoil'],
  ['foil', 'holofoil'],
  ['fullholo', 'holofoil'],
  ['fullart', 'holofoil'], // often conflated in free sources; treat as holofoil for pricing buckets
  ['altart', 'holofoil'],  // same reasoning — keep buckets small and comparable
  ['shiny', 'holofoil'],   // shiny variants typically price like holofoils

  // ---- first edition ----
  ['1stedition', 'firstEdition'],
  ['firstedition', 'firstEdition'],
  ['1st', 'firstEdition'],
  ['edition1', 'firstEdition'],
]);

function normalizeToken(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s\-_]/g, ''); // drop spaces, hyphens, underscores
}

/**
 * Normalize a single variant key into canonical form.
 * Falls back to 'normal' if unrecognized.
 */
export function normalizeVariantKey(input) {
  const token = normalizeToken(input);
  if (!token) return 'normal';

  // known directly?
  if (ALIASES.has(token)) return ALIASES.get(token);

  // already canonical?
  if (CANONICAL.includes(input)) return input;

  // Some provider keys include long labels like "reverse holofoil"
  // Normalize and check again by removing all non-alphanumerics:
  const compact = token.replace(/[^a-z0-9]/g, '');
  if (ALIASES.has(compact)) return ALIASES.get(compact);

  // Default
  return 'normal';
}

/**
 * Convert an array of provider-detailed variants to canonical set.
 * Unknowns are ignored (to keep the set small for rollups) but returned alongside
 * if a caller wants to inspect/log them externally.
 */
export function mapDetailedVariantsToCanonical(list) {
  const out = new Set();
  const unknowns = [];

  if (!Array.isArray(list)) return { variants: ['normal'], unknowns: [] };

  for (const raw of list) {
    const canon = normalizeVariantKey(raw);
    if (CANONICAL.includes(canon)) out.add(canon);
    else unknowns.push(String(raw));
  }

  // Ensure at least one variant for downstream logic
  if (out.size === 0) out.add('normal');

  return { variants: Array.from(out), unknowns };
}

/** Return the ordered canonical list. */
export function listKnownVariants() {
  return [...CANONICAL];
}

/** Predicate for quick checks. */
export function isKnownVariant(v) {
  return CANONICAL.includes(v);
}

export default {
  normalizeVariantKey,
  mapDetailedVariantsToCanonical,
  listKnownVariants,
  isKnownVariant,
};
