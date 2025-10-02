// src/modules/cardsearch/services/normalizers.service.js
// Centralized normalization utilities for the Card Search module.
// - Provider-agnostic helpers (strings, dates, arrays, numbers)
// - Canonical ID and number formatting for cards
// - Variant normalization + light detection
// - Provider-aware normalizers for sets, cards, and price blobs
//
// Keep this file dependency-free and pure (no I/O, no DB).

/* -----------------------------------------------------------------------------
 * Core string/date/array helpers
 * -------------------------------------------------------------------------- */

/** Trim, collapse internal whitespace if requested */
export function norm(input, { collapse = false, lower = false } = {}) {
  if (input == null) return "";
  let s = String(input).trim();
  if (collapse) s = s.replace(/\s+/g, " ");
  if (lower) s = s.toLowerCase();
  return s;
}

/** Tokenize a name for fuzzy search */
export function tokenizeName(input) {
  return norm(input, { lower: true })
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** If value is falsy return null, else trimmed string */
export function toNullableString(v) {
  const s = norm(v);
  return s === "" ? null : s;
}

/** Return an array for any input; string splits on commas if requested */
export function asArray(v, { splitCommas = false } = {}) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  if (splitCommas && typeof v === "string") {
    return v.split(",").map((x) => norm(x)).filter(Boolean);
  }
  return [v];
}

/** NaN-safe integer parse; returns null if not finite */
export function toInt(v) {
  const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

/** NaN-safe float parse; returns null if not finite */
export function toNum(v) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Strict YYYY-MM-DD; returns null if invalid */
export function safeDateISO(v) {
  if (!v) return null;
  const d = new Date(v);
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/** Passthrough if valid ISO date-time, else now() */
export function safeDateTimeISO(v) {
  try {
    const d = v ? new Date(v) : new Date();
    if (Number.isNaN(d.getTime())) return new Date().toISOString();
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/* -----------------------------------------------------------------------------
 * IDs, numbers, and basic mapping
 * -------------------------------------------------------------------------- */

/**
 * Normalize the printed number of a card (keep suffixes like '123a', preserve leading zeros).
 * Accepts numbers or strings; returns trimmed string.
 */
export function normalizeNumber(v) {
  if (v == null) return "";
  // Convert numbers like 1 -> "1"; strings preserved
  const s = String(v).trim();
  return s;
}

/** Build canonical card_id as `${setCode}-${number}` */
export function deriveCardId(setCode, number) {
  const code = norm(setCode);
  const num = normalizeNumber(number);
  return `${code}-${num}`;
}

/** Split `${setCode}-${number}` → { setCode, number } */
export function splitCardId(cardId) {
  const s = String(cardId || "");
  const [setCode, ...rest] = s.split("-");
  return { setCode, number: rest.join("-") };
}

/* -----------------------------------------------------------------------------
 * Variants
 * -------------------------------------------------------------------------- */

/** Normalize a variant label to a canonical key used in DB */
export function normalizeVariantKey(v) {
  if (!v) return "normal";
  const s = norm(v, { lower: true });
  if (s === "reverse" || s === "reverse holo" || s === "rev") return "reverse";
  if (s === "holo" || s === "holofoil" || s === "foil") return "holo";
  if (s === "non-holo" || s === "normal" || s === "base") return "normal";
  if (s === "first edition" || s === "1st edition" || s === "1st") return "firstEdition";
  if (s === "full art" || s === "alt art" || s === "alternate art") return "alt_art";
  return s;
}

/**
 * Lightweight variant detection from common card JSON fields.
 * Always includes 'normal'. Adds other variants conservatively.
 * Returns an array of canonical variant keys.
 */
export function detectVariantsForCard(card) {
  const out = new Set(["normal"]);

  // Accept array in card.variants, booleans, or rarity hints
  for (const v of asArray(card?.variants)) {
    const k = normalizeVariantKey(v);
    if (k) out.add(k);
  }

  const bools = [
    ["hasReverse", "reverse"],
    ["reverse", "reverse"],
    ["holo", "holo"],
    ["isHolo", "holo"],
  ];
  for (const [field, key] of bools) {
    if (truthy(card?.[field])) out.add(key);
  }

  const rarity = norm(card?.rarity, { lower: true });
  if (rarity.includes("holo")) out.add("holo");

  return Array.from(out);
}

function truthy(v) {
  if (v === true) return true;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  if (typeof v === "number") return v > 0;
  return false;
}

/* -----------------------------------------------------------------------------
 * Currency normalization
 * -------------------------------------------------------------------------- */

export function normalizeCurrency(ccy) {
  const s = norm(ccy, { lower: true });
  if (!s) return null;
  if (s === "us$" || s === "usd$") return "USD";
  if (s === "€" || s === "eur€") return "EUR";
  if (s === "£" || s === "gbp£") return "GBP";
  return s.toUpperCase();
}

/* -----------------------------------------------------------------------------
 * Provider-aware: SET normalizer
 * -------------------------------------------------------------------------- */

/**
 * Normalize a provider set payload into m_Set shape.
 * @param {any} raw
 * @param {{ provider?: 'tcgdex' | 'generic', setCode?: string, abbr?: string }} [opts]
 * @returns {{ code: string, abbreviation: string|null, name: string, era: string|null, release_date: string|null, total_cards: number|null }}
 */
export function normalizeSetPayload(raw, opts = {}) {
  const provider = opts.provider || "generic";
  if (provider === "tcgdex") {
    const code = opts.setCode || norm(raw?.id || raw?.code);
    const abbr = toNullableString(opts.abbr);
    const name = toNullableString(raw?.name) || code.toUpperCase();
    const era =
      toNullableString(raw?.serie?.name) ||
      toNullableString(raw?.serie) ||
      null;
    const release_date = safeDateISO(raw?.releasedAt);
    const total_cards = toInt(raw?.cardCount);
    return { code, abbreviation: abbr, name, era, release_date, total_cards };
  }

  // Generic fallback
  const code = opts.setCode || norm(raw?.code || raw?.id);
  return {
    code,
    abbreviation: toNullableString(opts.abbr || raw?.abbr || raw?.abbreviation),
    name: toNullableString(raw?.name) || code.toUpperCase(),
    era: toNullableString(raw?.series || raw?.era) || null,
    release_date: safeDateISO(raw?.releaseDate || raw?.released_at),
    total_cards: toInt(raw?.total || raw?.total_cards),
  };
}

/* -----------------------------------------------------------------------------
 * Provider-aware: CARDS normalizer
 * -------------------------------------------------------------------------- */

/**
 * Normalize an array of provider card payloads into:
 *  - cards[] for m_Card
 *  - variantsByCardId map suitable for m_CardVariant upserts
 *
 * @param {any[]} list
 * @param {{ provider?: 'tcgdex' | 'generic', setCode: string }} opts
 * @returns {{ cards: Array<{ id:string, set_code:string, number:string, name:string, rarity:string|null, supertype:string|null, subtype:string|null, regulation_mark:string|null, image_small:string|null, image_large:string|null }>, variantsByCardId: Record<string, Array<{card_id:string, variant:string}>> }}
 */
export function normalizeCardsPayload(list, opts) {
  const provider = opts?.provider || "generic";
  const setCode = norm(opts?.setCode);
  const cards = [];
  /** @type {Record<string, Array<{card_id:string, variant:string}>>} */
  const variantsByCardId = {};

  for (const c of Array.isArray(list) ? list : []) {
    const number =
      provider === "tcgdex"
        ? normalizeNumber(c?.localId ?? c?.number ?? (String(c?.id || "").split("-").pop() ?? ""))
        : normalizeNumber(c?.number ?? c?.no ?? c?.localId ?? (String(c?.id || "").split("-").pop() ?? ""));

    const cardId = deriveCardId(setCode, number);

    const name =
      toNullableString(c?.name) ||
      cardId;

    // supertype/subtype (singular subtype for your schema)
    const supertype =
      toNullableString(c?.supertype) ||
      (Array.isArray(c?.types) ? "Pokémon" : null);

    const subtype =
      Array.isArray(c?.subtypes) && c.subtypes.length
        ? toNullableString(c.subtypes[0])
        : toNullableString(c?.subtype) || null;

    const regulation_mark =
      toNullableString(c?.regulationMark ?? c?.regulation) || null;

    const rarity = toNullableString(c?.rarity) || null;

    // images
    const imgSmall = toNullableString(c?.images?.small ?? c?.image_small ?? c?.imageSmall) || null;
    const imgLarge = toNullableString(c?.images?.large ?? c?.image_large ?? c?.imageLarge) || null;

    cards.push({
      id: cardId,
      set_code: setCode,
      number,
      name,
      rarity,
      supertype: supertype || null,
      subtype: subtype || null,
      regulation_mark,
      image_small: imgSmall,
      image_large: imgLarge,
    });

    // variants
    const detected = detectVariantsForCard(c);
    variantsByCardId[cardId] = detected.map((v) => ({
      card_id: cardId,
      variant: normalizeVariantKey(v),
    }));
  }

  return { cards, variantsByCardId };
}

/* -----------------------------------------------------------------------------
 * Provider-aware: PRICE blob normalizer
 * -------------------------------------------------------------------------- */

/**
 * Extract a single "market-ish" price from a provider price object, plus low/mid/high when available.
 * @param {any} p
 * @param {{ defaultCurrency?: string }} [opts]
 * @returns {{ currency: string|null, market: number|null, low: number|null, mid: number|null, high: number|null }}
 */
export function normalizePriceBlob(p, opts = {}) {
  if (!p || typeof p !== "object") {
    return { currency: null, market: null, low: null, mid: null, high: null };
  }

  // Currency: explicit field, else per-currency nesting heuristic
  let currency =
    normalizeCurrency(p.currency || p.curr || p.ccy) ||
    (p.usd ? "USD" : p.eur ? "EUR" : p.gbp ? "GBP" : null) ||
    (opts.defaultCurrency || null);

  const low = firstNum(p.low, p.floor, p.min, p.p10, p.lowest, p.cheapest);
  const mid = firstNum(p.mid, p.median, p.avg, p.average);
  const high = firstNum(p.high, p.ceiling, p.max, p.p90, p.highest);
  let market = firstNum(p.market, p.price, p.value, mid, low, high);

  // If nested per-currency (e.g., { usd: { market: 1.2 } }), walk common keys
  if (market == null) {
    for (const cur of ["usd", "eur", "gbp"]) {
      const node = p[cur];
      if (node && typeof node === "object") {
        const nested = normalizePriceBlob(node, { defaultCurrency: cur.toUpperCase() });
        if (nested.market != null) {
          currency = nested.currency || currency;
          market = nested.market;
          break;
        }
      }
    }
  }

  return { currency, market, low, mid, high };
}

function firstNum(...vals) {
  for (const v of vals) {
    const n = toNum(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/* -----------------------------------------------------------------------------
 * Images (minor helpers)
 * -------------------------------------------------------------------------- */

/** Choose the best available image URLs from a generic card object */
export function pickImages(obj) {
  const small = toNullableString(obj?.images?.small ?? obj?.image_small ?? obj?.imageSmall) || null;
  const large = toNullableString(obj?.images?.large ?? obj?.image_large ?? obj?.imageLarge) || null;
  return { small, large };
}

/* -----------------------------------------------------------------------------
 * Default export (convenience)
 * -------------------------------------------------------------------------- */

export default {
  // primitives
  norm,
  tokenizeName,
  toNullableString,
  asArray,
  toInt,
  toNum,
  safeDateISO,
  safeDateTimeISO,

  // ids & numbers
  normalizeNumber,
  deriveCardId,
  splitCardId,

  // variants
  normalizeVariantKey,
  detectVariantsForCard,

  // currency
  normalizeCurrency,

  // provider-aware
  normalizeSetPayload,
  normalizeCardsPayload,
  normalizePriceBlob,

  // images
  pickImages,
};
