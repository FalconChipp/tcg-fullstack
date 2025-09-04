// src/modules/search/api/tcgdex.js  (ESM)

import helpers from '../helpers.js';
const { withTimeout } = helpers;

const BASE = process.env.TCGDEX_BASE ?? 'https://api.tcgdex.net/v2/en';
const TIMEOUT_MS = +(process.env.PROVIDER_TIMEOUT_MS ?? 2500);

async function fetchJson(url, timeoutMs = TIMEOUT_MS) {
  return withTimeout(
    fetch(url).then((r) => {
      if (!r.ok) throw new Error(`http ${r.status}`);
      return r.json();
    }),
    timeoutMs
  );
}

export async function searchCards({ name = '', set = '', number = '' } = {}) {
  let list = [];
  try {
    if (set) {
      const setNorm = set.toLowerCase();
      const data = await fetchJson(`${BASE}/sets/${encodeURIComponent(setNorm)}`);
      list = (data?.cards || []).map((c) => ({
        id: c.id,
        name: c.name,
        number: c.localId || c.number || c.id?.split('-').pop(),
        set: setNorm,
        setName: data?.name,
        setLogo: data?.logo,
        setSymbol: data?.symbol,
        image: c.image,
        rarity: c.rarity,
      }));
    } else {
      const data = await fetchJson(`${BASE}/cards`);
      list = (data || []).map((c) => ({
        id: c.id,
        name: c.name,
        number: c.localId || c.number || c.id?.split('-').pop(),
        set: c.set?.id,
        setName: c.set?.name,
        setLogo: c.set?.logo,
        setSymbol: c.set?.symbol,
        image: c.image,
        rarity: c.rarity,
      }));
    }
  } catch {
    list = [];
  }

  const n = name.toLowerCase();
  return list.filter((c) => {
    if (name && !(c.name || '').toLowerCase().includes(n)) return false;
    if (number && (c.number || '').toString().toLowerCase() !== number.toString().toLowerCase())
      return false;
    return true;
  });
}

export async function getCardById(id) {
  try {
    const data = await fetchJson(`${BASE}/cards/${encodeURIComponent(id)}`);
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      number: data.localId || data.number || data.id?.split('-').pop(),
      set: data.set?.id,
      setName: data.set?.name,
      setLogo: data.set?.logo,
      setSymbol: data.set?.symbol,
      image: data.image,
      rarity: data.rarity,
    };
  } catch {
    return null;
  }
}

const api = { searchCards, getCardById };
export default api;
