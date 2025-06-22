// src/modules/search/helpers.js
const axios = require('axios');
const { Card } = require('../../models');

// List of sets to exclude from ALL search results (case-insensitive, code or name)
const EXCLUDED_SETS = [
  // Add your set names and codes below (examples shown)
  'Celebrations',     // Set name
  'SWSH45',           // Set code
  'SV01',             // Set code
  'Base Set',
  'XY12',
  // ...add all codes/names to fully exclude here
];

// API endpoints
const TCG_API_BASE = 'https://api.pokemontcg.io/v2/cards';
const TCGDEX_API_BASE = 'https://tcgdex.vercel.app/api/v2/en/cards';

// Checks if a set (name/code) is excluded
function isSetExcluded(set, setCode) {
  if (!set && !setCode) return false;
  return EXCLUDED_SETS.some(
    s =>
      (set && set.toLowerCase() === s.toLowerCase()) ||
      (setCode && setCode.toLowerCase() === s.toLowerCase())
  );
}

// Checks if a card is from an excluded set
function isCardExcluded(card) {
  return isSetExcluded(card.set, card.setCode);
}

// Map pokemontcg.io card format
function mapPokemonTCGio(card) {
  return {
    id: card.id,
    name: card.name,
    set: card.set?.name || card.set || '',
    setCode: card.set?.id || card.setCode || '',
    number: card.number,
    rarity: card.rarity,
    imageUrl: card.images?.large || card.images?.small || '',
    price: card.cardmarket?.prices?.averageSellPrice || null,
    source: 'pokemontcgio'
  };
}

// Map TCGdex format
function mapTCGDex(card) {
  return {
    id: card.id || `${card.set?.id || card.set}-${card.number}`,
    name: card.name,
    set: card.set?.name || card.set || '',
    setCode: card.set?.id || card.setCode || '',
    number: card.number,
    rarity: card.rarity || '',
    imageUrl: card.image || card.imageUrl || '',
    price: null,
    source: 'tcgdex'
  };
}

// Fetch from pokemontcg.io
async function fetchFromPokemonTCGio({ name, set, setCode, number, rarity, limit, offset }) {
  let apiQuery = [];
  if (name) apiQuery.push(`name:"${name}"`);
  if (set) apiQuery.push(`set.name:"${set}"`);
  if (setCode) apiQuery.push(`set.id:"${setCode}"`);
  if (number) apiQuery.push(`number:"${number}"`);
  if (rarity) apiQuery.push(`rarity:"${rarity}"`);
  const url = `${TCG_API_BASE}?q=${encodeURIComponent(apiQuery.join(' '))}&pageSize=${limit}&page=${Math.floor(offset/limit)+1}`;
  const apiResp = await axios.get(url, {
    headers: { 'X-Api-Key': process.env.POKEMONTCG_API_KEY || '' }
  });
  return apiResp.data.data.map(mapPokemonTCGio);
}

// Fetch from TCGdex
async function fetchFromTCGDex({ name, set, setCode, number, limit }) {
  const url = `${TCGDEX_API_BASE}`;
  const resp = await axios.get(url);
  let results = resp.data;

  if (name) results = results.filter(c => c.name && c.name.toLowerCase().includes(name.toLowerCase()));
  if (set) results = results.filter(c => (c.set?.name || c.set || '').toLowerCase() === set.toLowerCase());
  if (setCode) results = results.filter(c => (c.set?.id || c.setCode || '').toLowerCase() === setCode.toLowerCase());
  if (number) results = results.filter(c => c.number === number);

  return results.slice(0, limit).map(mapTCGDex);
}

// Merge results and remove duplicates by card ID
function mergeAndDedup(primary, secondary) {
  const all = [...primary];
  for (const card of secondary) {
    if (!all.find(c => c.id === card.id)) all.push(card);
  }
  return all;
}

/**
 * Unified search: queries both APIs, merges results, and EXCLUDES sets globally.
 */
async function searchCards({ name, set, setCode, number, rarity, limit = 30, offset = 0 }) {
  // For efficiency, you may skip TCGdex if this set is excluded (optional)
  const skipTCGDex = isSetExcluded(set, setCode);

  const [tcgio, tcgdex] = await Promise.all([
    fetchFromPokemonTCGio({ name, set, setCode, number, rarity, limit, offset }),
    skipTCGDex ? [] : fetchFromTCGDex({ name, set, setCode, number, limit })
  ]);

  // Merge/deduplicate by card id
  const merged = mergeAndDedup(tcgio, tcgdex);

  // Filter out ALL excluded sets, regardless of source
  const filtered = merged.filter(card => !isCardExcluded(card));

  // Cache new cards from pokemontcg.io
  for (const card of tcgio) {
    await Card.upsert(card);
  }

  return filtered.slice(0, limit);
}

// Fetch card by ID, fallback to TCGdex if not found, also enforce exclusion
async function fetchCardById(id) {
  try {
    const resp = await axios.get(`${TCG_API_BASE}/${id}`);
    const card = mapPokemonTCGio(resp.data.data);
    return isCardExcluded(card) ? null : card;
  } catch (e) {
    try {
      const resp = await axios.get(`${TCGDEX_API_BASE}`);
      const found = resp.data.find(c => c.id === id);
      const card = found ? mapTCGDex(found) : null;
      return card && !isCardExcluded(card) ? card : null;
    } catch {
      return null;
    }
  }
}

module.exports = {
  searchCards,
  fetchCardById
};
