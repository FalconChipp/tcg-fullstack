import { Card, CardPriceHistory } from '../../models/index.js';
import { Op } from 'sequelize';

function mapVariationKey(v) {
  switch (v) {
    case 'reverse': return 'reverseHolofoil';
    case 'holo': return 'holofoil';
    case 'firstEdition': return 'firstEdition';
    case 'wPromo': return 'normal';
    default: return 'normal';
  }
}

function computeGBP(tcgPrice, cmkPrice, rates) {
  if (!rates || typeof rates !== 'object') return null;
  const usdRate = Number(rates.USD);
  const eurRate = Number(rates.EUR);
  const raw =
    (tcgPrice != null && usdRate > 0) ? (tcgPrice / usdRate) :
    (cmkPrice != null && eurRate > 0) ? (cmkPrice / eurRate) :
    null;
  return raw == null ? null : Math.round(raw * 100) / 100;
}

function extractVariationKeys(cardData) {
  const variations = cardData?.variants || cardData?.variations || {};
  if (Array.isArray(variations)) return variations.length ? variations : ['normal'];
  if (variations && typeof variations === 'object') {
    const keys = Object.keys(variations).filter(k => variations[k]);
    return keys.length ? keys : ['normal'];
  }
  return ['normal'];
}

function buildLatestArray(cardData, priceData, rates) {
  const keys = extractVariationKeys(cardData);
  const tcg = priceData?.tcgplayer?.prices || {};
  const cmk = priceData?.cardmarket?.prices || {};
  const updatedAt =
    priceData?.tcgplayer?.updatedAt ||
    priceData?.cardmarket?.updatedAt ||
    new Date().toISOString();

  return keys.map(varName => {
    const tk = mapVariationKey(varName);
    let cmkPrice = null;
    if (tk === 'normal') cmkPrice = cmk.trendPrice ?? cmk.averageSellPrice ?? null;
    if (tk === 'reverseHolofoil') cmkPrice = cmk.reverseHoloTrend ?? cmk.reverseHoloSell ?? null;
    if (tk === 'holofoil') cmkPrice = cmk.trendPrice ?? cmk.averageSellPrice ?? null;
    if (tk === 'firstEdition') cmkPrice = cmk.trendPrice ?? null;

    const tcgPrice = tcg[tk]?.market ?? null;
    const cmkVal = cmkPrice;
    return {
      variation: varName,
      tcgplayer: tcgPrice,
      cardmarket: cmkVal,
      gbp: computeGBP(tcgPrice, cmkVal, rates),
      currency: 'GBP',
      updatedAt
    };
  });
}

function hasAnyPrice(latestArray) {
  return latestArray.some(p => p.tcgplayer != null || p.cardmarket != null);
}

function upsertHistory(pricingObj, latestArray, todayISO) {
  const next = { latest: latestArray, history: Array.isArray(pricingObj?.history) ? [...pricingObj.history] : [] };
  const idx = next.history.findIndex(h => h?.date === todayISO);
  const entry = { date: todayISO, prices: latestArray };
  if (idx >= 0) next.history[idx] = entry;
  else next.history.push(entry);
  // keep last 30 days
  next.history.sort((a,b) => a.date.localeCompare(b.date));
  if (next.history.length > 30) {
    next.history = next.history.slice(next.history.length - 30);
  }
  return next;
}

async function recordPriceHistory(cardId, latestArray, priceData, now) {
  const rows = latestArray.map(p => ({
    cardId,
    variation: p.variation,
    tcgplayer: priceData?.tcgplayer?.prices?.[mapVariationKey(p.variation)] || null,
    cardmarket: priceData?.cardmarket?.prices || null,
    gbp: p.gbp,
    currency: p.gbp != null ? 'GBP' : null,
    fetchedAt: now
  }));
  if (rows.length) {
    await CardPriceHistory.bulkCreate(rows);
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    await CardPriceHistory.destroy({ where: { cardId, fetchedAt: { [Op.lt]: cutoff } } });
  }
}

export async function saveOrUpdateCard(cardData, priceData, rates = null) {
  if (!cardData?.id) return;

  const now = new Date();
  const todayISO = now.toISOString().slice(0,10);

  let existing = await Card.findByPk(cardData.id);

  // Always build fields from incoming cardData
  const baseFields = {
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
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  // Build candidate latest array from priceData
  const latestArray = buildLatestArray(cardData, priceData, rates);
  const shouldPersistPrices = hasAnyPrice(latestArray);

  if (!existing) {
    // When inserting new card: persist pricing only if we have any non-null price
    const pricingObj = shouldPersistPrices
      ? upsertHistory({}, latestArray, todayISO)
      : { latest: [], history: [] };

    const insertFields = {
      ...baseFields,
      pricing: JSON.stringify(pricingObj),
      // legacy columns
      tcgplayerLow: priceData?.tcgplayer?.prices?.low ?? null,
      tcgplayerMid: priceData?.tcgplayer?.prices?.mid ?? null,
      tcgplayerHigh: priceData?.tcgplayer?.prices?.high ?? null,
      tcgplayerMarket: priceData?.tcgplayer?.prices?.market ?? null,
      tcgplayerDirectLow: priceData?.tcgplayer?.prices?.directLow ?? null,
      cardmarketAverageSell: priceData?.cardmarket?.prices?.averageSell ?? null,
      cardmarketLowPrice: priceData?.cardmarket?.prices?.lowPrice ?? null,
      cardmarketTrendPrice: priceData?.cardmarket?.prices?.trendPrice ?? null
    };

    await Card.create(insertFields);
    if (shouldPersistPrices) {
      await recordPriceHistory(cardData.id, latestArray, priceData, now);
    }
    console.log(`[Card DB] Inserted new card: ${cardData.id}`);
    return;
  }

  // UPDATE existing
  // Start with current pricing object (string or object)
  let currentPricing = {};
  try {
    currentPricing = typeof existing.pricing === 'string' ? JSON.parse(existing.pricing) : (existing.pricing || {});
  } catch { currentPricing = {}; }

  let nextPricing = currentPricing;

  if (shouldPersistPrices) {
    nextPricing = upsertHistory(currentPricing, latestArray, todayISO);

    // Update legacy columns when non-null info present
    existing.tcgplayerLow = priceData?.tcgplayer?.prices?.low ?? existing.tcgplayerLow;
    existing.tcgplayerMid = priceData?.tcgplayer?.prices?.mid ?? existing.tcgplayerMid;
    existing.tcgplayerHigh = priceData?.tcgplayer?.prices?.high ?? existing.tcgplayerHigh;
    existing.tcgplayerMarket = priceData?.tcgplayer?.prices?.market ?? existing.tcgplayerMarket;
    existing.tcgplayerDirectLow = priceData?.tcgplayer?.prices?.directLow ?? existing.tcgplayerDirectLow;
    existing.cardmarketAverageSell = priceData?.cardmarket?.prices?.averageSell ?? existing.cardmarketAverageSell;
    existing.cardmarketLowPrice = priceData?.cardmarket?.prices?.lowPrice ?? existing.cardmarketLowPrice;
    existing.cardmarketTrendPrice = priceData?.cardmarket?.prices?.trendPrice ?? existing.cardmarketTrendPrice;
  } // else skip altering pricing/history/legacy

  // Always update base fields that are missing previously (be conservative)
  Object.assign(existing, {
    name: existing.name ?? baseFields.name,
    number: existing.number ?? baseFields.number,
    set: existing.set ?? baseFields.set,
    setName: existing.setName ?? baseFields.setName,
    setLogo: existing.setLogo ?? baseFields.setLogo,
    setSymbol: existing.setSymbol ?? baseFields.setSymbol,
    image: existing.image ?? baseFields.image,
    rarity: existing.rarity ?? baseFields.rarity,
    edition: existing.edition ?? baseFields.edition,
    variations: baseFields.variations,
    pricing: JSON.stringify(nextPricing),
    updatedAt: now
  });

  await existing.save();
  if (shouldPersistPrices) {
    await recordPriceHistory(cardData.id, latestArray, priceData, now);
    console.log(`[Card DB] Updated prices for: ${cardData.id}`);
  }
}
