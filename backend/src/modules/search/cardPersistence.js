// src/modules/search/cardPersistence.js
import { Card, CardPriceHistory } from '../../models/index.js';
import { Op } from 'sequelize';

/**
 * Normalize variation labels to PokémonTCG price keys.
 */
function mapVariationKey(v) {
  switch (v) {
    case 'reverse': return 'reverseHolofoil';
    case 'holo': return 'holofoil';
    case 'firstEdition': return 'firstEdition';
    case 'wPromo': return 'normal';
    default: return 'normal';
  }
}

/**
 * Your exchangeRates service returns:
 *  - rates.USD = USD per 1 GBP
 *  - rates.EUR = EUR per 1 GBP
 * So: GBP = USD / rates.USD, and GBP = EUR / rates.EUR
 */
function usdToGbp(x, rates) {
  const r = Number(rates?.USD);
  return (x != null && r > 0) ? Math.round((x / r) * 100) / 100 : null;
}
function eurToGbp(x, rates) {
  const r = Number(rates?.EUR);
  return (x != null && r > 0) ? Math.round((x / r) * 100) / 100 : null;
}

/**
 * Back-compat single-field GBP chooser (prefer TCGplayer).
 * Kept because your history row also stores a single gbp column.
 */
function computeGBP(tcgPriceUSD, cmkPriceEUR, rates) {
  if (!rates || (rates.USD == null && rates.EUR == null)) return null;
  const tcgGBP = usdToGbp(tcgPriceUSD, rates);
  if (tcgGBP != null) return tcgGBP;
  const cmkGBP = eurToGbp(cmkPriceEUR, rates);
  return cmkGBP;
}

/**
 * Get the variations that exist on a card.
 * Supports tcgdex `variants` (object) and older `variations` shapes.
 */
function extractVariationKeys(cardData) {
  const variations = cardData?.variants || cardData?.variations || {};
  if (Array.isArray(variations)) return variations.length ? variations : ['normal'];
  if (variations && typeof variations === 'object') {
    const keys = Object.keys(variations).filter(k => variations[k]);
    return keys.length ? keys : ['normal'];
  }
  return ['normal'];
}

/**
 * Build the pricing.latest array using raw vendor blobs (USD/EUR) and
 * convert each vendor’s price to GBP per variation for your UI.
 *
 * priceData shape (from pokemontcg.io):
 * {
 *   tcgplayer: { prices: { [variationKey]: { market, low, mid, high, ... } }, updatedAt? }
 *   cardmarket: { prices: { trendPrice, averageSellPrice, reverseHoloTrend, ... }, updatedAt? }
 * }
 */
function buildLatestArray(cardData, priceData, rates) {
  const keys = extractVariationKeys(cardData);
  const tcg = priceData?.tcgplayer?.prices || {};
  const cmk = priceData?.cardmarket?.prices || {};

  const updatedAtRaw =
    priceData?.tcgplayer?.updatedAt ||
    priceData?.cardmarket?.updatedAt ||
    new Date().toISOString();

  // keep your frontend-friendly date (YYYY/MM/DD)
  const updatedAt = updatedAtRaw.slice(0, 10).replaceAll('-', '/');

  return keys.map(varName => {
    const tk = mapVariationKey(varName);

    // --- TCGplayer (USD) ---
    // Try market, fall back to mid/low if market missing.
    const tcgUSD =
      tcg[tk]?.market ??
      tcg[tk]?.mid ??
      tcg[tk]?.low ??
      null;
    const tcgGBP = usdToGbp(tcgUSD, rates);

    // --- Cardmarket (EUR) ---
    let cmkEUR = null;
    if (tk === 'normal')               cmkEUR = cmk.trendPrice ?? cmk.averageSellPrice ?? null;
    else if (tk === 'reverseHolofoil') cmkEUR = cmk.reverseHoloTrend ?? cmk.reverseHoloSell ?? null;
    else if (tk === 'holofoil')        cmkEUR = cmk.trendPrice ?? cmk.averageSellPrice ?? null;
    else if (tk === 'firstEdition')    cmkEUR = cmk.trendPrice ?? null;

    const cmkGBP = eurToGbp(cmkEUR, rates);

    return {
      variation: varName,
      // IMPORTANT: store GBP numbers per vendor key for UI
      tcgplayer: tcgGBP,
      cardmarket: cmkGBP,
      // single gbp field kept for compatibility (prefer tcg if present)
      gbp: (tcgGBP != null) ? tcgGBP : cmkGBP,
      currency: 'GBP',
      updatedAt
    };
  });
}

/**
 * Should we persist pricing at all? (skip rows where both vendors are null)
 */
function hasAnyPrice(latestArray) {
  return latestArray.some(p => p.tcgplayer != null || p.cardmarket != null);
}

/**
 * Merge today’s latest into pricing.history (max 30 entries, by date).
 */
function upsertHistory(pricingObj, latestArray, todayISO) {
  const next = {
    latest: latestArray,
    history: Array.isArray(pricingObj?.history) ? [...pricingObj.history] : []
  };
  const idx = next.history.findIndex(h => h?.date === todayISO);
  const entry = { date: todayISO, prices: latestArray };
  if (idx >= 0) next.history[idx] = entry;
  else next.history.push(entry);

  next.history.sort((a, b) => a.date.localeCompare(b.date));
  if (next.history.length > 30) {
    next.history = next.history.slice(next.history.length - 30);
  }
  return next;
}

/**
 * Append raw vendor blobs + GBP to the CardPriceHistory table.
 * We write one row per variation so you can reconstruct charts later.
 */
async function recordPriceHistory(cardId, latestArray, priceData, now) {
  const rows = latestArray.map(p => ({
    cardId,
    variation: p.variation,
    // store the RAW vendor slice for this variation (not GBP) for provenance
    tcgplayer: priceData?.tcgplayer?.prices?.[mapVariationKey(p.variation)] || null,
    cardmarket: priceData?.cardmarket?.prices || null,
    // store the single-number GBP you display in charts
    gbp: p.gbp,
    currency: p.gbp != null ? 'GBP' : null,
    fetchedAt: now
  }));
  if (rows.length) {
    await CardPriceHistory.bulkCreate(rows);
    // prune >30 days
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    await CardPriceHistory.destroy({ where: { cardId, fetchedAt: { [Op.lt]: cutoff } } });
  }
}

/**
 * Main entry: create or update the Card row and embed pricing/history.
 * - cardData: hydrated tcgdex card
 * - priceData: raw vendor blobs from pokemontcg (or null)
 * - rates: { USD: number, EUR: number } (vendor currency per 1 GBP)
 */
export async function saveOrUpdateCard(cardData, priceData, rates = null) {
  if (!cardData?.id) return;

  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);

  let existing = await Card.findByPk(cardData.id);

  // Base card fields (be conservative when updating existing below)
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

  // Build latest array (GBP per vendor)
  const latestArray = buildLatestArray(cardData, priceData || {}, rates);
  const shouldPersistPrices = hasAnyPrice(latestArray);

  if (!existing) {
    // On insert, store pricing only if we have any price
    const pricingObj = shouldPersistPrices
      ? upsertHistory({}, latestArray, todayISO)
      : { latest: [], history: [] };

    // Legacy numeric columns (leave as-is; many upstreams don’t use these now)
    const insertFields = {
      ...baseFields,
      pricing: JSON.stringify(pricingObj),

      // Legacy columns — we only fill if vendor provides top-level fields
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
      await recordPriceHistory(cardData.id, latestArray, priceData || {}, now);
    }
    console.log(`[Card DB] Inserted new card: ${cardData.id}`);
    return;
  }

  // UPDATE existing
  // Start with current pricing object (string or object)
  let currentPricing = {};
  try {
    currentPricing = typeof existing.pricing === 'string'
      ? JSON.parse(existing.pricing)
      : (existing.pricing || {});
  } catch { currentPricing = {}; }

  let nextPricing = currentPricing;

  if (shouldPersistPrices) {
    nextPricing = upsertHistory(currentPricing, latestArray, todayISO);

    // Update legacy columns only if new values exist; otherwise keep old
    existing.tcgplayerLow = priceData?.tcgplayer?.prices?.low ?? existing.tcgplayerLow;
    existing.tcgplayerMid = priceData?.tcgplayer?.prices?.mid ?? existing.tcgplayerMid;
    existing.tcgplayerHigh = priceData?.tcgplayer?.prices?.high ?? existing.tcgplayerHigh;
    existing.tcgplayerMarket = priceData?.tcgplayer?.prices?.market ?? existing.tcgplayerMarket;
    existing.tcgplayerDirectLow = priceData?.tcgplayer?.prices?.directLow ?? existing.tcgplayerDirectLow;

    existing.cardmarketAverageSell = priceData?.cardmarket?.prices?.averageSell ?? existing.cardmarketAverageSell;
    existing.cardmarketLowPrice = priceData?.cardmarket?.prices?.lowPrice ?? existing.cardmarketLowPrice;
    existing.cardmarketTrendPrice = priceData?.cardmarket?.prices?.trendPrice ?? existing.cardmarketTrendPrice;
  }

  // Conservatively fill missing base fields; always refresh variations & pricing blob
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
    await recordPriceHistory(cardData.id, latestArray, priceData || {}, now);
    console.log(`[Card DB] Updated prices for: ${cardData.id}`);
  }
}
