// src/modules/search/api/tcgdex.js
import fetch from 'node-fetch';

// Base URL for TCGDex API
const TCGDEX_API_BASE = 'https://api.tcgdex.net/v2/en';

// Fetch a single card by ID (e.g. 'sv08-016')
export async function fetchTCGDexCardById(cardId) {
  const url = `${TCGDEX_API_BASE}/cards/${encodeURIComponent(cardId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[TCGDex] Failed to fetch card: ${cardId}`);
  return res.json();
}

// Search for cards by name/set/number (all params optional, exact matching preferred)
export async function fetchTCGDexCards({ name, set, number }) {
  let url = `${TCGDEX_API_BASE}/cards?`;
  if (name) url += `name=${encodeURIComponent(name)}&`;
  if (set) url += `set=${encodeURIComponent(set)}&`;
  if (number) url += `number=${encodeURIComponent(number)}&`;
  url = url.replace(/[&?]$/, ''); // Remove trailing & or ?
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[TCGDex] Card search failed`);
  return res.json();
}

// Fetch all sets (for browsing/search)
export async function fetchTCGDexSets() {
  const url = `${TCGDEX_API_BASE}/sets`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('[TCGDex] Failed to fetch sets');
  return res.json();
}

// Fetch a single set by code (e.g. 'sv08')
export async function fetchTCGDexSetByCode(code) {
  const url = `${TCGDEX_API_BASE}/sets/${encodeURIComponent(code)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[TCGDex] Failed to fetch set: ${code}`);
  return res.json();
}
