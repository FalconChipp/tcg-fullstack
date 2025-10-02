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

/** Normalize TCGdex Set -> our m_Set shape */
function normalizeSet(set) {
  return {
    code: set?.id || set?.code || set?.shortCode || null, // TCGdex commonly uses "id" like 'sv02'
    abbreviation: normAbbr(set?.abbreviation ?? set?.abbr ?? set?.shortCode),
    name: normName(set?.name),
    era: set?.series || null,
    release_date: set?.releaseDate || null,
    official_count: set?.officialCount ?? null,
    total_cards: set?.cardCount ?? null,
    set_logo: set?.images?.logo ?? null,
    set_symbol: set?.images?.symbol ?? null,
    source_at: new Date().toISOString(),
    generator_version: "tcgdex-v2",
  };
}

/** Normalize a TCGdex card */
function normalizeCard(setCode, c) {
  const cardNumber = c?.number ?? c?.localId ?? c?.localID ?? "";
  const id = `${setCode}-${cardNumber}`;
  const imageLink = c?.image || null;
  const images = {
    small: c?.images?.small || imageLink || null,
    large: c?.images?.large || imageLink || null,
  };
  return {
    id,
    set_code: setCode,
    number: String(cardNumber || "").trim(),
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
  const variants = new Set();
  variants.add("normal");
  if (card?.rarity && /reverse/i.test(card.rarity)) variants.add("reverse");
  if (card?.holo || /holo/i.test(card?.rarity || "")) variants.add("holo");
  return Array.from(variants).map((v) => ({ variant: v, display_name: v }));
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
    const set = normalizeSet(setCache);
    const cards = (cardsCache || []).map((c) => normalizeCard(set.code, c));
    const variantsByCardId = {};
    for (const card of cards) variantsByCardId[card.id] = deriveVariants(card);
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
  const rawCardList = Array.isArray(rawCards)
    ? rawCards
    : Array.isArray(rawCards?.results)
      ? rawCards.results
      : Array.isArray(rawCards?.cards)
        ? rawCards.cards
        : [];
  const cards = rawCardList.map((c) => normalizeCard(set.code, c));

  const variantsByCardId = {};
  for (const card of cards) variantsByCardId[card.id] = deriveVariants(card);

  // Save cache
  const { setPath, cardsPath } = withCachePaths(tcgdexCode);
  await saveCacheJSON(setPath, rawSet).catch(() => {});
  await saveCacheJSON(cardsPath, rawCardList).catch(() => {});

  return { set, cards, variantsByCardId, cachePaths: { setPath, cardsPath } };
}

export default { fetchSetAndCards, refreshSetAndCards };