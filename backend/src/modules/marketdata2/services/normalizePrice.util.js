// src/modules/marketdata2/services/normalizePrice.util.js
// PURPOSE
// - Normalize provider price blobs into observations in GBP.
// - Drop zeros/NaN; round to 2dp.
//
// CHANGES
// - Implemented fully (file previously stubbed with ...)

const round2 = (n) => (n == null || !Number.isFinite(+n) ? null : +(+n).toFixed(2));

export function toGBP(amount, currency, fxUSD_GBP = 1.0, fxEUR_GBP = 1.0) {
  const a = Number(amount);
  if (!(a > 0)) return null;

  switch (String(currency).toUpperCase()) {
    case 'GBP':
      return round2(a);
    case 'USD':
      return round2(a * (Number(fxUSD_GBP) || 1.0));
    case 'EUR':
      return round2(a * (Number(fxEUR_GBP) || 1.0));
    default:
      return null;
  }
}

export function normalizeObservation({ card_id, variant, source, currency, amount, observed_at }, fx) {
  const price_gbp = toGBP(amount, currency, fx?.USD_GBP, fx?.EUR_GBP);
  if (price_gbp == null) return null;
  return {
    card_id,
    variant,
    source,
    currency,
    price_gbp,
    observed_at: observed_at || new Date().toISOString(),
  };
}
