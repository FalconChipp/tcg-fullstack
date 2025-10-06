// src/modules/cardsearch/adapters/setAdapter.tcgdex.service.js
// TCGdex adapter: fetch Set + Cards and normalize for our DB schema.
// Uses cachePath.service for local caching.

import {
  withCachePaths,
  saveCacheJSON,
  readCacheJSON,
} from "../services/cachePath.service.js";
import { getLogger } from "../services/logging.service.js";

const log = getLogger("tcgdex.adapter");

const BASE = "https://api.tcgdex.net/v2";
const LOCALE = "en";
const FALLBACK_CARD_LIST_URL = (code) => `${BASE}/${LOCALE}/cards?set.id=${encodeURIComponent(code)}`;
const CARD_DETAIL_URL = (id) => `${BASE}/${LOCALE}/cards/${encodeURIComponent(id)}`;
const DETAIL_CONCURRENCY = 8;
const DETAIL_DELAY_MS = 120;

/** Fetch with small retry */
async function fetchWithRetry(url, { tries = 2, timeoutMs = 15000 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(to);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `HTTP ${res.status} ${res.statusText} for ${url} :: ${body}`
        );
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw lastErr;
}

function normAbbr(v) {
  if (v == null) return null;
  if (typeof v === "object") return v.en || Object.values(v)[0] || null;
  return String(v);
}

function normName(v) {
  if (v == null) return null;
  if (typeof v === "object") return v.en || Object.values(v)[0] || null;
  return String(v);
}

function toNullableInt(value) {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  if (typeof value === "object") {
    const candidate =
      value.total ??
      value.count ??
      value.value ??
      value.amount ??
      value.actual ??
      (Array.isArray(value) && value.length ? value[0] : undefined) ??
      Object.values(value)[0];
    return toNullableInt(candidate);
  }
  return null;
}

function cleanSetCode(value) {
  if (value == null) return null;
  const s = typeof value === "string" ? value.trim() : String(value).trim();
  return s === "" ? null : s;
}

function detectSetCodeFromCard(card) {
  if (!card || typeof card !== "object") return null;
  const fromSet = cleanSetCode(
    card?.set?.id ??
    card?.set?.code ??
    card?.set?.shortCode ??
    card?.set?.shortcode ??
    card?.set?.setCode ??
    card?.set?.tcg_code
  );
  if (fromSet) return fromSet;
  const rawId =
    card?.id ??
    card?.cardId ??
    card?.cardID ??
    card?.card_id ??
    null;
  if (rawId) {
    const str = String(rawId).trim();
    const dash = str.indexOf("-");
    if (dash > 0) {
      return cleanSetCode(str.slice(0, dash));
    }
  }
  return null;
}

/** Normalize TCGdex Set -> our m_Set shape */
function normalizeSet(set) {
  const officialCount = toNullableInt(set?.officialCount);
  const totalCards = toNullableInt(set?.cardCount ?? set?.total ?? set?.card_counts);
  return {
    code: set?.id || set?.code || set?.shortCode || null, // TCGdex commonly uses "id" like 'sv02'
    abbreviation: normAbbr(set?.abbreviation ?? set?.abbr ?? set?.shortCode),
    name: normName(set?.name),
    era: set?.series || null,
    release_date: set?.releaseDate || null,
    official_count: officialCount,
    total_cards: totalCards ?? officialCount,
    set_logo: set?.images?.logo ?? set?.logo ?? null,
    set_symbol: set?.images?.symbol ?? set?.symbol ?? null,
    source_at: new Date().toISOString(),
    generator_version: "tcgdex-v2",
  };
}

/** Normalize a TCGdex card */
function cardIdFromRaw(setCode, card) {
  const fallback = cleanSetCode(setCode);
  if (!card) return fallback ? `${fallback}-` : "";
  const rawId = card.id || card.cardId || card.cardID || card.card_id || null;
  if (rawId) {
    const str = String(rawId).trim();
    if (str.includes('-')) {
      const [rawSet, ...restParts] = str.split('-');
      const normalizedSet = cleanSetCode(rawSet) || fallback;
      const rest = restParts.join('-').trim();
      if (normalizedSet && rest) return `${normalizedSet}-${rest}`;
      if (normalizedSet) return `${normalizedSet}-`;
    }
    if (fallback) return `${fallback}-${str}`;
    return str;
  }
  const local = card.localId ?? card.localID ?? card.number ?? card.no ?? card.cardNumber ?? "";
  const normalizedLocal = String(local || "").trim();
  if (fallback) return `${fallback}-${normalizedLocal}`;
  return normalizedLocal;
}

function normalizeCard(setCode, c) {
  const fallbackSetCode = cleanSetCode(setCode);
  const derivedSetCode = cleanSetCode(detectSetCodeFromCard(c));
  const effectiveSetCode = derivedSetCode || fallbackSetCode;
  const id = cardIdFromRaw(effectiveSetCode || fallbackSetCode, c);
  const cardNumberSource = c?.number ?? c?.localId ?? c?.localID ?? id.split('-').slice(1).join('-');
  const number = String(cardNumberSource || '').trim();
  const imageLink = c?.image || null;
  const images = {
    small: c?.images?.small || imageLink || null,
    large: c?.images?.large || imageLink || null,
  };
  return {
    id,
    set_code: effectiveSetCode || fallbackSetCode || String(setCode || '').trim(),
    number,
    name: normName(c?.name),
    rarity: c?.rarity || null,
    supertype: c?.supertype || null,
    subtype: c?.subtype || null,
    regulation_mark: c?.regulationMark || null,
    image_small: images.small,
    image_large: images.large,
    images,
    illustrator: c?.artist || c?.illustrator || null,
    types: c?.types ?? null,
    subtypes: c?.subtypes ?? null,
  };
}

/** Derive variants list for a card */
function deriveVariants(card) {
  const variants = new Map();
  const add = (raw, label) => {
    const v = canonicalVariantName(raw);
    if (!v) return;
    if (!variants.has(v)) variants.set(v, label || raw || v);
  };

  add('normal', 'normal');

  const detailed = Array.isArray(card?.variants_detailed)
    ? card.variants_detailed
    : Array.isArray(card?.variantsDetailed)
      ? card.variantsDetailed
      : null;
  if (detailed) {
    for (const entry of detailed) {
      if (!entry) continue;
      add(entry.type || entry.variant, entry.displayName || entry.display_name || entry.type);
    }
  }

  const variantsObj = card?.variants || card?.Variants || null;
  if (variantsObj && typeof variantsObj === 'object') {
    for (const [key, value] of Object.entries(variantsObj)) {
      if (value === false || value == null) continue;
      add(key, key);
    }
  }

  if (card?.rarity && /reverse/i.test(card.rarity)) add('reverse', 'reverse');
  if (card?.rarity && /holo/i.test(card.rarity)) add('holo', 'holo');
  if (card?.holo === true) add('holo', 'holo');

  return Array.from(variants, ([variant, label]) => ({ variant, display_name: label || variant }));
}

function hasVariantMetadata(card) {
  if (!card || typeof card !== 'object') return false;
  if (card.variants || card.Variants) return true;
  if (Array.isArray(card.variants_detailed) && card.variants_detailed.length) return true;
  if (Array.isArray(card.variantsDetailed) && card.variantsDetailed.length) return true;
  return false;
}

const VARIANT_CANON_MAP = new Map([
  ['normal', 'normal'],
  ['standard', 'normal'],
  ['default', 'normal'],
  ['regular', 'normal'],
  ['reverse', 'reverse'],
  ['reverseholo', 'reverse'],
  ['reverseholofoil', 'reverse'],
  ['holoreverse', 'reverse'],
  ['reversefoil', 'reverse'],
  ['holo', 'holo'],
  ['holfoil', 'holo'],
  ['holofoil', 'holo'],
  ['shiny', 'holo'],
  ['foil', 'foil'],
  ['firstedition', 'firstEdition'],
  ['1stedition', 'firstEdition'],
  ['firsteditionholo', 'firstEdition'],
]);

function canonicalVariantName(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const key = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return VARIANT_CANON_MAP.get(key) || null;
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

async function hydrateCardsFromListing(list, setCode) {
  const entries = Array.isArray(list)
    ? list
    : Array.isArray(list?.results)
      ? list.results
      : Array.isArray(list?.cards)
        ? list.cards
        : [];

  if (!entries.length) return entries;

  const ids = entries
    .map((item) => {
      if (item?.id) return item.id;
      const local = item?.localId ?? item?.number;
      if (!local) return null;
      return `${setCode}-${String(local).trim()}`;
    })
    .filter(Boolean);

  if (!ids.length) return entries;

  const detailed = [];
  for (const group of chunk(ids, DETAIL_CONCURRENCY)) {
    const fetched = await Promise.all(
      group.map(async (id) => {
        try {
          return await fetchWithRetry(CARD_DETAIL_URL(id));
        } catch (err) {
          log.warn("tcgdex.card.detail_fail", {
            id,
            error: err?.message || String(err),
          });
          return null;
        }
      })
    );
    for (const card of fetched) if (card) detailed.push(card);
    if (group.length === DETAIL_CONCURRENCY) {
      await new Promise((r) => setTimeout(r, DETAIL_DELAY_MS));
    }
  }

  return detailed.length ? detailed : entries;
}

async function fetchSet(tcgdexCode) {
  const url = `${BASE}/${LOCALE}/sets/${encodeURIComponent(tcgdexCode)}`;
  return await fetchWithRetry(url);
}

async function fetchSetCards(tcgdexCode) {
  const primaryUrl = `${BASE}/${LOCALE}/sets/${encodeURIComponent(tcgdexCode)}/cards`;
  try {
    return await fetchWithRetry(primaryUrl);
  } catch (err) {
    const message = err?.message || "";
    if (!/404/.test(message)) throw err;
    log.warn("tcgdex.cards.fallback", { set: tcgdexCode, url: primaryUrl });
    const list = await fetchWithRetry(FALLBACK_CARD_LIST_URL(tcgdexCode));
    return await hydrateCardsFromListing(list, tcgdexCode);
  }
}

/**
 * Load from cache if present; else fetch and cache.
 * @returns {{ set: any, cards: any[], variantsByCardId: Record<string,any[]>, cachePaths?: any }}
 */
export async function fetchSetAndCards(tcgdexCode) {
  const { setPath, cardsPath } = withCachePaths(tcgdexCode);

  const setCache = await readCacheJSON(setPath).catch(() => null);
  const cardsCache = await readCacheJSON(cardsPath).catch(() => null);

  if (setCache && cardsCache) {
    const hasVariantData = Array.isArray(cardsCache) && cardsCache.some(hasVariantMetadata);
    if (!hasVariantData) {
      return await refreshSetAndCards(tcgdexCode);
    }
    const set = normalizeSet(setCache);
    const rawCards = Array.isArray(cardsCache) ? cardsCache : [];
    const cards = [];
    const variantsByCardId = {};
    const expectedLower = cleanSetCode(set.code)?.toLowerCase() ?? null;
    const diverted = [];
    for (const raw of rawCards) {
      const normalized = normalizeCard(set.code, raw);
      if (!normalized || !normalized.id) continue;
      const normalizedSetLower = cleanSetCode(normalized.set_code)?.toLowerCase() ?? null;
      if (expectedLower && normalizedSetLower && normalizedSetLower !== expectedLower) {
        diverted.push({ id: normalized.id, set: normalized.set_code });
        continue;
      }
      cards.push(normalized);
      variantsByCardId[normalized.id] = deriveVariants(raw);
    }
    if (diverted.length) {
      log.info('tcgdex.cards.cache_mismatch', {
        requested: set.code,
        removed: diverted.length,
        examples: diverted.slice(0, 5),
      });
      return await refreshSetAndCards(tcgdexCode);
    }
    return { set, cards, variantsByCardId, cachePaths: { setPath, cardsPath } };
  }

  return await refreshSetAndCards(tcgdexCode);
}

/**
 * Force-refresh from TCGdex and update cache.
 */
export async function refreshSetAndCards(tcgdexCode) {
  log.info("tcgdex.refresh", {
    requested: tcgdexCode,
    usedCode: tcgdexCode,
    via: "cards-query",
  });

  const rawSet = await fetchSet(tcgdexCode);
  const rawCards = await fetchSetCards(tcgdexCode);

  const set = normalizeSet(rawSet);
  let rawCardList = Array.isArray(rawCards)
    ? rawCards
    : Array.isArray(rawCards?.results)
      ? rawCards.results
      : Array.isArray(rawCards?.cards)
        ? rawCards.cards
        : [];

  if (Array.isArray(rawCardList) && rawCardList.length) {
    const lacking = rawCardList.filter((card) => !hasVariantMetadata(card));
    if (lacking.length) {
      const detailed = await hydrateCardsFromListing(lacking, set.code);
      if (Array.isArray(detailed) && detailed.length) {
        const detailMap = new Map(
          detailed
            .filter((c) => c)
            .map((c) => [cardIdFromRaw(set.code, c), c])
        );
        rawCardList = rawCardList.map((card) => {
          const id = cardIdFromRaw(set.code, card);
          return detailMap.get(id) || card;
        });
      }
    }
  }

  const normalizedSetCode = cleanSetCode(set.code);
  if (normalizedSetCode) {
    const requestedLower = normalizedSetCode.toLowerCase();
    const filtered = [];
    const diverted = [];
    for (const card of rawCardList) {
      const actual = cleanSetCode(detectSetCodeFromCard(card));
      if (!actual || actual.toLowerCase() === requestedLower) {
        filtered.push(card);
      } else {
        diverted.push({
          id: card?.id ?? card?.cardId ?? card?.localId ?? card?.localID ?? null,
          set: actual,
        });
      }
    }
    if (diverted.length) {
      log.info('tcgdex.cards.filtered_mismatch', {
        requested: normalizedSetCode,
        removed: diverted.length,
        examples: diverted.slice(0, 5),
      });
    }
    rawCardList = filtered;
  }

  const cards = [];
  const variantsByCardId = {};
  for (const raw of rawCardList) {
    const normalized = normalizeCard(set.code, raw);
    if (!normalized || !normalized.id) continue;
    cards.push(normalized);
    variantsByCardId[normalized.id] = deriveVariants(raw);
  }

  // Save cache
  const { setPath, cardsPath } = withCachePaths(tcgdexCode);
  await saveCacheJSON(setPath, rawSet).catch(() => {});
  await saveCacheJSON(cardsPath, rawCardList).catch(() => {});

  return { set, cards, variantsByCardId, cachePaths: { setPath, cardsPath } };
}

export default { fetchSetAndCards, refreshSetAndCards };
