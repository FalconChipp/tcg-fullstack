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
  else if (Array.isArray(cardDetail?.variants)) {
    arr = cardDetail.variants
      .map((v) => (typeof v === "string" ? v : v?.key || v?.variant))
      .filter(Boolean);
  }
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
    arr = cardDetail.variations
      .map((v) => (typeof v === "string" ? v : v?.key || v?.variant))
      .filter(Boolean);
  }
  // 5) Fallback: derive from latestPrices.variation when nothing explicit is available
  else if (Array.isArray(cardDetail?.latestPrices) && cardDetail.latestPrices.length) {
    arr = cardDetail.latestPrices
      .map((p) => p.variation || p.variant)
      .filter(Boolean);
  }

  // normalize: slug -> lower_snake, drop meta keys
  const norm = arr
    .map((k) => String(k).trim())
    .filter((k) => k && !k.startsWith("__"))
    .map((k) => k.replace(/\s+/g, "_").toLowerCase());

  // de-dupe and order: base types first, then compound/foil/stamp variants alphabetically
  const pref = ["normal", "holo", "reverse", "first_edition", "w_promo"];
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

// ── Modifier label lookup ─────────────────────────────────────────────────────
// Covers foil slugs, stamp slugs, and subtype slugs as produced by the backend.
// Keys: lowercase, all non-alphanumeric stripped (matches backend slugify()).
const MODIFIER_LABELS = {
  // Foils
  pokeball:         "Poké Ball",
  greatball:        "Great Ball",
  ultraball:        "Ultra Ball",
  masterball:       "Master Ball",
  gold:             "Gold",
  cosmos:           "Cosmos",
  galaxy:           "Galaxy",
  starlight:        "Starlight",
  energy:           "Energy",
  crackedice:       "Cracked Ice",
  mirror:           "Mirror",
  league:           "League",
  playerreward:     "Player Reward",
  professorprogram: "Professor Program",
  tinsel:           "Tinsel",
  loveball:         "Love Ball",
  friendball:       "Friend Ball",
  quickball:        "Quick Ball",
  teamrocket:       "Team Rocket",
  duskball:         "Dusk Ball",

  // Stamps (using stamp slug conventions: _ separators, special renames)
  first_edition:        "1st Edition",
  first_edition_error:  "1st Edition Error",
  first_edition_scratch_error: "1st Edition Scratch Error",
  w_promo:              "W Promo",
  pre_release:          "Pre-Release",
  staff:                "Staff",
  pokemon_center:       "Pokémon Center",
  set_logo:             "Set Logo",
  pikachu_tail:         "Pikachu Tail",
  wotc:                 "WotC",
  winner:               "Winner",
  snowflake:            "Snowflake",
  trick_or_trade:       "Trick or Trade",
  gamestop:             "GameStop",
  eb_games:             "EB Games",
  ace_trainer:          "Ace Trainer",
  pokemon_day:          "Pokémon Day",
  judge:                "Judge",
  asia_promo:           "Asia Promo",
  horizons:             "Horizons",
  mcdonalds:            "McDonald's",
  champion:             "Champion",
  finalist:             "Finalist",
  quarter_finalist:     "Quarter-Finalist",
  semi_finalist:        "Semi-Finalist",
  top_eight:            "Top 8",
  top_sixteen:          "Top 16",
  top_thirty_two:       "Top 32",
  master_ball_league:   "Master Ball League",
  ultra_ball_league:    "Ultra Ball League",
  player_rewards_program: "Player Rewards Program",
  state_championships:  "State Championships",
  national_championships: "National Championships",
  city_championships:   "City Championships",
  gym_challenge:        "Gym Challenge",
  regional_championships: "Regional Championships",
  international_championships: "International Championships",
  stadium_challenge:    "Stadium Challenge",
  "25th_celebration":   "25th Celebration",
  "10th_anniversary":   "10th Anniversary",
  first_movie:          "1st Movie",
  first_movie_inverted: "1st Movie (Inverted)",

  // Subtypes
  shadowless:           "Shadowless",
  "1999_2000_copyright": "1999-2000 Copyright",
  missing_expansion_symbol: "Missing Expansion Symbol",
  gold_border:          "Gold Border",
  missing_hp:           "Missing HP",
  blue_border:          "Blue Border",
  no_e_reader:          "No E-Reader",
  rarity_error:         "Rarity Error",
  text_error:           "Text Error",
};

const BASE_TYPE_LABELS = {
  normal:     "Standard",
  holo:       "Holo",
  reverse:    "Reverse Holo",
  metal:      "Metal",
  lenticular: "Lenticular",
};

// Legacy simple-key aliases (for price-derived variation strings & old data)
const LEGACY_ALIASES = {
  reverseholo:     "reverse",
  reverseholofoil: "reverse",
  reverse_holo:    "reverse",
  holofoil:        "holo",
  holo_foil:       "holo",
  firstedition:    "first_edition",
  firstEdition:    "first_edition",
  wpromo:          "w_promo",
  wPromo:          "w_promo",
  standard:        "normal",
};

/**
 * Look up a modifier slug in the label table.
 * Falls back to Title Case with underscores → spaces.
 */
function modifierLabel(slug) {
  if (MODIFIER_LABELS[slug]) return MODIFIER_LABELS[slug];
  // Title-case with underscore → space fallback
  return slug
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Pretty label for a single variation key */
export function formatVariation(variation) {
  if (!variation) return "Standard";
  const raw = String(variation).trim();
  if (!raw || raw.startsWith("__")) return "Standard";

  // Apply legacy aliases for old simple keys (price data, old DB rows)
  const normalized = LEGACY_ALIASES[raw] ?? LEGACY_ALIASES[raw.toLowerCase()] ?? raw;

  // ── New compound key format: "{base}-{mod1}-{mod2}…" ──────────────────────
  // Split on "-" (the component separator the backend uses).
  const parts = normalized.split("-");
  const base  = parts[0].toLowerCase();

  if (BASE_TYPE_LABELS[base]) {
    const baseLabel = BASE_TYPE_LABELS[base];
    const mods = parts.slice(1).map(modifierLabel);
    return mods.length ? `${baseLabel} (${mods.join(", ")})` : baseLabel;
  }

  // ── Legacy underscore-separated keys (e.g. from old ingest or price data) ──
  // Try to identify a base type prefix before the first "_modifier"
  for (const [typeKey, typeLabel] of Object.entries(BASE_TYPE_LABELS)) {
    if (normalized === typeKey) return typeLabel;
    if (normalized.startsWith(typeKey + "_")) {
      const rest = normalized.slice(typeKey.length + 1);
      return `${typeLabel} (${modifierLabel(rest)})`;
    }
  }

  // ── Standalone modifier keys (e.g. "first_edition", "w_promo") ────────────
  if (MODIFIER_LABELS[normalized]) return MODIFIER_LABELS[normalized];

  // ── Final fallback: Title Case ─────────────────────────────────────────────
  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
