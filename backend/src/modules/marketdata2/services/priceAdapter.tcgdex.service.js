// src/modules/marketdata2/services/priceAdapter.tcgdex.service.js
// Builds raw observations for a set from TCGdex prices (Cardmarket in EUR and TCGplayer in USD).
// These are NOT GBP yet. collectPrices.job will apply FX normalization.

import createLogger from './logger.js';
import { fetchSetAndCards } from './setAdapter.tcgdex.service.js'; // reuse to ensure consistent ids

const log = createLogger('md2:price:tcgdex');

function normalizeVariantKey(k) {
  if (!k) return 'normal';
  const s = String(k).toLowerCase();
  if (/(rev|reverse)/.test(s)) return 'reverse';
  if (/holo/i.test(s)) return 'holo';
  if (/1st/.test(s)) return 'first';
  return 'normal';
}

function pickPrice(obj) {
  if (!obj || typeof obj !== 'object') return null;
  // Prefer trend-ish means over wild spikes; fall back gracefully
  return obj?.avgSellPrice ?? obj?.averageSellPrice ?? obj?.lowPrice ?? obj?.market ?? obj?.price ?? null;
}

/**
 * Return array of raw observations: { card_id, variant, source, currency, price_native, observed_at, extras? }
 */
export async function fetchSetPrices(setCode, preloadedCards = null) {
  const cards = Array.isArray(preloadedCards) ? preloadedCards : (await fetchSetAndCards(setCode)).cards;

  const out = [];

  for (const card of cards) {
    const card_id = card?.id || `${setCode}-${String(card?.localId ?? card?.number ?? '').padStart(3, '0')}`;

    // TCGplayer (USD)
    const tp = card?.tcgplayer?.prices || card?.tcgPlayer?.prices || null;
    if (tp && typeof tp === 'object') {
      for (const [k, obj] of Object.entries(tp)) {
        const variant = normalizeVariantKey(k);
        const amount = pickPrice(obj);
        if (amount != null) {
          out.push({
            card_id,
            variant,
            source: 'tcgdex:tcgplayer',
            currency: 'USD',
            price_native: Number(amount),
            observed_at: new Date().toISOString(),
            extras: { raw: obj },
          });
        }
      }
    }

    // Cardmarket (EUR)
    const cm = card?.cardmarket?.prices || card?.cardMarket?.prices || null;
    if (cm && typeof cm === 'object') {
      for (const [k, obj] of Object.entries(cm)) {
        const variant = normalizeVariantKey(k);
        const amount = pickPrice(obj);
        if (amount != null) {
          out.push({
            card_id,
            variant,
            source: 'tcgdex:cardmarket',
            currency: 'EUR',
            price_native: Number(amount),
            observed_at: new Date().toISOString(),
            extras: { raw: obj },
          });
        }
      }
    }
  }

  log.info('tcgdex:collected', { setCode, observations: out.length });
  return out;
}
