// src/modules/search/api/pokemontcg.js  (ESM)

import helpers from '../helpers.js';
const { withTimeout } = helpers;

const BASE = process.env.POKEMONTCG_BASE ?? 'https://api.pokemontcg.io/v2';
const TIMEOUT_MS = +(process.env.PROVIDER_TIMEOUT_MS ?? 2500);
const API_KEY = process.env.POKEMONTCG_API_KEY;

async function fetchJson(url, timeoutMs = TIMEOUT_MS) {
  const headers = API_KEY ? { 'X-Api-Key': API_KEY } : {};
  return withTimeout(
    fetch(url, { headers }).then((r) => {
      if (!r.ok) throw new Error(`http ${r.status}`);
      return r.json();
    }),
    timeoutMs
  );
}

function mapCard(c) {
  const set = c.set || {};
  const images = c.images || {};
  return {
    id: c.id?.toLowerCase(),
    name: c.name,
    number: c.number,
    set: set.id?.toLowerCase(),
    setName: set.name,
    setLogo: set.images?.logo,
    setSymbol: set.images?.symbol,
    image: images?.small || images?.large,
    rarity: c.rarity,
    variations: c.tcgplayer?.prices ? Object.keys(c.tcgplayer.prices) : [],
  };
}

export async function searchCards({ name = '', set = '', number = '' } = {}) {
  const q = [];
  if (name) q.push(`name:${JSON.stringify(name)}`);
  if (set) q.push(`set.id:${JSON.stringify(set)}`);
  if (number) q.push(`number:${JSON.stringify(number)}`);
  const query = encodeURIComponent(q.join(' '));
  const url =
    `${BASE}/cards?q=${query}` +
    `&orderBy=set.id,number` +
    `&select=id,name,number,images,set,rarity,tcgplayer`;
  try {
    const data = await fetchJson(url);
    return (data?.data || []).map(mapCard);
  } catch {
    return [];
  }
}

export async function getCardById(id) {
  try {
    const data = await fetchJson(`${BASE}/cards/${encodeURIComponent(id)}`);
    const c = data?.data;
    return c ? mapCard(c) : null;
  } catch {
    return null;
  }
}

/** Unified price dict keyed by variation */
export async function getPricesById(id) {
  try {
    const data = await fetchJson(
      `${BASE}/cards/${encodeURIComponent(id)}?select=tcgplayer,cardmarket`
    );
    const c = data?.data;
    const out = {};
    if (c?.tcgplayer?.prices) {
      for (const [k, v] of Object.entries(c.tcgplayer.prices)) {
        out[k] = { ...v };
      }
    }
    if (c?.cardmarket?.prices) {
      const cm = c.cardmarket.prices;
      if (!out.normal) out.normal = {};
      out.normal.averageSellPrice = cm?.averageSellPrice;
      out.normal.lowPrice = cm?.lowPrice;
      out.normal.trendPrice = cm?.trendPrice;

      if (
        cm?.reverseHoloSell != null ||
        cm?.reverseHoloLow != null ||
        cm?.reverseHoloTrend != null
      ) {
        if (!out.reverse) out.reverse = {};
        out.reverse.reverseHoloSell = cm?.reverseHoloSell;
        out.reverse.reverseHoloLow = cm?.reverseHoloLow;
        out.reverse.reverseHoloTrend = cm?.reverseHoloTrend;
      }
    }
    return out;
  } catch {
    return {};
  }
}

// Alias expected by updateCardPrices.js
export const fetchPTCGCardPrices = getPricesById;

// Default export bundle
const api = { searchCards, getCardById, getPricesById, fetchPTCGCardPrices };
export default api;
