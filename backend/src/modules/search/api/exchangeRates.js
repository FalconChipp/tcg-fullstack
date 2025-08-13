// src/modules/search/api/exchangeRates.js
import fetch from 'node-fetch';

let _lastRates = null;
let _lastFetch = 0;

// Fetch GBP→USD,EUR rates once with a 30‑minute in-memory cache.
export async function getExchangeRates() {
  const CACHE_MS = 30 * 60 * 1000;
  if (_lastRates && Date.now() - _lastFetch < CACHE_MS) return _lastRates;

  const key = process.env.EXCHANGERATE_HOST_KEY;
  const url = 'https://api.frankfurter.app/latest?from=GBP&to=USD,EUR';
  const res = await fetch(url, { headers: key ? { Authorization: `Bearer ${key}` } : {} });
  if (!res.ok) throw new Error('[Rates] Failed to fetch exchange rates');
  const data = await res.json();
  _lastRates = data.rates;
  _lastFetch = Date.now();
  return _lastRates;
}

