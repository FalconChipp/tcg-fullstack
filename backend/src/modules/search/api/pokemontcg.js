// src/modules/search/api/pokemontcg.js

import fetch from 'node-fetch';

const POKEMON_TCG_API = 'https://api.pokemontcg.io/v2';
const API_KEY = process.env.POKEMON_TCG_API_KEY || '';
console.log("[PTCG API] pokemontcg.js module loaded!");


function getHeaders() {
  const headers = {};
  if (API_KEY) headers['X-Api-Key'] = API_KEY;
  return headers;
}

/**
 * Fetch a single card by ID from PokémonTCG.io
 * @param {string} cardId - e.g. 'sv8-16'
 * @returns {Promise<Object>}
 */
export async function fetchPTCGCardById(cardId) {
  const url = `${POKEMON_TCG_API}/cards/${encodeURIComponent(cardId)}`;
  // console.log(`[fetchPTCGCardById] Request URL: ${url}`);
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    console.error(`[PTCG] Failed to fetch card: ${cardId}, Status: ${res.status}`);
    throw new Error(`[PTCG] Failed to fetch card: ${cardId}`);
  }
  const json = await res.json();
  // console.log(`[fetchPTCGCardById] Response:`, JSON.stringify(json, null, 2));
  return json.data;
}

/**
 * Fetch multiple cards using query (by name, set, number, etc)
 * Always returns an array (may be empty)
 */
export async function fetchPTCGCards({ name, set, number }) {
  let query = '';
  if (name) query += `name:"${name}" `;
  if (set) query += `set.id:"${set}" `;
  if (number) query += `number:"${number}"`;
  const url = `${POKEMON_TCG_API}/cards?q=${encodeURIComponent(query.trim())}`;
  // console.log(`[fetchPTCGCards] Request URL: ${url}`);
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    console.error(`[PTCG] Card search failed. Status: ${res.status}`);
    throw new Error('[PTCG] Card search failed');
  }
  const json = await res.json();
  // console.log(`[fetchPTCGCards] Response:`, JSON.stringify(json, null, 2));
  return json.data || [];
}

/**
 * Fetch pricing information (tcgplayer, cardmarket) for a card by ID
 * Returns: { tcgplayer, cardmarket }
 */
export async function fetchPTCGCardPrices(cardId) {
  try {
    // console.log(`[fetchPTCGCardPrices] Fetching price for ID: ${cardId}`);
    const card = await fetchPTCGCardById(cardId);
    // console.log(`[fetchPTCGCardPrices] Card.tcgplayer:`, card?.tcgplayer);
    // console.log(`[fetchPTCGCardPrices] Card.cardmarket:`, card?.cardmarket);
    return {
      tcgplayer: card?.tcgplayer || null,
      cardmarket: card?.cardmarket || null,
    };
  } catch (e) {
    console.error(`[fetchPTCGCardPrices] Error:`, e);
    return { tcgplayer: null, cardmarket: null };
  }
}

/**
 * Fetch all sets (returns array of {id, name, ...})
 */
export async function fetchPTCGSets() {
  const url = `${POKEMON_TCG_API}/sets`;
  // console.log(`[fetchPTCGSets] Request URL: ${url}`);
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    console.error('[PTCG] Failed to fetch sets. Status:', res.status);
    throw new Error('[PTCG] Failed to fetch sets');
  }
  const json = await res.json();
  // console.log(`[fetchPTCGSets] Response:`, JSON.stringify(json, null, 2));
  return json.data || [];
}

/**
 * Fetch set by ID/code (returns {id, name, ...})
 */
export async function fetchPTCGSetById(id) {
  const url = `${POKEMON_TCG_API}/sets/${encodeURIComponent(id)}`;
  // console.log(`[fetchPTCGSetById] Request URL: ${url}`);
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    console.error(`[PTCG] Failed to fetch set: ${id}. Status: ${res.status}`);
    throw new Error(`[PTCG] Failed to fetch set: ${id}`);
  }
  const json = await res.json();
  // console.log(`[fetchPTCGSetById] Response:`, JSON.stringify(json, null, 2));
  return json.data;
}
