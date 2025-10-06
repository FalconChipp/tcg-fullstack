import { getCardImageUrl } from "./imageUtils";
// /src/utils/mapData.js

/**
 * Map raw card data from API/backend to normalized frontend detail structure.
 * Ensures all necessary fields are present for detail modals, add-to-collection, and display.
 */
export function mapCardToDetail(card) {
  if (!card) return {};

  // If new backend prices array provided, convert to legacy fields
  if (Array.isArray(card.prices)) {
    if (!card.tcgplayerVariations) card.tcgplayerVariations = {};
    if (!card.cardmarketVariations) card.cardmarketVariations = {};
    if (!card.pricing) card.pricing = { tcgplayer: {}, cardmarket: {}, updated_at: null };
    if (!card.pricing.tcgplayer) card.pricing.tcgplayer = card.pricing.tcgplayer || {};
    if (!card.pricing.cardmarket) card.pricing.cardmarket = card.pricing.cardmarket || {};

    for (const p of card.prices) {
      if (!p) continue;
      const rawKey = String(p.variation || p.variant || 'normal').toLowerCase();
      const key = rawKey === 'reverse' || rawKey === 'reverse holo' || rawKey === 'reverse-holo' ? 'reverseHolofoil'
        : rawKey === 'holo' || rawKey === 'holofoil' ? 'holofoil'
        : rawKey;
      if (!card.tcgplayerVariations[key]) card.tcgplayerVariations[key] = {};
      if (!card.cardmarketVariations[key]) card.cardmarketVariations[key] = {};

      const provider = typeof p.provider === 'string' ? p.provider.toLowerCase() : '';
      const preferred = (typeof p.tcgplayer === 'number' && Number.isFinite(p.tcgplayer)) ? p.tcgplayer
        : (typeof p.cardmarket === 'number' && Number.isFinite(p.cardmarket)) ? p.cardmarket
        : (typeof p.market === 'number' && Number.isFinite(p.market)) ? p.market
        : (typeof p.mid === 'number' && Number.isFinite(p.mid)) ? p.mid
        : (typeof p.low === 'number' && Number.isFinite(p.low)) ? p.low
        : (typeof p.high === 'number' && Number.isFinite(p.high)) ? p.high
        : null;

      const tcgValue =
        typeof p.tcgplayer === 'number' && Number.isFinite(p.tcgplayer)
          ? p.tcgplayer
          : provider.includes('tcg')
            ? preferred
            : null;
      const cardmarketValue =
        typeof p.cardmarket === 'number' && Number.isFinite(p.cardmarket)
          ? p.cardmarket
          : provider.includes('cardmarket')
            ? preferred
            : null;

      if (tcgValue != null) card.tcgplayerVariations[key].market = tcgValue;
      if (cardmarketValue != null) card.cardmarketVariations[key].average_sell = cardmarketValue;

      if (key === 'normal') {
        if (tcgValue != null) card.pricing.tcgplayer.market = tcgValue;
        if (cardmarketValue != null) card.pricing.cardmarket.average_sell = cardmarketValue;
        if (p.updatedAt) card.pricing.updated_at = p.updatedAt;
      }
    }
  }

  // Fallbacks
  const fallbackImage = "https://cdn.pidgi.net/images/f/f6/Card_back_INTL_-_Pokemon_Trading_Card_Game.png";
  const fallbackSetLogo = "https://placehold.co/50x50/webp?text=Set";

  // -- Variations (always array, always same order for frontend UI) --
  const defaultVariations = ["normal", "reverseHolofoil", "holofoil"];
  const variationArray = Array.isArray(card.variations) ? card.variations.map((v) => String(v).toLowerCase()) : [];
  const availableVariations = Array.isArray(card.variations)
    ? defaultVariations.filter((v) => variationArray.includes(v.toLowerCase()))
    : [];

  // -- Build TCGDex image URL from card and set IDs --   
  let imageBase = fallbackImage;
  if (card.id && typeof card.id === "string" && card.id.includes("-")) {
    const [setId, num] = card.id.split("-");
    // Extract series prefix (e.g. "sv" from "sv08")
    const seriesIdMatch = setId.match(/^[a-zA-Z]+/);
    const seriesId = seriesIdMatch ? seriesIdMatch[0] : setId;
    const number = num;
    imageBase = `https://assets.tcgdex.net/en/${seriesId}/${setId}/${number}`;
    // console.log([seriesId, setId, number, imageBase]);
  } else if (card.image && typeof card.image === "string" && card.image.startsWith("http")) {
    imageBase = card.image;
  }

// imageBase is always set to something valid here.


  // Helper: get the first variant (for fallbacks)
  function firstAvailableTCGP() {
    for (const v of defaultVariations) {
      if (card.tcgplayerVariations?.[v]?.market != null)
        return card.tcgplayerVariations[v].market;
    }
    return null;
  }
  function firstAvailableCMKT() {
    for (const v of defaultVariations) {
      if (card.cardmarketVariations?.[v]?.average_sell != null)
        return card.cardmarketVariations[v].average_sell;
    }
    return null;
  }

  // --- Pricing: show the "normal" price if available, otherwise the first non-null variant price
  const tcgplayerMarket =
    card.pricing?.tcgplayer?.market ??
    card.tcgplayerVariations?.normal?.market ??
    firstAvailableTCGP() ??
    null;

  const cardmarketAverageSell =
    card.pricing?.cardmarket?.average_sell ??
    card.cardmarketVariations?.normal?.average_sell ??
    firstAvailableCMKT() ??
    null;

  if (card.pricing) {
    const average =
      tcgplayerMarket != null && cardmarketAverageSell != null
        ? (tcgplayerMarket + cardmarketAverageSell) / 2
        : tcgplayerMarket ?? cardmarketAverageSell ?? null;
    card.pricing.average = average;
  }

  return {
    // --- Names and numbers ---
    name: card.name || "",
    tcgName: card.name || "",  // For modal fallback
    cardId: card.id || card.externalId || "",
    number: card.number || "",
    tcgNumber: card.number || "",
    tcgSetName: card.setName || "",
    setName: card.setName || "",
    tcgRarity: card.rarity || "",
    rarity: card.rarity || "",
    tcgEdition: card.edition || "",
    edition: card.edition || "",

    // --- Set images/logos ---
    tcgImageUrl: getCardImageUrl(imageBase),
    setLogo: card.setLogo || fallbackSetLogo,
    setSymbol: card.setSymbol || "",

    // --- Variations ---
    variations: availableVariations,
    variation: card.variation || (availableVariations.length > 0 ? availableVariations[0] : "normal"),

    // --- Pricing (main summary, per-variation, and raw) ---
    tcgplayerMarket: tcgplayerMarket,
    tcgplayerMarketReverse: card.tcgplayerVariations?.reverseHolofoil?.market ?? null,
    tcgplayerMarketHolo: card.tcgplayerVariations?.holofoil?.market ?? null,

    cardmarketAverageSell: cardmarketAverageSell,
    cardmarketAverageSellReverse: card.cardmarketVariations?.reverseHolofoil?.average_sell ?? null,
    cardmarketAverageSellHolo: card.cardmarketVariations?.holofoil?.average_sell ?? null,

    pricing: card.pricing || {},

    // --- All per-variation data (for UI modals etc) ---
    tcgplayerVariations: card.tcgplayerVariations || {},
    cardmarketVariations: card.cardmarketVariations || {},

    // --- Collection info (user, default as not owned) ---
    quantity: card.quantity ?? 0,
    condition: card.condition ?? null,

    // --- Notes or custom user fields ---
    notes: card.notes || "",

    // --- Last updated date (for UI freshness) ---
    updated_at: card.pricing?.updated_at || null,
    prices: card.prices || [],
  };
}
