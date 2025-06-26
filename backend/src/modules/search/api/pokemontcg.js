// src/modules/search/api/pokemontcg.js
import fetch from 'node-fetch';

const POKEMON_TCG_API = 'https://api.pokemontcg.io/v2';
const API_KEY = process.env.POKEMON_TCG_API_KEY || '';

function getHeaders() {
  const headers = {};
  if (API_KEY) headers['X-Api-Key'] = API_KEY;
  return headers;
}

// Fetch a single card by ID (e.g. 'sv8-16')
export async function fetchPTCGCardById(cardId) {
  const url = `${POKEMON_TCG_API}/cards/${encodeURIComponent(cardId)}`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) throw new Error(`[PTCG] Failed to fetch card: ${cardId}`);
  const { data } = await res.json();
  return data;
}

// Fetch multiple cards (supports name/set/number queries, always returns array)
export async function fetchPTCGCards({ name, set, number }) {
  let query = '';
  if (name) query += `name:"${name}" `;
  if (set) query += `set.id:"${set}" `;
  if (number) query += `number:"${number}"`;
  const url = `${POKEMON_TCG_API}/cards?q=${encodeURIComponent(query.trim())}`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) throw new Error('[PTCG] Card search failed');
  const { data } = await res.json();
  return data || [];
}

// Fetch cardmarket/tcgplayer pricing for a card by ID (returns {tcgplayer, cardmarket})
export async function fetchPTCGCardPrices(cardId) {
  const card = await fetchPTCGCardById(cardId);
  return {
    tcgplayer: card?.tcgplayer || null,
    cardmarket: card?.cardmarket || null,
  };
}

// Fetch all sets (returns array of {id, name, ...})
export async function fetchPTCGSets() {
  const url = `${POKEMON_TCG_API}/sets`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) throw new Error('[PTCG] Failed to fetch sets');
  const { data } = await res.json();
  return data || [];
}

// Fetch set by ID/code (returns {id, name, ...})
export async function fetchPTCGSetById(id) {
  const url = `${POKEMON_TCG_API}/sets/${encodeURIComponent(id)}`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) throw new Error(`[PTCG] Failed to fetch set: ${id}`);
  const { data } = await res.json();
  return data;
}
