// src/modules/search/cardPersistence.js

import { Card } from '../../models/index.js';

// Build pricing array with { variation, tcgplayer, cardmarket, updatedAt }
function buildPriceArray(cardData, priceData) {
  const variations = cardData?.variants || cardData?.variations || {};
  let keys = [];
  if (Array.isArray(variations)) {
    keys = variations;
  } else if (variations && typeof variations === 'object') {
    keys = Object.keys(variations).filter(k => variations[k]);
  }
  if (!keys.length) keys = ['normal'];

  const updatedAt = priceData?.tcgplayer?.updatedAt || priceData?.cardmarket?.updatedAt || null;

  const mapKey = (v) => {
    switch (v) {
      case 'reverse': return 'reverseHolofoil';
      case 'holo': return 'holofoil';
      case 'firstEdition': return 'firstEdition';
      case 'wPromo': return 'normal';
      default: return 'normal';
    }
  };

  return keys.map(varName => {
    const tcgVar = mapKey(varName);
    const tcg = priceData?.tcgplayer?.prices?.[tcgVar] || {};
    const cmk = priceData?.cardmarket?.prices || {};

    let cardmarket = null;
    if (tcgVar === 'normal') cardmarket = cmk.trendPrice ?? cmk.averageSellPrice ?? null;
    if (tcgVar === 'reverseHolofoil') cardmarket = cmk.reverseHoloTrend ?? cmk.reverseHoloSell ?? null;
    if (tcgVar === 'holofoil') cardmarket = cmk.trendPrice ?? cmk.averageSellPrice ?? null;
    if (tcgVar === 'firstEdition') cardmarket = cmk.trendPrice ?? null;

    return {
      variation: varName,
      tcgplayer: tcg?.market ?? null,
      cardmarket,
      updatedAt,
    };
  });
}

/**
 * Save a card fully on initial discovery.
 * - If card exists, only update pricing.
 * - If not, insert the full card data.
 * @param {Object} cardData Card object (from API)
 * @param {Object} priceData Price object (from API)
 */
export async function saveOrUpdateCard(cardData, priceData) {
  if (!cardData?.id) return;

  // Find by PK (id)
  let existing = await Card.findByPk(cardData.id);

  // Build all field mappings (edit as per your schema!)
  const fullFields = {
    id: cardData.id,
    name: cardData.name,
    number: cardData.number,
    set: cardData.set?.id || cardData.set,
    setName: cardData.set?.name || cardData.setName,
    setLogo: cardData.set?.images?.logo || cardData.setLogo,
    setSymbol: cardData.set?.images?.symbol || cardData.setSymbol,
    image: cardData.images?.large || cardData.images?.small || cardData.image,
    rarity: cardData.rarity,
    edition: cardData.supertype || cardData.edition,
    variations: JSON.stringify(cardData.variants || cardData.variations || []),
    pricing: JSON.stringify(buildPriceArray(cardData, priceData)),
    tcgplayerVariations: JSON.stringify(priceData?.tcgplayer?.variants || []),
    cardmarketVariations: JSON.stringify(priceData?.cardmarket?.variants || []),
    tcgplayerLow: priceData?.tcgplayer?.prices?.low,
    tcgplayerMid: priceData?.tcgplayer?.prices?.mid,
    tcgplayerHigh: priceData?.tcgplayer?.prices?.high,
    tcgplayerMarket: priceData?.tcgplayer?.prices?.market,
    tcgplayerDirectLow: priceData?.tcgplayer?.prices?.directLow,
    cardmarketAverageSell: priceData?.cardmarket?.prices?.averageSell,
    cardmarketLowPrice: priceData?.cardmarket?.prices?.lowPrice,
    cardmarketTrendPrice: priceData?.cardmarket?.prices?.trendPrice,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  if (!existing) {
    // --- Create card for the first time (full data) ---
    await Card.create(fullFields);
    console.log(`[Card DB] Inserted new card: ${cardData.id}`);
  } else {
    // --- Update only price fields ---
    existing.pricing = fullFields.pricing;
    existing.tcgplayerLow = fullFields.tcgplayerLow;
    existing.tcgplayerMid = fullFields.tcgplayerMid;
    existing.tcgplayerHigh = fullFields.tcgplayerHigh;
    existing.tcgplayerMarket = fullFields.tcgplayerMarket;
    existing.tcgplayerDirectLow = fullFields.tcgplayerDirectLow;
    existing.cardmarketAverageSell = fullFields.cardmarketAverageSell;
    existing.cardmarketLowPrice = fullFields.cardmarketLowPrice;
    existing.cardmarketTrendPrice = fullFields.cardmarketTrendPrice;
    existing.updatedAt = new Date();
    await existing.save();
    console.log(`[Card DB] Updated prices for: ${cardData.id}`);
  }
}
