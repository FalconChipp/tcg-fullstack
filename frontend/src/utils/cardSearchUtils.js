// Shared pure utilities for card search pages (search.js, CardSearch.js).
// Extracted from both files where the logic was identical.

export const GBP_SYMBOL = "£";
export const FALLBACK_SYMBOL_IMAGE = "https://placehold.co/50x50/webp?text=Icon";
export const CARDSEARCH_PAGE_SIZE = 48;
export const CARDSEARCH_EXACT_LIMIT = 12;
export const HOME_RESULT_LIMIT = 8;

export function pos(n) {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export function pickDisplayPrice(entry) {
  if (!entry) return null;
  if (pos(entry.gbp)) return entry.gbp;
  if (pos(entry.market)) return entry.market;
  if (pos(entry.mid)) return entry.mid;
  if (pos(entry.low)) return entry.low;
  if (pos(entry.high)) return entry.high;
  return null;
}

export function getBestPriceRow(prices) {
  if (!Array.isArray(prices) || prices.length === 0) return null;

  const pref = ["normal", "holofoil", "reverseHolofoil"];

  for (const key of pref) {
    const row = prices.find(
      (p) =>
        (p?.variation || "").toLowerCase() === key.toLowerCase() &&
        pickDisplayPrice(p) != null
    );

    if (row) return row;
  }

  return prices.find((p) => pickDisplayPrice(p) != null) || null;
}

export function formatGBP(value) {
  if (value == null || Number.isNaN(value)) return `${GBP_SYMBOL}--`;
  return `${GBP_SYMBOL}${Number(value).toFixed(2)}`;
}

export function canonicalCardKey(card, fallbackIndex = 0) {
  if (!card) return `card-${fallbackIndex}`;

  const id = card.cardId || card.id;
  if (id) return id;

  const setCode = card.set || card.setCode;
  const number = card.number;

  if (setCode || number) {
    const setPart = setCode ? String(setCode).toLowerCase() : "set";
    const numPart = number ? String(number).toLowerCase() : "card";
    return `${setPart}-${numPart}`;
  }

  if (card.name) {
    return `${String(card.name).toLowerCase()}-${fallbackIndex}`;
  }

  return `card-${fallbackIndex}`;
}

export function mergeCardLists(existing, incoming) {
  const base = Array.isArray(existing) ? [...existing] : [];
  if (!Array.isArray(incoming) || incoming.length === 0) return base;

  const indexByKey = new Map();

  base.forEach((card, idx) => {
    indexByKey.set(canonicalCardKey(card, idx), idx);
  });

  incoming.forEach((card, idx) => {
    const key = canonicalCardKey(card, base.length + idx);

    if (indexByKey.has(key)) {
      base[indexByKey.get(key)] = card;
    } else {
      indexByKey.set(key, base.length);
      base.push(card);
    }
  });

  return base;
}

export function makeQueryKey({ name, setCode, number }) {
  return JSON.stringify({
    name: (name || "").trim().toLowerCase(),
    set: (setCode || "").trim().toLowerCase(),
    number: (number || "").trim(),
  });
}

const RARITY_ORDER = {
  Common: 1,
  "Common ": 1,
  Uncommon: 2,
  Rare: 3,
  "Double rare": 4,
  "Ultra rare": 5,
  "Illustration rare": 6,
  "Special Illustration Rare": 7,
  "Hyper rare": 8,
};

export function applyFiltersAndSort(cards, filters) {
  if (!Array.isArray(cards) || cards.length === 0 || !filters) return cards;

  const {
    minPrice,
    maxPrice,
    rarities,
    variations,
    sortBy,
    onlyHasPrices,
    onlyHasReverse,
  } = filters;

  const min = minPrice !== "" ? parseFloat(minPrice) : null;
  const max = maxPrice !== "" ? parseFloat(maxPrice) : null;

  const raritySet = new Set(rarities || []);
  const variationSet = new Set(variations || []);

  const hasRarityFilter = raritySet.size > 0;
  const hasVariationFilter = variationSet.size > 0;

  let filtered = cards.filter((card) => {
    const bestRow = getBestPriceRow(card.prices);
    const price = pickDisplayPrice(bestRow);

    if (onlyHasPrices && (price == null || Number.isNaN(price))) return false;
    if (min != null && price != null && price < min) return false;
    if (max != null && price != null && price > max) return false;

    if (hasRarityFilter) {
      const r = card.rarity || "";
      if (!raritySet.has(r)) return false;
    }

    if (onlyHasReverse) {
      const hasReverse =
        Array.isArray(card.variations) &&
        card.variations.some((v) => String(v).toLowerCase().includes("reverse"));
      if (!hasReverse) return false;
    }

    if (hasVariationFilter) {
      const hasAny =
        Array.isArray(card.variations) &&
        card.variations.some((v) => variationSet.has(v));
      if (!hasAny) return false;
    }

    return true;
  });

  if (!sortBy || sortBy === "relevance") return filtered;

  const sorted = [...filtered];

  sorted.sort((a, b) => {
    const aBest = getBestPriceRow(a.prices);
    const bBest = getBestPriceRow(b.prices);
    const aPrice = pickDisplayPrice(aBest);
    const bPrice = pickDisplayPrice(bBest);

    const aRarity = a.rarity || "";
    const bRarity = b.rarity || "";
    const aRarityRank = RARITY_ORDER[aRarity] ?? 999;
    const bRarityRank = RARITY_ORDER[bRarity] ?? 999;

    const aNum = parseInt(a.number, 10);
    const bNum = parseInt(b.number, 10);

    switch (sortBy) {
      case "price-asc": {
        if (aPrice == null && bPrice == null) return 0;
        if (aPrice == null) return 1;
        if (bPrice == null) return -1;
        return aPrice - bPrice;
      }
      case "price-desc": {
        if (aPrice == null && bPrice == null) return 0;
        if (aPrice == null) return 1;
        if (bPrice == null) return -1;
        return bPrice - aPrice;
      }
      case "rarity-asc":
        return aRarityRank - bRarityRank || aRarity.localeCompare(bRarity);
      case "rarity-desc":
        return bRarityRank - aRarityRank || bRarity.localeCompare(aRarity);
      case "number-asc": {
        if (Number.isNaN(aNum) && Number.isNaN(bNum)) return 0;
        if (Number.isNaN(aNum)) return 1;
        if (Number.isNaN(bNum)) return -1;
        return aNum - bNum;
      }
      case "number-desc": {
        if (Number.isNaN(aNum) && Number.isNaN(bNum)) return 0;
        if (Number.isNaN(aNum)) return 1;
        if (Number.isNaN(bNum)) return -1;
        return bNum - aNum;
      }
      case "name-asc":
        return String(a.name).localeCompare(String(b.name));
      case "name-desc":
        return String(b.name).localeCompare(String(a.name));
      default:
        return 0;
    }
  });

  return sorted;
}
