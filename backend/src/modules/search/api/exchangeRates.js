// src/modules/search/api/exchangeRates.js
import fetch from 'node-fetch';

let _lastRates = null;
let _lastFetch = 0;

// Fetches GBP, USD, EUR rates (base GBP). Caches for 30 min.
export async function getExchangeRates() {
  const CACHE_MS = 30 * 60 * 1000;
  if (_lastRates && Date.now() - _lastFetch < CACHE_MS) return _lastRates;
  const url = 'https://api.frankfurter.app/latest?from=GBP&to=USD,EUR';
  const res = await fetch(url);
  if (!res.ok) throw new Error('[Rates] Failed to fetch exchange rates');
  const data = await res.json();
  // console.log('[getExchangeRates] API response:', data);
  _lastRates = data.rates;
  _lastFetch = Date.now();
  return _lastRates;
}
// Key 

// Convert amount from a supported currency (USD/EUR/GBP) to GBP.
export async function convertToGBP(amount, currency) {
  if (currency === 'GBP') return amount;
  const rates = await getExchangeRates();
  // console.log('[convertToGBP] Fetched rates:', rates);
  if (!rates || typeof rates[currency] !== 'number')
    throw new Error(`[Rates] Missing rate for ${currency}→GBP`);
  return +(amount / rates[currency]).toFixed(2);  
}
