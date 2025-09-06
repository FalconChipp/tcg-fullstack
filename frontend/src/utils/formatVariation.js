// utils/variationUtils.js

/** Return a clean, de-duped array of variation keys for a card */
export function getVariationOptionsFromCard(cardDetail) {
  let arr = [];

  // 1) tcgplayerVariations: object of keys
  if (cardDetail?.tcgplayerVariations && typeof cardDetail.tcgplayerVariations === "object") {
    arr = Object.keys(cardDetail.tcgplayerVariations)
      .filter((k) => k && k !== "__typename" && cardDetail.tcgplayerVariations[k] != null);
  }
  // 2) Variants object: { normal, reverse, holo, firstEdition, ... }
  else if (
    cardDetail?.variations &&
    !Array.isArray(cardDetail.variations) &&
    typeof cardDetail.variations === "object"
  ) {
    arr = Object.entries(cardDetail.variations)
      .filter(([k, on]) => k !== "__typename" && !!on)
      .map(([k]) => k);
  }
  // 3) Comma-separated string
  else if (typeof cardDetail?.variations === "string") {
    arr = cardDetail.variations.split(",").map((s) => s.trim());
  }
  // 4) Array<string>
  else if (Array.isArray(cardDetail?.variations)) {
    arr = cardDetail.variations.slice();
  }

  // normalize: slug -> lower_snake, drop meta keys
  const norm = arr
    .map((k) => String(k).trim())
    .filter((k) => k && !k.startsWith("__"))
    .map((k) => k.replace(/\s+/g, "_").toLowerCase());

  // de-dupe and order with sensible preference
  const pref = ["normal", "holo", "reverse", "reverse_holo", "first_edition", "wpromo", "w_promo"];
  const uniq = Array.from(new Set(norm));
  uniq.sort((a, b) => {
    const ia = pref.indexOf(a);
    const ib = pref.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return uniq;
}

/** Pretty label for a single variation key */
export function formatVariation(variation) {
  if (!variation) return "Standard";
  const raw = String(variation).trim();
  if (!raw || raw.startsWith("__")) return "Standard";

  // canonicalize
  const cleaned = raw.replace(/\s+/g, "_").toLowerCase();
  const aliasMap = {
    reverseholo: "reverse_holo",
    reverseholofoil: "reverse_holo",
    holofoil: "holo",
    firstedition: "first_edition",
    wpromo: "w_promo",
    standard: "normal",
  };
  const v = aliasMap[cleaned.replace(/[^a-z0-9_]/g, "")] || cleaned;

  if (v === "normal") return "Standard";
  if (v === "holo") return "Holo";
  if (v === "reverse_holo" || v === "reverse") return "Reverse Holo";
  if (v === "first_edition") return "1st Edition";
  if (v === "w_promo") return "W Promo";

  // fallback: Title Case
  return v
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
