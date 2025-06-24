// src/modules/search/helpers.js

const fetch = require('node-fetch');
const { Card } = require('../../models');
const { SET_MAPPING } = require('./SetMapping');

// --- Constants ---
const TCGDEX_API = "https://api.tcgdex.net/v2/en/cards";
const POKEMON_TCG_API = "https://api.pokemontcg.io/v2/cards";
const POKEMON_TCG_API_KEY = process.env.POKEMON_TCG_API_KEY || "";

// --- Excluded sets (unreleased, etc) ---
const EXCLUDED_SETS = [
  'SVE', 'M23', 'RM', 'PPS1', 'PPS2', 'PPS3', 'PPS4', 'PPS5', 'PPS6'
];

// --- Utility: Exclude sets ---
function isSetExcluded(setCode) {
  if (!setCode) return false;
  const code = String(setCode).toUpperCase();
  return EXCLUDED_SETS.includes(code);
}

// --- Utility: Build TCGdex → ptcg.io id ---
function tcgdexToPtcgId(tcgdexId) {
  const match = tcgdexId.match(/^([a-z0-9.]+)-0*([0-9]+)$/i);
  if (!match) return tcgdexId;
  const [, tcgdexSet, number] = match;
  for (const code in SET_MAPPING) {
    if (SET_MAPPING[code].tcgdex === tcgdexSet) {
      return `${SET_MAPPING[code].ptcg}-${parseInt(number, 10)}`;
    }
  }
  return tcgdexId;
}

// --- Utility: Get TCGdex set candidates (aliases for search only, NOT for ptcg API) ---
function getAllSetCandidates(setInput) {
  if (!setInput) return [];
  const code = String(setInput).trim().toUpperCase();
  const mapping = SET_MAPPING[code];
  const candidates = new Set();
  if (mapping) {
    [mapping.tcgdex, mapping.ptcg].forEach(val => {
      if (Array.isArray(val)) val.forEach(v => v && candidates.add(v));
      else if (val) candidates.add(val);
    });
  }
  candidates.add(setInput);
  candidates.add(code);
  return Array.from(candidates).filter(x => !!x);
}

// --- Utility: TCGdex fallback image ---
function tcgdexImageUrl(card) {
  if (!card || !card.set || !card.set.id || !(card.localId || card.number)) return "";
  return `https://assets.tcgdex.net/en/${card.set.id}/${card.id}`;
}

// --- Utility: Collect card variations from tcgdex and ptcg.io ---
function collectVariations(tcgdexCard, pkmnCard) {
  let variations = [];
  if (Array.isArray(tcgdexCard?.variations)) variations = tcgdexCard.variations.slice();
  if (pkmnCard?.tcgplayer?.prices) {
    for (const key of Object.keys(pkmnCard.tcgplayer.prices)) {
      if (!variations.includes(key)) variations.push(key);
    }
  }
  return [...new Set(variations)];
}

// --- Utility: Merge all variant prices from ptcg.io/cardmarket ---
/**
 * Merges pricing data from a ptcg.io card response.
 * - pricing.tcgplayer and pricing.cardmarket are for the 'normal' variant.
 * - tcgplayerVariations/cardmarketVariations contains all found variants.
 * - If a variant is not present, its value is null.
 */
function mergePrices(pkmnCard) {
  if (!pkmnCard) {
    // If no data, everything null
    return {
      tcgplayerVariations: { normal: null, reverseHolofoil: null, holofoil: null },
      cardmarketVariations: { normal: null, reverseHolofoil: null, holofoil: null },
      pricing: {
        updated_at: null,
        tcgplayer: { mid: null, market: null, low: null, high: null, direct_low: null },
        cardmarket: { trend: null, low: null, average_sell: null }
      }
    };
  }

  // ---- TCGPLAYER VARIANTS ----
  const tcgplayerPrices = pkmnCard.tcgplayer?.prices || {};

  // Helper: normalize keys (some APIs use directLow instead of direct_low)
  function norm(p) {
    if (!p) return null;
    return {
      direct_low: p.direct_low ?? p.directLow ?? null,
      high: p.high ?? null,
      low: p.low ?? null,
      market: p.market ?? null,
      mid: p.mid ?? null,
    };
  }

  const tcgplayerVariations = {
    normal: tcgplayerPrices.normal ? norm(tcgplayerPrices.normal) : null,
    reverseHolofoil: tcgplayerPrices.reverseHolofoil ? norm(tcgplayerPrices.reverseHolofoil) : null,
    holofoil: tcgplayerPrices.holofoil ? norm(tcgplayerPrices.holofoil) : null,
    // Add more variations here if your API provides them
  };

  // ---- CARDMARKET VARIANTS ----
  // Note: Cardmarket's API structure is different—check if it supports variants per card, or only overall price object.
  // If it only returns one price object per card, you can still return the same value for 'normal' and null for others.

  let cardmarketBase = pkmnCard.cardmarket?.prices || null;
  // Cardmarket on PTCG.io does NOT have variant prices; always applies to the whole card.
  function cmNorm(p) {
    if (!p) return null;
    return {
      average_sell: p.averageSellPrice ?? null,
      low: p.lowPrice ?? null,
      trend: p.trendPrice ?? null
    };
  }
  const cardmarketVariations = {
    normal: cardmarketBase ? cmNorm(cardmarketBase) : null,
    reverseHolofoil: null,
    holofoil: null,
    // If Cardmarket supports more variants in future, add here.
  };

  // ---- pricing: always main variant only ('normal') ----
  const pricing = {
    updated_at: pkmnCard.tcgplayer?.updatedAt || pkmnCard.cardmarket?.updatedAt || null,
    tcgplayer: norm(tcgplayerPrices.normal),
    cardmarket: cmNorm(cardmarketBase),
  };

  return {
    tcgplayerVariations,
    cardmarketVariations,
    pricing
  };
}

// --- Merge/normalize a single card ---
function mergeCardData(tcgdexCard, pkmnCard) {
  if (!tcgdexCard) return {};
  const setObj = tcgdexCard.set || {};
  const variations = collectVariations(tcgdexCard, pkmnCard);

  let image = "";
  if (tcgdexCard.images && (tcgdexCard.images.large || tcgdexCard.images.small)) {
    image = tcgdexCard.images.large || tcgdexCard.images.small;
  } else {
    image = tcgdexImageUrl(tcgdexCard);
    if ((!image || image.endsWith("/undefined")) && pkmnCard?.images?.large) image = pkmnCard.images.large;
    if ((!image || image.endsWith("/undefined")) && pkmnCard?.images?.small) image = pkmnCard.images.small;
  }

  const { tcgplayerVariations, cardmarketVariations, pricing } = mergePrices(pkmnCard);

  return {
    id: tcgdexCard.id,
    name: tcgdexCard.name || "",
    number: tcgdexCard.localId || tcgdexCard.number || "",
    set: setObj.id || "",
    setName: setObj.name || "",
    setLogo: setObj.logo || "",
    setSymbol: setObj.symbol || "",
    image,
    rarity: tcgdexCard.rarity || pkmnCard?.rarity || "",
    edition: tcgdexCard.edition || "",
    variations,
    tcgplayerVariations,
    cardmarketVariations,
    pricing,
  };
}

// --- Main card search (PHP Search.php logic, cleaned and mapped) ---
async function searchCards({ name, set, number, rarity, limit = 30, offset = 0 }, fullData = true) {

  if (set && isSetExcluded(set)) {
    return [];
  }

  // For TCGdex, build candidate list; for ptcg.io, use ONLY the mapped ptcg code
  let candidates = set ? getAllSetCandidates(set) : [];
  const candidate = candidates[0] || set;

  let query = [];
  if (name) query.push(`name=${encodeURIComponent(name)}`);
  if (candidate) query.push(`set=${encodeURIComponent(candidate)}`);
  if (number) query.push(`number=${encodeURIComponent(number)}`);
  if (rarity) query.push(`rarity=${encodeURIComponent(rarity)}`);
  const pageNum = offset ? Math.floor(offset / limit) + 1 : 1;
  query.push(`pagination:itemsPerPage=${limit}`);
  query.push(`pagination:page=${pageNum}`);

  const tcgdexUrl = `${TCGDEX_API}?${query.join("&")}`;

  let tcgdexRes, tcgdexData;
  try {
    tcgdexRes = await fetch(tcgdexUrl);
    tcgdexData = await tcgdexRes.json();
  } catch (e) {
    return [];
  }
  let cardSummaries = Array.isArray(tcgdexData) ? tcgdexData : tcgdexData?.results || [];

  cardSummaries = cardSummaries.filter(c => {
    const setId = c.set?.id || c.id.split('-')[0];
    return setId && !isSetExcluded(setId) && candidates.includes(setId);
  });

  if (!cardSummaries.length) return [];

  return await Promise.all(
    cardSummaries.map(async summary => {
      let detailed = summary;
      if (fullData) {
        try {
          const detailUrl = `${TCGDEX_API}/${summary.id}`;
          const detailRes = await fetch(detailUrl);
          if (detailRes.ok) detailed = await detailRes.json();
        } catch (e) {
          console.error('[searchCards] Error fetching card details from TCGdex:', e);
        }
      }

      // ---- USE THE PTCG MAPPING HERE ----
      let setKey = set ? set.toUpperCase() : "";
      let ptcgSet = SET_MAPPING[setKey]?.ptcg;
      // Fallback: Try to map via TCGdex set code
      if (!ptcgSet && detailed.set?.id) {
        for (const k in SET_MAPPING) {
          if (SET_MAPPING[k].tcgdex === detailed.set.id) {
            ptcgSet = SET_MAPPING[k].ptcg;
            break;
          }
        }
      }
      // Still fallback to set string if no mapping
      if (!ptcgSet) ptcgSet = set;

      const cardNum = String(detailed.localId || detailed.number || "").replace(/^0+/, "");
      let pkmnCard = null;
      if (ptcgSet && cardNum) {
        const ptcgId = `${ptcgSet}-${cardNum}`;
        const ptcgUrl = `${POKEMON_TCG_API}/${ptcgId}`;

        try {
          const pkmnCardRes = await fetch(ptcgUrl, { headers: { "X-Api-Key": POKEMON_TCG_API_KEY } });
          const pkmnCardJson = await pkmnCardRes.json();
          if (pkmnCardJson?.data) {
            pkmnCard = pkmnCardJson.data;
          }
        } catch (e) {
          console.error('[searchCards] Error fetching from PTCG.io by ID:', e);
        }

        if (!pkmnCard) {
          const fallbackUrl = `${POKEMON_TCG_API}?q=set.id:${ptcgSet} number:${cardNum}`;
          try {
            const fallbackRes = await fetch(fallbackUrl, { headers: { "X-Api-Key": POKEMON_TCG_API_KEY } });
            const fallbackJson = await fallbackRes.json();
            if (fallbackJson?.data?.length) {
              pkmnCard = fallbackJson.data[0];
            }
          } catch (e) {
            console.error('[searchCards] Error fetching from PTCG.io fallback:', e);
          }
        }
      }

      if (pkmnCard) {
        await Card.upsert(mergeCardData(detailed, pkmnCard));
      }

      const merged = mergeCardData(detailed, pkmnCard);
      return merged;
    })
  );
}

// --- Fetch by single card id ---
async function getCardById(id) {
  let dbCard = await Card.findByPk(id);
  if (dbCard && dbCard.pricing) return dbCard;

  let tcgdexCard;
  try {
    const tcgdexUrl = `${TCGDEX_API}/${id}`;
    const tcgdexRes = await fetch(tcgdexUrl);
    tcgdexCard = await tcgdexRes.json();
  } catch (e) {
    return {};
  }

  let ptcgSet = null;
  for (const code in SET_MAPPING) {
    if (SET_MAPPING[code].tcgdex === (tcgdexCard.set && tcgdexCard.set.id)) {
      ptcgSet = SET_MAPPING[code].ptcg;
      break;
    }
  }
  const cardNum = String(tcgdexCard.localId || tcgdexCard.number || "").replace(/^0+/, "");
  let ptcgId = ptcgSet && cardNum ? `${ptcgSet}-${cardNum}` : tcgdexToPtcgId(tcgdexCard.id);

  let pkmnCard = null;
  try {
    const ptcgUrl = `${POKEMON_TCG_API}/${ptcgId}`;
    const pkmnCardRes = await fetch(ptcgUrl, { headers: { "X-Api-Key": POKEMON_TCG_API_KEY } });
    const pkmnCardJson = await pkmnCardRes.json();
    pkmnCard = pkmnCardJson?.data || null;

    if (!pkmnCard && ptcgSet && cardNum) {
      const fallbackUrl = `${POKEMON_TCG_API}?q=set.id:${ptcgSet} number:${cardNum}`;
      const fallbackRes = await fetch(fallbackUrl, { headers: { "X-Api-Key": POKEMON_TCG_API_KEY } });
      const fallbackJson = await fallbackRes.json();
      pkmnCard = fallbackJson?.data?.[0] || null;
    }
  } catch (e) {}

  const cardData = mergeCardData(tcgdexCard, pkmnCard);
  await Card.upsert(cardData);

  return cardData;
}

// --- Exported helpers ---
module.exports = {
  searchCards,
  getCardById,
  isSetExcluded,
  getAllSetCandidates,
  tcgdexToPtcgId,
  tcgdexImageUrl,
  collectVariations,
  mergePrices,
  mergeCardData,
};
