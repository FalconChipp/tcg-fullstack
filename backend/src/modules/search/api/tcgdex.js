import fetch from 'node-fetch';

const TCGDEX_API_BASE = 'https://api.tcgdex.net/v2/en';

// Fetch a single card by ID
export async function fetchTCGDexCardById(cardId) {
  const url = `${TCGDEX_API_BASE}/cards/${encodeURIComponent(cardId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[TCGDex] Failed to fetch card: ${cardId}`);
  const card = await res.json();
  card.number = card.number || card.localId || "";
  return card;
}

/**
 * TCGDex paged search (robust for all cases).
 * Handles API requirements:
 *   - Only add number if set is present
 *   - If name+number (no set), search by name and filter locally by number
 *   - If number only (no set/name), return no results
 * Handles both array and {data: [], totalCount: N} API responses.
 */
export async function fetchTCGDexCards({ name, set, number, page = 1, pageSize = 25 }) {
  // -- Special Case: number only (invalid for TCGdex) --
  if (number && !name && !set) {
    return { cards: [], total: 0 };
  }

  // -- Case: set + number (TCGdex supports) --
  // -- Case: name only, or set only, or set+name --
  let params = [];
  let filterLocally = false;

  if (name) params.push(`name=${encodeURIComponent(name)}`);
  if (set) params.push(`set=${encodeURIComponent(set)}`);
  // Only add number if set is present
  if (number && set) params.push(`number=${encodeURIComponent(number)}`);

  params.push(`pagination:page=${page}`);
  params.push(`pagination:itemsPerPage=${pageSize}`);
  const url = `${TCGDEX_API_BASE}/cards?${params.join("&")}`;

  // -- If name+number but NO set: do name search, filter by number after fetch
  if (name && number && !set) {
    filterLocally = true;
  }

  // Log the URL for debug
  console.log('[fetchTCGDexCards] Requesting:', url);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`[TCGDex] Card search failed`);

  const raw = await res.text();
  console.log('[fetchTCGDexCards] Raw response:', raw);

  let dataObj;
  try {
    dataObj = JSON.parse(raw);
  } catch (e) {
    throw new Error('[TCGDex] Could not parse response: ' + raw);
  }

  // CASE 1: Flat array response (e.g. search by name)
  let dataArr;
  if (Array.isArray(dataObj)) {
    dataArr = dataObj;
  } else if (Array.isArray(dataObj.data)) {
    dataArr = dataObj.data;
  } else {
    dataArr = [];
  }

  // --- If local filter is needed (name+number, no set), apply it now ---
  if (filterLocally) {
    // Number match: ignore leading zeros for user and localId
    dataArr = dataArr.filter(card =>
      card.localId &&
      card.localId.toString().replace(/^0+/, "") === number.toString().replace(/^0+/, "")
    );
  }

  // Calculate "fake total" for infinite scroll in array-only case:
  let fakeTotal = (dataArr.length === pageSize)
    ? page * pageSize + 1
    : (page - 1) * pageSize + dataArr.length;

  // Return with standard shape (for both array/object response)
  return {
    cards: dataArr.map(card => ({
      ...card,
      number: card.number || card.localId || "",
    })),
    total: Array.isArray(dataObj)
      ? fakeTotal
      : (typeof dataObj.totalCount === "number"
          ? dataObj.totalCount
          : dataArr.length),
  };
}

// Fetch all sets
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
