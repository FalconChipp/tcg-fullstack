// src/modules/search/normalize.js
// Plain JS, ESM

// sv8-219  -> sv08-219
// sv8-57   -> sv08-057
export function toCanonicalId(cardId) {
  if (!cardId) return cardId;
  // pad a single-digit "svX-" to "sv0X-"
  const m = cardId.match(/^sv(\d)-(\d{1,3})$/i);
  if (m) {
    const set = m[1].padStart(2, "0");   // "8" -> "08"
    const num = m[2].padStart(3, "0");   // "57" -> "057"
    return `sv${set}-${num}`;
  }
  // sv8-219  should become sv08-219 (number already 3 digits)
  const m2 = cardId.match(/^sv(\d)-(\d{3})$/i);
  if (m2) {
    const set = m2[1].padStart(2, "0");
    return `sv${set}-${m2[2]}`;
  }
  return cardId;
}

// Convert tcgdex base URLs to a stable hi-res url.
// Examples in → "https://assets.tcgdex.net/en/sv/sv08/076"
// out → ".../sv08/076/high.webp"
export function normalizeImage(url) {
  if (!url) return url;
  if (/assets\.tcgdex\.net/.test(url)) {
    // strip any trailing /low.webp|/high.webp first
    const base = url.replace(/\/(low|high)\.webp$/i, "");
    return `${base}/high.webp`;
  }
  // any other CDN you might add later — leave untouched
  return url;
}

export function normalizeVariations(v) {
  if (!Array.isArray(v)) return [];
  // You may want to map vendor-specific spellings here:
  // reverseHolofoil → reverse
  return Array.from(new Set(
    v.map(x => (x === "reverseHolofoil" ? "reverse" : x)).filter(Boolean)
  ));
}

export function normalizePricing(raw) {
  if (!raw) return {};
  let obj = raw;
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw); } catch { return {}; }
  }
  if (obj && typeof obj === "object") return obj;
  return {};
}

// Ensure node has image/variations/pricing normalized and id canonicalized.
export function normalizeNode(node) {
  if (!node) return node;
  const id = toCanonicalId(node.id);
  return {
    ...node,
    id,
    image: normalizeImage(node.image),
    variations: normalizeVariations(node.variations),
    pricing: normalizePricing(node.pricing),
  };
}
