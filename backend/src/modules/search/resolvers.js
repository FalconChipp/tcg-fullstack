// src/modules/search/resolvers.js
// Lean search resolvers + connection + robust preview pricing

import {
  normalizeSetCode,
  isSetBlocked,
  tcgdexImageUrl,
  getSetUniqueCardCount,
  getAllRarities,
  getCardPriceCache,
  saveCardPriceCache,
  tcgdexToPtcgId,
  hydrateCard,
  encodeCursor,
  decodeCursor,
  normalizeImage,
} from './helpers.js';

import { fetchTCGDexCards, fetchTCGDexCardById } from './api/tcgdex.js';
import { fetchPTCGCardById, fetchPTCGCardPrices } from './api/pokemontcg.js';
import { getExchangeRates } from './api/exchangeRates.js';
import { saveOrUpdateCard } from './cardPersistence.js';
import { SET_MAPPING } from './SetMapping.js';
import { Card, Listing, Collection, CardPriceHistory } from '../../models/index.js';
import { Op } from 'sequelize';
import pLimit from 'p-limit';

/* =========================
   Tunables
   ========================= */

const PRICE_TIMEOUT_MS = Number(process.env.PRICE_TIMEOUT_MS || 0); // 0 = no hard timeout for enrich pass
const PRICE_CONCURRENCY = Number(process.env.PRICE_CONCURRENCY || 6);
const DEBUG_PRICE = process.env.DEBUG_PRICE ? Number(process.env.DEBUG_PRICE) : 0;

// Snappy preview knobs
const PREVIEW_PRICE_TIMEOUT_MS = Number(process.env.SEARCH_PREVIEW_TIMEOUT_MS || 6500);
const PREVIEW_PRICE_BUDGET = Number(process.env.SEARCH_PRICE_PREVIEW_BUDGET || 8);

// Upstream page sizing (larger default helps fill the window quickly)
const TCGDEX_PROVIDER_MAX_PAGE_SIZE = Number(process.env.TCGDEX_PROVIDER_MAX_PAGE_SIZE || 100);
const DEFAULT_UPSTREAM_PAGE_SIZE    = Math.min(TCGDEX_PROVIDER_MAX_PAGE_SIZE, 100);

/* =========================
   Timing helpers
   ========================= */

const nowMs = () => Number(process.hrtime.bigint() / 1_000_000n);
const delta = (start) => nowMs() - start;
const logTiming = (label, data) =>
  console.log(`[SEARCH][timing] ${JSON.stringify({ ...data, label })}`);

/* =========================
   Small utils
   ========================= */

function withTimeout(promise, ms, label = 'timeout') {
  if (!ms || ms <= 0) return promise;
  let t;
  const timer = new Promise((_, rej) => (t = setTimeout(() => rej(new Error(label)), ms)));
  return Promise.race([promise.finally(() => clearTimeout(t)), timer]);
}
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// --- set helpers (exact matching with robust fallback via ID prefix) ---
const getSetId = (c) => (typeof c?.set === 'object' ? c.set?.id : c?.set) || null;

function idPrefixLooksLikeSet(cardId) {
  if (!cardId) return null;
  const s = String(cardId).toLowerCase();
  const dash = s.indexOf('-');
  if (dash === -1) return null;
  return s.slice(0, dash); // e.g. "sv08" or "sv08.5"
}

function cardBelongsToSet(card, setCode) {
  if (!setCode) return true;
  const want = String(setCode).toLowerCase();
  const sid = getSetId(card);
  if (sid && String(sid).toLowerCase() === want) return true;
  // fallback: derive from id prefix if set is missing/empty
  const fromId = idPrefixLooksLikeSet(card?.id);
  return fromId ? fromId === want : false;
}

/* =========================
   FX conversion
   ========================= */
const gbpFromUSD = (usd, rates) => {
  const USD = Number(rates?.USD), GBP = Number(rates?.GBP);
  if (usd == null || !(USD > 0) || !(GBP > 0)) return null;
  return +(usd * (GBP / USD)).toFixed(2);
};
const gbpFromEUR = (eur, rates) => {
  const EUR = Number(rates?.EUR), GBP = Number(rates?.GBP);
  if (eur == null || !(EUR > 0) || !(GBP > 0)) return null;
  return +(eur * (GBP / EUR)).toFixed(2);
};

/* =========================
   Vendor helpers
   ========================= */

function parseVendorDate(s) {
  if (!s || typeof s !== 'string') return null;
  const norm = s.replace(/\//g, '-');
  const iso = /\d{4}-\d{2}-\d{2}$/.test(norm) ? `${norm}T00:00:00Z` : `${norm.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function maxIsoDate(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;
  return new Date(a) >= new Date(b) ? a : b;
}

function pickPreviewVariation(tpPrices, cmPrices) {
  if (tpPrices?.normal?.market != null) return 'normal';
  if (tpPrices?.holofoil?.market != null) return 'holo';
  if (tpPrices?.reverseHolofoil?.market != null) return 'reverse';
  if (cmPrices?.reverseHoloTrend != null) return 'reverse';
  if (cmPrices?.trendPrice != null || cmPrices?.averageSellPrice != null) return 'normal';
  return 'normal';
}

/* =========================
   Pricing fetchers
   ========================= */

async function fetchPricesWithFallback(ptcgId, { timeoutMs } = {}) {
  let lastErr = null;
  const tPrice = timeoutMs || 7000;
  const tById = Math.max(tPrice, 9000);

  try {
    const prices = await fetchPTCGCardPrices(ptcgId, { timeoutMs: tPrice });
    if (prices && (prices.tcgplayer || prices.cardmarket)) {
      if (DEBUG_PRICE) console.log(`[PRICE][OK] ${ptcgId} via prices endpoint`);
      return { tcgplayer: prices.tcgplayer || null, cardmarket: prices.cardmarket || null };
    }
  } catch (e) {
    lastErr = e;
    if (DEBUG_PRICE) console.log(`[PRICE][ERR] ${ptcgId} prices:`, e?.message || e);
  }

  try {
    const card = await fetchPTCGCardById(ptcgId, { timeoutMs: tById }).catch(() => null);
    const data = card?.data || card;
    if (data && (data.tcgplayer || data.cardmarket)) {
      if (DEBUG_PRICE) console.log(`[PRICE][OK] ${ptcgId} via card-by-id fallback`);
      return { tcgplayer: data.tcgplayer || null, cardmarket: data.cardmarket || null };
    }
  } catch (e) {
    lastErr = e;
    if (DEBUG_PRICE) console.log(`[PRICE][ERR] ${ptcgId} card-by-id:`, e?.message || e);
  }

  if (DEBUG_PRICE) console.log(`[PRICE][FAIL] ${ptcgId}`, lastErr?.message || lastErr);
  return null;
}

/**
 * Preview fetch (single hit) with robust extraction + updatedAt.
 * Returns [{ variation, tcgplayer, cardmarket, gbp, currency, updatedAt }]
 */
async function fetchPreviewLatestGBP(ptcgId, rates, timeoutMs) {
  let data = null;

  const byId = await fetchPTCGCardById(ptcgId, { timeoutMs }).catch(() => null);
  data = byId?.data || byId;
  if (!data) {
    const prices = await fetchPTCGCardPrices(ptcgId, { timeoutMs }).catch(() => null);
    data = prices || null;
  }
  if (!data) return null;

  const tpPrices = data?.tcgplayer?.prices || {};
  const cmPrices = data?.cardmarket?.prices || {};

  const variation = pickPreviewVariation(tpPrices, cmPrices);

  const tcgUSD =
    toNum(tpPrices?.normal?.market) ??
    toNum(tpPrices?.holofoil?.market) ??
    toNum(tpPrices?.reverseHolofoil?.market) ??
    null;

  const cmEUR =
    toNum(cmPrices?.trendPrice) ??
    toNum(cmPrices?.averageSellPrice) ??
    toNum(cmPrices?.reverseHoloTrend) ??
    null;

  const tpUpdated = parseVendorDate(data?.tcgplayer?.updatedAt);
  const cmUpdated = parseVendorDate(data?.cardmarket?.updatedAt);
  const updatedAt = maxIsoDate(tpUpdated, cmUpdated) || new Date().toISOString();

  const gbpTp = gbpFromUSD(tcgUSD, rates);
  const gbpCmk = gbpFromEUR(cmEUR, rates);

  if (gbpTp == null && gbpCmk == null) return null;

  return [
    {
      variation,
      tcgplayer: gbpTp,
      cardmarket: gbpCmk,
      gbp: gbpTp ?? gbpCmk ?? null,
      currency: 'GBP',
      updatedAt,
    },
  ];
}

/* =========================
   Enrichment (persist + hydrate)
   ========================= */

async function enrichCards(cards, { listed, forTrade, rarity }) {
  const t0 = nowMs();
  const limit = pLimit(PRICE_CONCURRENCY);
  const cardIds = cards.map((c) => c.id);

  let rates = null;
  try {
    rates = await getExchangeRates();
  } catch {
    rates = null;
  }

  await Promise.allSettled(
    cards.map((card) =>
      limit(async () => {
        const hydrated =
          (await withTimeout(hydrateCard(card), PRICE_TIMEOUT_MS, 'hydrate-timeout').catch(() => card)) ||
          card;

        let rawPrices = { tcgplayer: null, cardmarket: null };
        const ptcgId = tcgdexToPtcgId(card.id);

        if (ptcgId) {
          let cached = await getCardPriceCache(card.id);
          if (!cached) {
            const fetched = await fetchPricesWithFallback(ptcgId, { timeoutMs: PRICE_TIMEOUT_MS });
            if (fetched) {
              cached = fetched;
              await saveCardPriceCache(card.id, cached).catch(() => {});
            }
          }
          if (cached) rawPrices = cached;
        }

        await saveOrUpdateCard(hydrated, rawPrices, rates).catch(() => {});
      })
    )
  );

  // Optional extras
  let listingsMap = {};
  if (listed) {
    const listings = await Listing.findAll({ where: { cardId: cardIds, status: 'active' } });
    for (const l of listings) {
      if (!listingsMap[l.cardId]) listingsMap[l.cardId] = [];
      listingsMap[l.cardId].push(l.toJSON());
    }
  }

  let forTradeMap = {};
  if (forTrade) {
    const tradeEntries = await Collection.findAll({ where: { cardId: cardIds, wantsTrade: true } });
    for (const entry of tradeEntries) forTradeMap[entry.cardId] = true;
  }

  const dbCards = await Card.findAll({ where: { id: cardIds } });
  const dbMap = new Map(dbCards.map((c) => [c.id, c]));

  const filtered = rarity
    ? cards.filter((c) => (c.rarity || '').toLowerCase() === rarity.toLowerCase())
    : cards;

  const out = filtered.map((card) => {
    const dbCard = dbMap.get(card.id) || card;

    const upstreamSet =
      typeof dbCard.set === 'object'
        ? dbCard.set
        : typeof card.set === 'object'
        ? card.set
        : null;

    const setId = upstreamSet?.id ?? (dbCard.set || card.set) ?? idPrefixLooksLikeSet(card.id) ?? null;
    const setName = upstreamSet?.name ?? SET_MAPPING[setId]?.name ?? dbCard.setName ?? card.setName ?? null;
    const setLogo = upstreamSet?.logo ?? SET_MAPPING[setId]?.logo ?? dbCard.setLogo ?? card.setLogo ?? null;

    const base = dbCard.dataValues ? dbCard.dataValues : dbCard;

    return {
      ...base,
      set: setId,
      setName,
      setLogo,
      image: normalizeImage(base.image || tcgdexImageUrl({ ...base, set: setId })),
      listings: listingsMap[card.id] || [],
      isListed: !!(listingsMap[card.id]?.length),
      isForTrade: !!forTradeMap[card.id],
      setSize: null,
      setCompletion: null,
    };
  });

  logTiming('enrichCards', {
    ms: delta(t0),
    count: cards.length,
    listed: !!listed,
    forTrade: !!forTrade,
    rarity: !!rarity,
  });
  return out;
}

/* =========================
   Quick preview pricing (single by-id call)
   ========================= */

async function attachPreviewPrices(cards, budget = 6, timeoutMs = 3000) {
  const limit = pLimit(Number(process.env.PREVIEW_PRICE_CONCURRENCY || 4));
  let rates = null;
  try {
    rates = await getExchangeRates();
  } catch {
    rates = null;
  }

  const slice = cards.slice(0, Math.max(0, budget));
  await Promise.all(
    slice.map((card) =>
      limit(async () => {
        const ptcgId = tcgdexToPtcgId(card.id);
        if (!ptcgId) return;

        try {
          const latest = await fetchPreviewLatestGBP(ptcgId, rates, timeoutMs);
          if (latest && latest.length) {
            card.pricing = { latest };
          }
        } catch {
          // swallow preview errors
        }
      })
    )
  );
}

/* =========================
   Light map (shared)
   ========================= */

function mapLightCard(card) {
  const setObj = typeof card.set === 'object' ? card.set : null;
  const setId =
    setObj?.id ??
    card.set ??
    idPrefixLooksLikeSet(card.id) ?? // <- ensure non-null for GraphQL String!
    null;

  const setName = setObj?.name ?? SET_MAPPING[setId]?.name ?? card.setName ?? null;
  const setLogo = setObj?.logo ?? SET_MAPPING[setId]?.logo ?? card.setLogo ?? null;
  const baseImage = card.image || tcgdexImageUrl({ ...card, set: setId });

  return {
    ...card,
    set: setId,
    setName,
    setLogo,
    image: normalizeImage(baseImage),
  };
}

/* =========================
   Legacy paged search — FAST return + preview prices
   ========================= */

async function searchCardsResolver(_, { input }) {
  const tStart = nowMs();

  const { name, set, number, forTrade, listed, rarity, page = 1, pageSize = 25 } = input || {};

  const setCode = set ? normalizeSetCode(set) : null;
  if (setCode && isSetBlocked(setCode)) {
    const out = { cards: [], total: 0, page, pageSize };
    logTiming('searchCards.blockedSet', {
      ms: delta(tStart),
      name,
      set: setCode,
      number,
      rarity,
      listed,
      forTrade,
      page,
      pageSize,
    });
    return out;
  }

  let tcgdexRes = { cards: [], total: 0 };
  try {
    tcgdexRes = await withTimeout(
      fetchTCGDexCards({ name, set: setCode, number, page, pageSize }),
      Number(process.env.SEARCH_FETCH_TIMEOUT_MS || 8000),
      'tcgdex-search-timeout'
    );
  } catch {
    tcgdexRes = { cards: [], total: 0 };
  }

  // byId fallback when set+number yields zero
  if (
    (!tcgdexRes.cards || tcgdexRes.cards.length === 0) &&
    setCode &&
    number != null &&
    String(number).trim() !== ''
  ) {
    const n = String(number).replace(/\D/g, '');
    const candidates = [];
    if (n) {
      candidates.push(`${setCode}-${n}`);
      if (n.length < 3) candidates.push(`${setCode}-${n.padStart(3, '0')}`);
    }
    const hits = [];
    for (const id of candidates) {
      try {
        const card = await withTimeout(fetchTCGDexCardById(id), 3000, 'tcgdex-byid-timeout');
        if (card && cardBelongsToSet(card, setCode)) hits.push(card);
      } catch {}
    }
    if (hits.length) {
      tcgdexRes.cards = hits;
      tcgdexRes.total = hits.length;
    }
  }

  // Patch missing set via byId
  const cardsPatched = await Promise.all(
    (tcgdexRes.cards || []).map(async (c) => {
      if (!getSetId(c)) {
        try {
          const full = await withTimeout(fetchTCGDexCardById(c.id), 3000, 'tcgdex-byid-timeout');
          return full || c;
        } catch {
          return c;
        }
      }
      return c;
    })
  );

  // Filter: exact set match + not blocked + numbered
  const filtered = cardsPatched.filter((card) => cardBelongsToSet(card, setCode) && !isSetBlocked(getSetId(card)));
  const numbered = filtered.filter((card) => {
    const n = card?.number;
    return n != null && String(n).trim() !== '';
  });

  const lightMapped = numbered.map(mapLightCard);

  try {
    await attachPreviewPrices(lightMapped, PREVIEW_PRICE_BUDGET, PREVIEW_PRICE_TIMEOUT_MS);
  } catch {}

  if (process.env.ENRICH_ASYNC !== '0' && lightMapped.length) {
    setImmediate(() => enrichCards(numbered, { listed, forTrade, rarity }).catch(() => {}));
  }

  const out = { cards: lightMapped, total: tcgdexRes.total || lightMapped.length, page, pageSize };
  logTiming('searchCards.total', {
    ms: delta(tStart),
    name,
    set: setCode,
    number,
    rarity,
    listed,
    forTrade,
    returned: out.cards.length,
    total: out.total,
  });
  return out;
}

/* =========================
   Connection (infinite scroll)
   ========================= */

async function fetchTcgdexBufferedConnection({
  name,
  setCode,
  number,
  after,
  first,
}) {
  let startOffset = 0;
  const cur = after ? decodeCursor(after) : null;
  if (cur && Number.isInteger(cur.offset) && cur.offset >= 0) startOffset = cur.offset + 1;

  const MAX_UPSTREAM_PAGES = Number(process.env.CONNECTION_MAX_PAGES || 6);
  const UPSTREAM_PAGE_SIZE = Math.max(DEFAULT_UPSTREAM_PAGE_SIZE, first * 2);

  let upstreamPage = Math.floor(startOffset / UPSTREAM_PAGE_SIZE) + 1;

  const acc = [];
  let upstreamTotal = 0;
  let scannedPages = 0;

  const userFilteredByNumber = !!number;

  const accept = (card) => {
    if (setCode && !cardBelongsToSet(card, setCode)) return false;
    const sid = getSetId(card) ?? idPrefixLooksLikeSet(card?.id);
    if (sid && isSetBlocked(sid)) return false;
    if (userFilteredByNumber) {
      const n = card?.number;
      return n != null && String(n).trim() !== '';
    }
    // if neither set nor id prefix exists, drop it (it would violate Card.set: String!)
    if (!sid) return false;
    return true;
  };

  const target = startOffset + first + 1; // +1 to compute hasNextPage

  while (scannedPages < MAX_UPSTREAM_PAGES && acc.length < target) {
    const params = {
      page: upstreamPage,
      pageSize: UPSTREAM_PAGE_SIZE,
    };
    if (name) params.name = name;
    if (setCode) params.set = setCode;
    if (number) params.number = number;

    let res = { cards: [], total: 0 };
    try {
      res = await withTimeout(
        fetchTCGDexCards(params),
        Number(process.env.SEARCH_FETCH_TIMEOUT_MS || 8000),
        'tcgdex-connection-timeout'
      );
    } catch {
      break;
    }

    upstreamTotal = res?.total || upstreamTotal;

    const filtered = (res?.cards || []).filter(accept);
    acc.push(...filtered);

    scannedPages++;
    upstreamPage++;

    if (!Array.isArray(res?.cards) || res.cards.length === 0) break;
  }

  const slice = acc.slice(startOffset, startOffset + first);
  const hasNextPage = acc.length > startOffset + first;
  const totalCount = upstreamTotal || acc.length;

  return { slice, hasNextPage, endOffset: startOffset + slice.length - 1, totalCount };
}

async function searchCardsConnectionResolver(_, { input }) {
  const t0 = nowMs();

  const {
    name = '',
    set = '',
    number = '',
    listed = false,
    forTrade = false,
    rarity = '',
    first = 25,
    after = null,
    budget = 8,
  } = input || {};

  const setCode = set ? normalizeSetCode(set) : null;
  if (setCode && isSetBlocked(setCode)) {
    return { edges: [], pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 0 };
  }

  // 1) Upstream buffered fetch to fill this window
  let { slice, hasNextPage, endOffset, totalCount } = await fetchTcgdexBufferedConnection({
    name: name || '',
    setCode,
    number: number || '',
    after,
    first: Math.max(1, Number(first) || 1),
  });

  // 2) Map lightly for consistent shape (set/setName/logo/image) — ensures non-null set
  let window = slice.map(mapLightCard);

  // 3) Final safety: ensure exact set match if setCode is set (using id prefix fallback)
  if (setCode) window = window.filter((n) => cardBelongsToSet(n, setCode));

  // 4) Attach quick prices to a few visible items
  try {
    await attachPreviewPrices(window, Math.max(0, Number(budget) || 0), PREVIEW_PRICE_TIMEOUT_MS);
  } catch {}

  // 5) Background enrichment for the returned window (optional)
  if (process.env.ENRICH_ASYNC !== '0' && window.length) {
    const minimal = window.map((c) => ({
      id: c.id,
      set: c.set,
      number: c.number,
      rarity: c.rarity,
      image: c.image,
      setName: c.setName,
      setLogo: c.setLogo,
    }));
    setImmediate(() => enrichCards(minimal, { listed, forTrade, rarity }).catch(() => {}));
  }

  // 6) Build edges/cursor
  const startCur = after ? (decodeCursor(after)?.offset ?? -1) + 1 : 0;
  const edges = window.map((node, i) => ({
    cursor: encodeCursor({ offset: startCur + i, id: node.id }),
    node,
  }));
  const endCursor = edges.length ? edges[edges.length - 1].cursor : null;

  logTiming('searchCardsConnection.total', {
    ms: delta(t0),
    first,
    returned: edges.length,
    hasNextPage,
  });

  return {
    edges,
    pageInfo: { hasNextPage, endCursor },
    totalCount,
  };
}

/* =========================
   Other resolvers (kept)
   ========================= */

async function searchSetsResolver(_, { query }) {
  const results = [];
  for (const [code, data] of Object.entries(SET_MAPPING)) {
    if (isSetBlocked(code)) continue;
    if (
      !query ||
      (data.name && data.name.toLowerCase().includes(query.toLowerCase())) ||
      code.toLowerCase().includes(query.toLowerCase())
    ) {
      results.push({
        code,
        name: data.name,
        total: data.total || null,
        tcgDexCode: data.tcgdex,
        logo: data.logo || null,
        cards: null,
      });
    }
  }
  return { sets: results, total: results.length };
}

async function cardByIdResolver(_, { id }) {
  const tStart = nowMs();

  let card = await Card.findByPk(id);
  if (!card || !card.set) {
    try {
      card = await withTimeout(fetchTCGDexCardById(id), 5000, 'tcgdex-byid-timeout');
    } catch {
      card = null;
    }
    if (!card) {
      logTiming('cardById.total', { ms: delta(tStart), id, result: 'null' });
      return null;
    }
  }

  let [enriched] = await enrichCards([card], { listed: false, forTrade: false }).catch(() => [card]);
  logTiming('cardById.total', { ms: delta(tStart), id, result: enriched ? 'ok' : 'null' });
  return enriched || null;
}

async function getSetResolver(_, { code }) {
  if (isSetBlocked(code)) return null;
  const cardsRes = await withTimeout(fetchTCGDexCards({ set: code }), 8000, 'tcgdex-set-timeout').catch(() => ({
    cards: [],
  }));
  const cards = (cardsRes.cards || []).filter((card) => {
    const setId = typeof card.set === 'object' ? card.set?.id : card.set;
    return setId && !isSetBlocked(setId);
  });
  const total = getSetUniqueCardCount(code, cards, true);
  return {
    code,
    name: SET_MAPPING[code]?.name || code,
    total,
    tcgDexCode: SET_MAPPING[code]?.tcgdex || code,
    logo: SET_MAPPING[code]?.logo || null,
    cards,
  };
}

async function cardSetCompletionResolver(_, { userId, set }) {
  const ownedCards = await Collection.findAll({ where: { userId, set } });
  const totalOwned = new Set(ownedCards.map((card) => card.cardId)).size;
  const allSetCards = await withTimeout(fetchTCGDexCards({ set }), 8000, 'tcgdex-set-timeout').catch(() => ({
    cards: [],
  }));
  const total = getSetUniqueCardCount(set, allSetCards.cards || [], true);
  return total ? +((totalOwned / total) * 100).toFixed(2) : 0;
}

async function getExchangeRatesResolver() {
  return getExchangeRates();
}

/* =========================
   Price history (kept)
   ========================= */

function mapVariationKey(v) {
  switch (v) {
    case 'reverse':
      return 'reverseHolofoil';
    case 'holo':
      return 'holofoil';
    case 'firstEdition':
      return 'firstEdition';
    case 'wPromo':
      return 'normal';
    default:
      return 'normal';
  }
}
function cardmarketPriceForVariation(variation, cmk) {
  if (!cmk) return null;
  const tk = mapVariationKey(variation);
  if (tk === 'normal') return cmk.trendPrice ?? cmk.averageSellPrice ?? null;
  if (tk === 'reverseHolofoil') return cmk.reverseHoloTrend ?? cmk.reverseHoloSell ?? null;
  if (tk === 'holofoil') return cmk.trendPrice ?? cmk.averageSellPrice ?? null;
  if (tk === 'firstEdition') return cmk.trendPrice ?? null;
  return null;
}
async function fetchHistoryFromTable(cardId, days) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await CardPriceHistory.findAll({
    where: { cardId, fetchedAt: { [Op.gte]: since } },
    order: [['fetchedAt', 'ASC']],
  });
  return rows.map((r) => ({
    date: r.fetchedAt.toISOString().slice(0, 10),
    variation: r.variation,
    gbp: r.gbp == null ? null : parseFloat(r.gbp),
    tcgplayer: r.tcgplayer?.market ?? null,
    cardmarket: cardmarketPriceForVariation(r.variation, r.cardmarket),
  }));
}
async function cardPriceHistoryResolver(_, { cardId, days = 30 }) {
  const limit = Math.min(days, 30);
  return fetchHistoryFromTable(cardId, limit);
}

/* =========================
   Normalizers for Card fields
   ========================= */

function normalizeVariantsField(v) {
  try {
    const val = typeof v === 'string' ? JSON.parse(v) : v;
    if (!val) {
      return { normal: true, reverse: false, holo: false, firstEdition: false };
    }
    if (Array.isArray(val)) {
      const set = new Set(val.map((x) => String(x).toLowerCase()));
      return {
        normal: set.has('normal'),
        reverse: set.has('reverse') || set.has('reverseholofoil') || set.has('reverseholo'),
        holo: set.has('holo') || set.has('holofoil'),
        firstEdition: set.has('firstedition'),
      };
    }
    if (typeof val === 'object') {
      return {
        normal: !!val.normal,
        reverse: !!(val.reverse || val.reverseHolofoil),
        holo: !!(val.holo || val.holofoil),
        firstEdition: !!val.firstEdition,
      };
    }
  } catch {}
  return { normal: true, reverse: false, holo: false, firstEdition: false };
}

function extractVendorGBP(vendor, which /* 'tcgplayer' | 'cardmarket' */) {
  if (typeof vendor === 'number') return toNum(vendor);

  if (vendor && typeof vendor === 'object') {
    const direct =
      toNum(vendor.gbp) ??
      toNum(vendor.market) ??
      toNum(vendor.mid) ??
      toNum(vendor.low) ??
      toNum(vendor.price);
    if (direct != null) return direct;

    const p = vendor.prices;
    if (which === 'tcgplayer' && p && typeof p === 'object') {
      return (
        toNum(p?.normal?.market) ??
        toNum(p?.holofoil?.market) ??
        toNum(p?.reverseHolofoil?.market) ??
        null
      );
    }
    if (which === 'cardmarket' && p && typeof p === 'object') {
      return (
        toNum(p?.trendPrice) ??
        toNum(p?.averageSellPrice) ??
        toNum(p?.reverseHoloTrend) ??
        null
      );
    }
  }
  return null;
}

function extractUpdatedAt(obj) {
  const tp = parseVendorDate(obj?.tcgplayer?.updatedAt);
  const cm = parseVendorDate(obj?.cardmarket?.updatedAt);
  return maxIsoDate(tp, cm) || obj?.updatedAt || null;
}

function normalizePricesField(raw) {
  if (!raw) return [];
  let obj = raw;
  try {
    if (typeof obj === 'string') obj = JSON.parse(obj);
  } catch {
    return [];
  }

  if (obj && Array.isArray(obj.latest)) {
    return obj.latest.map((p) => ({
      variation: p.variation ?? 'normal',
      tcgplayer:
        typeof p.tcgplayer === 'number'
          ? p.tcgplayer
          : extractVendorGBP(p.tcgplayer, 'tcgplayer'),
      cardmarket:
        typeof p.cardmarket === 'number'
          ? p.cardmarket
          : extractVendorGBP(p.cardmarket, 'cardmarket'),
      gbp: toNum(
        p.gbp ??
          extractVendorGBP(p.tcgplayer, 'tcgplayer') ??
          extractVendorGBP(p.cardmarket, 'cardmarket')
      ),
      currency: p.currency || 'GBP',
      updatedAt: p.updatedAt || null,
    }));
  }

  if (Array.isArray(obj)) {
    return obj.map((p) => ({
      variation: p.variation ?? 'normal',
      tcgplayer:
        typeof p.tcgplayer === 'number'
          ? p.tcgplayer
          : extractVendorGBP(p.tcgplayer, 'tcgplayer'),
      cardmarket:
        typeof p.cardmarket === 'number'
          ? p.cardmarket
          : extractVendorGBP(p.cardmarket, 'cardmarket'),
      gbp: toNum(
        p.gbp ??
          extractVendorGBP(p.tcgplayer, 'tcgplayer') ??
          extractVendorGBP(p.cardmarket, 'cardmarket')
      ),
      currency: p.currency || 'GBP',
      updatedAt: p.updatedAt || null,
    }));
  }

  if (obj && typeof obj === 'object' && ('tcgplayer' in obj || 'cardmarket' in obj || 'gbp' in obj)) {
    const tp = extractVendorGBP(obj.tcgplayer, 'tcgplayer');
    const cm = extractVendorGBP(obj.cardmarket, 'cardmarket');
    const gbp = toNum(obj.gbp);

    let tpOut = tp, cmOut = cm;

    if (tpOut == null && cmOut == null && gbp != null) {
      if (obj.tcgplayer && !obj.cardmarket) tpOut = gbp;
      else if (obj.cardmarket && !obj.tcgplayer) cmOut = gbp;
      else tpOut = gbp;
    }

    return [
      {
        variation: 'normal',
        tcgplayer: tpOut,
        cardmarket: cmOut,
        gbp: toNum(gbp ?? tpOut ?? cmOut),
        currency: obj.currency || 'GBP',
        updatedAt: extractUpdatedAt(obj),
      },
    ];
  }

  if (obj && typeof obj === 'object') {
    return Object.entries(obj).map(([variation, v]) => {
      const tp =
        toNum(v?.tcgplayer ?? v?.market ?? v?.mid ?? v?.low ?? v?.gbp ?? v?.usd ?? null) ??
        toNum(v?.tcgplayer?.gbp);
      const cm =
        toNum(
          v?.cardmarket ??
            v?.trendPrice ??
            v?.averageSellPrice ??
            v?.lowPrice ??
            v?.gbp ??
            v?.eur ??
            null
        ) ?? toNum(v?.cardmarket?.gbp);
      return {
        variation,
        tcgplayer: tp,
        cardmarket: cm,
        gbp: toNum(v?.gbp ?? tp ?? cm),
        currency: v?.currency || 'GBP',
        updatedAt: v?.updatedAt || null,
      };
    });
  }

  return [];
}

/* =========================
   Resolver map
   ========================= */

const resolvers = {
  Query: {
    searchCards: searchCardsResolver,
    searchSets: searchSetsResolver,
    cardById: cardByIdResolver,
    getSet: getSetResolver,
    cardSetCompletion: cardSetCompletionResolver,
    getExchangeRates: getExchangeRatesResolver,
    allRarities: getAllRarities,
    cardPriceHistory: cardPriceHistoryResolver,

    searchCardsConnection: searchCardsConnectionResolver,
  },

  Card: {
    // Guarantee non-null by falling back to ID prefix
    set: (card) =>
      (typeof card.set === 'object' ? card.set?.id : card.set) ??
      idPrefixLooksLikeSet(card.id) ??
      '', // GraphQL String! — last resort empty string (shouldn't happen due to filters)
    variations: (card) => normalizeVariantsField(card.variations),
    prices: (card) => normalizePricesField(card.pricing),

    priceHistory: async (card, { days = 30 }) => {
      const limit = Math.min(days, 30);
      const raw = card.pricing;
      if (raw) {
        try {
          const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (obj && Array.isArray(obj.history) && obj.history.length) {
            const slice = obj.history.slice(-limit);
            return slice.flatMap((h) =>
              (h.prices || []).map((p) => ({
                date: h.date,
                variation: p.variation,
                gbp: toNum(
                  p.gbp ??
                    extractVendorGBP(p.tcgplayer, 'tcgplayer') ??
                    extractVendorGBP(p.cardmarket, 'cardmarket')
                ),
                tcgplayer: toNum(extractVendorGBP(p.tcgplayer, 'tcgplayer')),
                cardmarket: toNum(extractVendorGBP(p.cardmarket, 'cardmarket')),
              }))
            );
          }
        } catch {}
      }
      return fetchHistoryFromTable(card.id, limit);
    },

    setName: (card) => {
      const setObj = typeof card.set === 'object' ? card.set : null;
      // If we only have a string set (or fallback), still map a friendly name
      const setId = setObj?.id ?? (typeof card.set === 'string' ? card.set : idPrefixLooksLikeSet(card.id));
      return setObj?.name ?? card.setName ?? (setId ? SET_MAPPING[setId]?.name ?? null : null);
    },

    image: (card) => normalizeImage(card.image || null),
    rarity: (card) => card.rarity || null,
  },
};

export default resolvers;
