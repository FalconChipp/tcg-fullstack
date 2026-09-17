// utils/setEra.js
// Derive a coarse era key for a set using series, abbreviation, and code.

const SERIES_TO_ERA = {
  "mega evolutions": "me",
  "scarlet & violet": "sv",
  "sword & shield": "swsh",
  "sun & moon": "sm",
  "xy": "xy",
  "black & white": "bw",
  "heartgold & soulsilver": "hgss",
  "diamond & pearl": "dp",
  "ex": "ex",
  "e-card": "ecard",
  "neo": "wotc",
  "gym": "wotc",
  "base": "wotc",
  "wizards": "wotc",
};

const SERIES_ID_TO_ERA = {
  me: "me",
  sv: "sv",
  swsh: "swsh",
  sm: "sm",
  xy: "xy",
  bw: "bw",
  hgss: "hgss",
  dp: "dp",
  ex: "ex",
  ecard: "ecard",
  base: "wotc",
  neo: "wotc",
  gym: "wotc",
};

const WOTC_ABBRS = new Set([
  "BS",
  "JU",
  "FO",
  "B2",
  "TR",
  "G1",
  "G2",
  "LC",
  "N1",
  "N2",
  "N3",
  "N4",
]);

function normalizeString(value, mode = "lower") {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return mode === "upper" ? trimmed.toUpperCase() : trimmed.toLowerCase();
}

function eraFromSeries(series) {
  const key = normalizeString(series);
  if (!key) return null;

  for (const [match, era] of Object.entries(SERIES_TO_ERA)) {
    if (key.includes(match)) return era;
  }
  return null;
}

function eraFromSeriesId(seriesId) {
  const key = normalizeString(seriesId);
  if (!key) return null;
  if (SERIES_ID_TO_ERA[key]) return SERIES_ID_TO_ERA[key];

  if (key.startsWith("me")) return "me";
  if (key.startsWith("sv")) return "sv";
  if (key.startsWith("swsh")) return "swsh";
  if (key.startsWith("sm")) return "sm";
  if (key.startsWith("xy")) return "xy";
  if (key.startsWith("bw")) return "bw";
  if (key.startsWith("hgss")) return "hgss";
  if (key.startsWith("dp")) return "dp";
  if (key.startsWith("pl")) return "dp";
  if (key.startsWith("ex")) return "ex";
  if (key.startsWith("ecard")) return "ecard";
  if (key.startsWith("base") || key.startsWith("neo") || key.startsWith("gym")) return "wotc";

  return null;
}

function eraFromAbbr(abbr) {
  const key = normalizeString(abbr, "upper");
  if (!key) return null;

if (key.startsWith("ME")) return "me";
  if (key.startsWith("SV")) return "sv";
  if (key.startsWith("SW") || key.startsWith("SS")) return "swsh";
  if (key.startsWith("SM")) return "sm";
  if (key.startsWith("XY")) return "xy";
  if (key.startsWith("BW")) return "bw";
  if (key.startsWith("HG") || key.startsWith("HS")) return "hgss";
  if (key.startsWith("DP") || key.startsWith("PL")) return "dp";
  if (key.startsWith("EX")) return "ex";
  if (key.startsWith("EC")) return "ecard";
  if (WOTC_ABBRS.has(key)) return "wotc";
  return null;
}

function eraFromCode(code) {
  const raw = normalizeString(code).replace(/\s+/g, "");
  if (!raw) return null;

  const cleaned = raw.replace(/\./g, "");

  if (cleaned.startsWith("me") || 
    cleaned === "30th" ||
    cleaned === "30th-c"
  ) 
    return "me";
  if (cleaned.startsWith("sv")) return "sv";
  if (
    cleaned.startsWith("swsh") ||
    cleaned === "pgo" ||
    cleaned === "cel25" ||
    cleaned === "fut2020"
  )
    return "swsh";
  if (
    cleaned.startsWith("sm") ||
    cleaned === "smp" ||
    cleaned === "sm115" ||
    cleaned === "det1" ||
    cleaned === "sma"
  )
    return "sm";
  if (cleaned.startsWith("xy") || cleaned === "xyp" || cleaned === "xy0" || cleaned === "kss")
    return "xy";
  if (cleaned.startsWith("bw") || cleaned === "bwp") return "bw";
  if (cleaned.startsWith("hgss") || cleaned === "hsp") return "hgss";
  if (cleaned.startsWith("dp") || cleaned.startsWith("pl")) return "dp";
  if (cleaned.startsWith("ex")) return "ex";
  if (cleaned.startsWith("ecard")) return "ecard";
  if (
    cleaned.startsWith("base") ||
    cleaned.startsWith("neo") ||
    cleaned.startsWith("gym") ||
    cleaned === "lc"
  )
    return "wotc";

  return null;
}

/**
 * Infer a display era key (`sv`, `swsh`, `sm`, `xy`, `bw`, `hgss`, `dp`, `ex`, `ecard`, `wotc`, `misc`)
 * based on the data we have for a set.
 */
export function inferSetEra(input) {
  if (!input) return "misc";
  const fromSeriesId = eraFromSeriesId(input.seriesId);
  if (fromSeriesId) return fromSeriesId;

  const fromSeries = eraFromSeries(input.series);
  if (fromSeries) return fromSeries;

  const fromAbbr = eraFromAbbr(input.abbr);
  if (fromAbbr) return fromAbbr;

  const fromCode = eraFromCode(input.code);
  if (fromCode) return fromCode;

  return "misc";
}

export default inferSetEra;
