// DB-first search + connection with bulletproof pricing + 7-day freshness refresh

import {
  normalizeSetCode,
  isSetBlocked,
  tcgdexImageUrl,
  getSetUniqueCardCount,
  getAllRarities,
  getCardPriceCache,
  tcgdexToPtcgId,
  encodeCursor,
  decodeCursor,
  normalizeImage,
} from './helpers.js';

import { fetchTCGDexCards, fetchTCGDexCardById } from './api/tcgdex.js';
import { fetchPTCGCardById, fetchPTCGCardPrices } from './api/pokemontcg.js';
import { getExchangeRates } from './api/exchangeRates.js';
import { saveOrUpdateCard } from './cardPersistence.js';
import { SET_MAPPING } from '../marketdata/utils/SetMapping.js';

import { Card, Listing, Collection } from '../../models/index.js';
import { Op } from 'sequelize';
import pLimit from 'p-limit';

/* =========================
   Tunables
   ========================= */

const DEBUG_PRICE = process.env.DEBUG_PRICE ? Number(process.env.DEBUG_PRICE) : 0;

const ENRICH_CONCURRENCY = Number(process.env.PRICE_CONCURRENCY || 6);
const PREVIEW_CONCURRENCY = Number(process.env.PREVIEW_PRICE_CONCURRENCY || 4);

const STALE_DAYS = Number(process.env.SEARCH_STALE_DAYS || 7);
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

// Raise preview timeout to be more forgiving
const PREVIEW_PRICE_TIMEOUT_MS = Number(process.env.SEARCH_PREVIEW_TIMEOUT_MS ?? 5000);
const PREVIEW_PRICE_BUDGET = Number(
  process.env.SEARCH_PRICE_PREVIEW_BUDGET != null ? process.env.SEARCH_PRICE_PREVIEW_BUDGET : 4
);

const PROVIDER_PAGE_SIZE = Math.min(Number(process.env.TCGDEX_PROVIDER_MAX_PAGE_SIZE || 100), 100);

const FALLBACK_SET_NAMES = {
  svp: 'SVP Black Star Promos',
};

const PTCG_FLOOR_MS = Number(
  process.env.PTCG_TIMEOUT_MS ??
  process.env.PRICE_TIMEOUT_MS ??
  12000
);

/* =========================
   Timing + small utils
   ========================= */

const nowMs = () => Number(process.hrtime.bigint() / 1_000_000n);
const delta = (t) => nowMs() - t;
const logTiming = (label, data) => console.log(`[SEARCH][timing] ${JSON.stringify({ ...data, label })}`);

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

const parseMaybeJSON = (v) => {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return null; }
};

const canonSet = (v) => (v ? String(normalizeSetCode(String(v))).toLowerCase() : null);
const getSetId = (c) => (typeof c?.set === 'object' ? c.set?.id : c?.set) || null;

const safeSetVal = (setField, id) => {
  const raw = (typeof setField === 'object' ? setField?.id : setField) ?? null;
  const canon = raw ? canonSet(raw) : null;
  if (canon) return canon;
  if (raw) return String(raw).toLowerCase();
  if (id && typeof id === 'string' && id.includes('-')) return id.split('-')[0].toLowerCase();
  return null;
};

const isStale = (updatedAt) => {
  if (!updatedAt) return true;
  const t = new Date(updatedAt).getTime();
  return !Number.isFinite(t) || (Date.now() - t) > STALE_MS;
};

// Safe accessor that works for raw rows and Sequelize instances
const getCol = (row, key) => {
  if (!row) return undefined;
  if (typeof row.get === 'function') return row.get(key);
  if (row.dataValues) return row.dataValues[key];
  return row[key];
};

/* =========================
   Vendor helpers
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

const parseVendorDate = (s) => {
  if (!s || typeof s !== 'string') return null;
  const norm = s.replace(/\//g, '-');
  const iso = /\d{4}-\d{2}-\d{2}$/.test(norm) ? `${norm}T00:00:00Z` : `${norm.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toISOString();
};
const maxIsoDate = (a, b) => {
  if (!a) return b || null;
  if (!b) return a || null;
  return new Date(a) >= new Date(b) ? a : b;
};

function pickPreviewVariation(tpPrices, cmPrices) {
  if (tpPrices?.normal?.market != null) return 'normal';
  if (tpPrices?.holofoil?.market != null) return 'holo';
  if (tpPrices?.reverseHolofoil?.market != null) return 'reverse';
  if (cmPrices?.reverseHoloTrend != null) return 'reverse';
  if (cmPrices?.trendPrice != null || cmPrices?.averageSellPrice != null) return 'normal';
  return 'normal';
}

async function fetchPricesWithFallback(ptcgId, { timeoutMs } = {}) {
  let lastErr = null;
  const tPrice = Math.max(Number(timeoutMs || 0), PTCG_FLOOR_MS);
  const tById  = Math.max(tPrice, PTCG_FLOOR_MS + 3000);

  try {
    const prices = await fetchPTCGCardPrices(ptcgId, { timeoutMs: tPrice });
    if (prices && (prices.tcgplayer || prices.cardmarket)) {
      if (DEBUG_PRICE) console.log(`[PRICE][OK] ${ptcgId} via prices (normalized map)`);
      // shape it like vendor blob to feed persistence
      return { tcgplayer: { prices: prices.tcgplayer || {} }, cardmarket: { prices: prices.cardmarket || {} } };
    }
  } catch (e) { lastErr = e; }

  try {
    const card = await fetchPTCGCardById(ptcgId, { timeoutMs: tById }).catch(() => null);
    const data = card?.data || card;
    if (data && (data.tcgplayer || data.cardmarket)) {
      if (DEBUG_PRICE) console.log(`[PRICE][OK] ${ptcgId} via card-by-id fast path`);
      return { tcgplayer: data.tcgplayer || null, cardmarket: data.cardmarket || null };
    }
  } catch (e) { lastErr = e; }

  if (DEBUG_PRICE) console.log(`[PRICE][FAIL] ${ptcgId}`, lastErr?.message || lastErr);
  return null;
}

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
    toNum(tpPrices?.reverseHolofoil?.market) ?? null;

  const cmEUR =
    toNum(cmPrices?.trendPrice) ??
    toNum(cmPrices?.averageSellPrice) ??
    toNum(cmPrices?.reverseHoloTrend) ?? null;

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
   Pricing builders from DB / cache
   ========================= */

function pricingFromDbNumeric(db) {
  const tp =
    toNum(db.tcgplayerMarket) ??
    toNum(db.tcgplayerMid) ??
    toNum(db.tcgplayerLow) ??
    toNum(db.tcgplayerHigh) ?? null;

  const cm =
    toNum(db.cardmarketTrendPrice) ??
    toNum(db.cardmarketAverageSell) ??
    toNum(db.cardmarketLowPrice) ?? null;

  if (tp == null && cm == null) return null;

  const gbp = tp != null && cm != null ? +(((tp + cm) / 2).toFixed(2)) : (tp ?? cm);
  if (gbp == null || gbp <= 0) return null;

  return {
    latest: [
      {
        variation: 'normal',
        tcgplayer: tp ?? null,
        cardmarket: cm ?? null,
        gbp,
        currency: 'GBP',
        updatedAt: db.updatedAt ? new Date(db.updatedAt).toISOString() : null,
      },
    ],
  };
}

function pricingFromCacheBlobs(tpBlob, cmBlob) {
  const tp = typeof tpBlob === 'string' ? parseMaybeJSON(tpBlob) : tpBlob;
  const cm = typeof cmBlob === 'string' ? parseMaybeJSON(cmBlob) : cmBlob;

  const tpPrices = tp?.prices || {};
  const cmPrices = cm?.prices || {};

  const variation = pickPreviewVariation(tpPrices, cmPrices);

  const tpGBP =
    toNum(tpPrices?.normal?.market) ??
    toNum(tpPrices?.holofoil?.market) ??
    toNum(tpPrices?.reverseHolofoil?.market) ?? null;

  const cmGBP =
    toNum(cmPrices?.trendPrice) ??
    toNum(cmPrices?.averageSellPrice) ??
    toNum(cmPrices?.reverseHoloTrend) ?? null;

  const tpUpdated = parseVendorDate(tp?.updatedAt);
  const cmUpdated = parseVendorDate(cm?.updatedAt);
  const updatedAt = maxIsoDate(tpUpdated, cmUpdated) || new Date().toISOString();

  if (tpGBP == null && cmGBP == null) return null;

  return {
    latest: [
      {
        variation,
        tcgplayer: tpGBP,
        cardmarket: cmGBP,
        gbp: tpGBP ?? cmGBP ?? null,
        currency: 'GBP',
        updatedAt,
      },
    ],
  };
}

/* =========================
   Normalize pricing for GraphQL
   ========================= */

function extractVendorGBP(vendor, which) {
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
        toNum(p?.reverseHolofoil?.market) ?? null
      );
    }
    if (which === 'cardmarket' && p && typeof p === 'object') {
      return (
        toNum(p?.trendPrice) ??
        toNum(p?.averageSellPrice) ??
        toNum(p?.reverseHoloTrend) ?? null
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
  try { if (typeof obj === 'string') obj = JSON.parse(obj); } catch { return []; }

  const toOut = (p) => {
    const tcg = typeof p.tcgplayer === 'number' ? p.tcgplayer : extractVendorGBP(p.tcgplayer, 'tcgplayer');
    const cmk = typeof p.cardmarket === 'number' ? p.cardmarket : extractVendorGBP(p.cardmarket, 'cardmarket');
    const gbp = toNum(p.gbp ?? tcg ?? cmk);
    if (gbp == null || gbp <= 0) return null; // drop bogus zeros
    return {
      variation: p.variation ?? 'normal',
      tcgplayer: toNum(tcg),
      cardmarket: toNum(cmk),
      gbp,
      currency: p.currency || 'GBP',
      updatedAt: p.updatedAt || null,
    };
  };

  if (obj && Array.isArray(obj.latest)) {
    return obj.latest.map(toOut).filter(Boolean);
  }

  if (Array.isArray(obj)) {
    return obj.map(toOut).filter(Boolean);
  }

  if (obj && typeof obj === 'object' && ('tcgplayer' in obj || 'cardmarket' in obj || 'gbp' in obj)) {
    const tcg = extractVendorGBP(obj.tcgplayer, 'tcgplayer');
    const cmk = extractVendorGBP(obj.cardmarket, 'cardmarket');
    const gbp = toNum(obj.gbp ?? tcg ?? cmk);
    if (gbp == null || gbp <= 0) return [];
    return [{
      variation: 'normal',
      tcgplayer: toNum(tcg),
      cardmarket: toNum(cmk),
      gbp,
      currency: obj.currency || 'GBP',
      updatedAt: extractUpdatedAt(obj),
    }];
  }

  // If it's a map of variations, keep only positive entries
  if (obj && typeof obj === 'object') {
    const out = [];
    for (const [variation, v] of Object.entries(obj)) {
      const tcg =
        toNum(v?.tcgplayer ?? v?.market ?? v?.mid ?? v?.low ?? v?.gbp ?? v?.usd ?? null) ??
        toNum(v?.tcgplayer?.gbp);
      const cmk =
        toNum(v?.cardmarket ?? v?.trendPrice ?? v?.averageSellPrice ?? v?.lowPrice ?? v?.gbp ?? v?.eur ?? null) ??
        toNum(v?.cardmarket?.gbp);
      const gbp = toNum(v?.gbp ?? tcg ?? cmk);
      if (gbp != null && gbp > 0) {
        out.push({
          variation,
          tcgplayer: toNum(tcg),
          cardmarket: toNum(cmk),
          gbp,
          currency: v?.currency || 'GBP',
          updatedAt: v?.updatedAt || null,
        });
      }
    }
    return out;
  }

  return [];
}

/* =========================
   DB filters + helpers
   ========================= */

function buildCardWhere({ name, setCode, number, rarity }) {
  const where = {};
  if (setCode) where.set = canonSet(setCode);

  if (name && String(name).trim()) {
    where.name = { [Op.substring]: String(name).trim() };
  }

  if (number && String(number).trim()) {
    where.number = String(number).trim();
  }

  if (rarity && String(rarity).trim()) {
    where.rarity = { [Op.like]: String(rarity).trim() };
  }

  if (where.set && isSetBlocked(where.set)) {
    where.set = '__blocked__never__matches__';
  }
  return where;
}

async function applyListedForTradeFilters(rows, { listed, forTrade }) {
  if (!rows?.length) return [];

  const ids = rows.map((r) => r.id);
  let keep = new Set(ids);

  if (listed === true) {
    const listings = await Listing.findAll({
      attributes: ['cardId'],
      where: { cardId: ids, status: 'active' },
      raw: true,
    });
    keep = new Set(listings.map((l) => l.cardId));
  }

  if (forTrade === true) {
    const entries = await Collection.findAll({
      attributes: ['cardId'],
      where: { cardId: ids, wantsTrade: true },
      raw: true,
    });
    const tradeSet = new Set(entries.map((e) => e.cardId));
    keep = new Set([...keep].filter((id) => tradeSet.has(id)));
  }

  return rows.filter((r) => keep.has(r.id));
}

/* =========================
   Map DB row -> API node (hardened for set objects)
   ========================= */

function completeSetMeta(setIdLike, setName, setLogo) {
  const setCode = typeof setIdLike === 'object' ? setIdLike?.id : setIdLike;
  const s = setCode ? canonSet(setCode) : null;
  return {
    set: s,
    setName: setName ?? (s ? (SET_MAPPING[s]?.name ?? FALLBACK_SET_NAMES[s] ?? null) : null),
    setLogo: setLogo ?? (s ? (SET_MAPPING[s]?.logo ?? null) : null),
  };
}

function mapDbRowToCard(db, { rates } = {}) {
  // Use getCol to avoid Sequelize instance method collisions
  const id = getCol(db, 'id');
  const name = getCol(db, 'name');
  const number = getCol(db, 'number');
  const setRaw = getCol(db, 'set'); // may be string or object
  const setNameRaw = getCol(db, 'setName');
  const setLogoRaw = getCol(db, 'setLogo');
  const rarity = getCol(db, 'rarity') || null;
  const imageRaw = getCol(db, 'image');
  const variationsRaw = getCol(db, 'variations');
  const updatedAt = getCol(db, 'updatedAt');

  const { set, setName, setLogo } = completeSetMeta(setRaw, setNameRaw, setLogoRaw);

  // Pricing preference: cards.pricing -> numeric GBP cols -> cache blobs
  let pricing = getCol(db, 'pricing') || null;
  if (!pricing) {
    const numericBuilt = pricingFromDbNumeric(db);
    if (numericBuilt) {
      pricing = numericBuilt;
    }
  }

  return {
    id,
    name,
    number,
    set,
    setName,
    setLogo,
    image: normalizeImage(imageRaw || tcgdexImageUrl({ id, set, number })),
    rarity,
    variations: variationsRaw || null,
    pricing,
    _needsCacheLift: !pricing,
    _updatedAt: updatedAt,
  };
}

/* =========================
   NEW: hydrate & persist a brand-new card
   ========================= */

async function hydrateAndSaveNewCard(tcgdexCard, rates) {
  // Ensure full details (no nulls)
  let full = tcgdexCard;
  if (!full?.rarity || !full?.image || !full?.set || !full?.setName) {
    try {
      const byId = await withTimeout(fetchTCGDexCardById(tcgdexCard.id), 9000, 'tcgdex-byid-timeout');
      if (byId) full = { ...byId, ...full };
    } catch {}
  }

  // Pricing from PTCG vendors
  const ptId = tcgdexToPtcgId(full.id);
  let rawPrices = { tcgplayer: null, cardmarket: null };
  if (ptId) {
    const hydrateMs = Number(process.env.SEARCH_HYDRATE_TIMEOUT_MS || PTCG_FLOOR_MS);
    const fetched = await fetchPricesWithFallback(ptId, { timeoutMs: hydrateMs });
    if (fetched) rawPrices = fetched;
  }

  // Persist
  await saveOrUpdateCard(full, rawPrices, rates).catch(() => {});
  // Return DB row (fresh, raw)
  const db = await Card.findByPk(full.id, { raw: true });
  return db ? mapDbRowToCard(db, { rates }) : mapDbRowToCard(full, { rates });
}

/* =========================
   Optional preview pricing
   ========================= */

async function attachPreviewPrices(cards, budget = 0, timeoutMs = 5000) {
  if (!budget) return;
  const limit = pLimit(PREVIEW_CONCURRENCY);
  let rates = null;
  try { rates = await getExchangeRates(); } catch {}

  const candidates = cards
    .filter((c) => !c.pricing || normalizePricesField(c.pricing).length === 0)
    .slice(0, budget);

  await Promise.all(
    candidates.map((card) =>
      limit(async () => {
        const ptId = tcgdexToPtcgId(card.id);
        if (!ptId) return;
        const latest = await fetchPreviewLatestGBP(ptId, rates, timeoutMs).catch(() => null);
        if (latest && latest.length) {
          card.pricing = { latest };
        }
      })
    )
  );
}

/* =========================
   Legacy paged search
   ========================= */

async function searchCardsResolver(_, { input }) {
  const t0 = nowMs();
  const { name, set, number, rarity, listed = false, forTrade = false, page = 1, pageSize = 25, budget } = input || {};
  const setCode = set ? canonSet(set) : null;

  if (setCode && isSetBlocked(setCode)) {
    logTiming('searchCards.total', { ms: delta(t0), returned: 0, total: 0, page, pageSize });
    return { cards: [], total: 0, page, pageSize };
  }

  const where = buildCardWhere({ name, setCode, number, rarity });

  // 1) DB-first
  let dbRows = await Card.findAll({
    where,
    order: [['set', 'ASC'], ['number', 'ASC'], ['id', 'ASC']],
    limit: pageSize,
    offset: (Math.max(1, page) - 1) * pageSize,
    raw: true, // <-- critical: avoid Sequelize instance 'set()' collisions
  });

  // Filter by listed/forTrade if requested
  dbRows = await applyListedForTradeFilters(dbRows, { listed, forTrade });

  let rates = null;
  try { rates = await getExchangeRates(); } catch {}

  // Map
  const cards = dbRows.map((r) => mapDbRowToCard(r, { rates }));

  // Lift from price cache if pricing empty
  await Promise.all(cards.map(async (c, idx) => {
    if (!c._needsCacheLift) return;
    try {
      const cache = await getCardPriceCache(c.id);
      if (cache && (cache.tcgplayer || cache.cardmarket)) {
        const built = pricingFromCacheBlobs(cache.tcgplayer, cache.cardmarket);
        if (built) cards[idx].pricing = built;
      }
    } catch {}
  }));

  // Background refresh for stale rows (non-blocking)
  for (const row of dbRows) {
    if (isStale(row.updatedAt)) {
      setImmediate(async () => {
        try {
          const _rates = rates || (await getExchangeRates().catch(() => null));
          await hydrateAndSaveNewCard({ id: row.id, set: row.set, number: row.number, name: row.name }, _rates || undefined);
        } catch {}
      });
    }
  }

  // 2) If DB returned enough — done
  if (cards.length >= pageSize) {
    const effectiveBudget = Math.max(0, Number(budget ?? PREVIEW_PRICE_BUDGET) || 0);
    if (effectiveBudget > 0) {
      await attachPreviewPrices(cards, effectiveBudget, PREVIEW_PRICE_TIMEOUT_MS).catch(() => {});
    }
    logTiming('searchCards.total', { ms: delta(t0), returned: cards.length, total: cards.length, page, pageSize });
    return { cards, total: cards.length, page, pageSize };
  }

  // 3) Need to top up from upstream for brand new cards (only when we have a set or a name)
  const need = pageSize - cards.length;
  if (need > 0 && (name || setCode || number)) {
    const upstream = await withTimeout(
      fetchTCGDexCards({
        name: name || undefined,
        set: setCode || undefined,
        number: number || undefined,
        page: 1,
        pageSize: PROVIDER_PAGE_SIZE,
      }),
      Number(process.env.SEARCH_FETCH_TIMEOUT_MS || 9000),
      'tcgdex-search-timeout'
    ).catch(() => ({ cards: [], total: 0 }));

    const knownIds = new Set(dbRows.map((r) => r.id));
    const fresh = [];
    for (const c of upstream.cards || []) {
      const setId = safeSetVal(getSetId(c), c.id);
      if (isSetBlocked(setId)) continue;
      if (setCode && setId !== setCode) continue;
      if (knownIds.has(c.id)) continue;
      try {
        const hydrated = await hydrateAndSaveNewCard(c, rates);
        fresh.push(hydrated);
        if (fresh.length >= need) break;
      } catch {}
    }

    cards.push(...fresh);
  }

  // Optional preview pricing for those still without prices
  const effectiveBudget = Math.max(0, Number(budget ?? PREVIEW_PRICE_BUDGET) || 0);
  if (effectiveBudget > 0) {
    await attachPreviewPrices(cards, effectiveBudget, PREVIEW_PRICE_TIMEOUT_MS).catch(() => {});
  }

  logTiming('searchCards.total', { ms: delta(t0), returned: cards.length, total: cards.length, page, pageSize });
  return { cards, total: cards.length, page, pageSize };
}

/* =========================
   Connection (Relay-style, DB-first)
   ========================= */

function cmpForKeyset(a, b) {
  const sa = (a.set || '').toLowerCase();
  const sb = (b.set || '').toLowerCase();
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  // numeric-ish compare of "number", then fallback to id
  const na = parseInt(String(a.number || '').replace(/[^\d]/g, ''), 10);
  const nb = parseInt(String(b.number || '').replace(/[^\d]/g, ''), 10);
  if (Number.isFinite(na) && Number.isFinite(nb)) {
    if (na < nb) return -1;
    if (na > nb) return 1;
  } else {
    const sNa = String(a.number || '');
    const sNb = String(b.number || '');
    if (sNa < sNb) return -1;
    if (sNa > sNb) return 1;
  }
  const ia = (a.id || '').toLowerCase();
  const ib = (b.id || '').toLowerCase();
  if (ia < ib) return -1;
  if (ia > ib) return 1;
  return 0;
}

// Translate legacy cursors { id, set, number } into an offset
async function legacyCursorToOffset({ where, listed, forTrade }, legacy) {
  const MAX_SCAN = 2000;
  let rows = await Card.findAll({
    where,
    order: [['set','ASC'], ['number','ASC'], ['id','ASC']],
    limit: MAX_SCAN,
    offset: 0,
    raw: true,
  });
  rows = await applyListedForTradeFilters(rows, { listed, forTrade });
  const idx = rows.findIndex(r =>
    String(r.id).toLowerCase() === String(legacy.id || '').toLowerCase()
  );
  return idx >= 0 ? idx : 0;
}

async function dbConnectionWindow({ where, after, first, listed, forTrade, rates }) {
  const cur = after ? decodeCursor(after) : null;

  let startOffset = 0;
  if (cur && Number.isInteger(cur.offset) && cur.offset >= 0) {
    startOffset = cur.offset + 1;
  } else if (cur && (cur.id || (cur.set && cur.number))) {
    // legacy cursor -> compute offset
    startOffset = (await legacyCursorToOffset({ where, listed, forTrade }, cur)) + 1;
  }

  let rows = await Card.findAll({
    where,
    order: [['set', 'ASC'], ['number', 'ASC'], ['id', 'ASC']],
    limit: first + 1,
    offset: startOffset,
    raw: true, // <-- critical
  });

  rows = await applyListedForTradeFilters(rows, { listed, forTrade });

  const hasNextPage = rows.length > first;
  const visible = rows.slice(0, first);

  // Map
  const nodes = visible.map((r) => mapDbRowToCard(r, { rates }));

  // Lift from cache when pricing is empty
  await Promise.all(nodes.map(async (node, idx) => {
    if (!node._needsCacheLift) return;
    try {
      const cache = await getCardPriceCache(node.id);
      if (cache && (cache.tcgplayer || cache.cardmarket)) {
        const built = pricingFromCacheBlobs(cache.tcgplayer, cache.cardmarket);
        if (built) nodes[idx].pricing = built;
      }
    } catch {}
  }));

  // Background refresh for stale rows (non-blocking)
  for (const r of visible) {
    if (isStale(r.updatedAt)) {
      setImmediate(async () => {
        try {
          await hydrateAndSaveNewCard({ id: r.id, set: r.set, number: r.number, name: r.name }, rates || undefined);
        } catch {}
      });
    }
  }

  const edges = nodes.map((node, i) => ({
    cursor: encodeCursor({ offset: startOffset + i, id: node.id, set: node.set, number: node.number }),
    node: {
      ...node,
      // Strip private markers
      _needsCacheLift: undefined,
      _updatedAt: undefined,
    },
  }));
  const endCursor = edges.length ? edges[edges.length - 1].cursor : null;

  return { edges, endCursor, hasNextPage, count: nodes.length };
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
    budget = undefined,
  } = input || {};

  const setCode = set ? canonSet(set) : null;
  if (setCode && isSetBlocked(setCode)) {
    return { edges: [], pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 0 };
  }

  const where = buildCardWhere({ name, setCode, number, rarity });

  let rates = null;
  try { rates = await getExchangeRates(); } catch {}

  // 1) DB-first window
  let { edges, endCursor, hasNextPage } = await dbConnectionWindow({
    where, after, first, listed, forTrade, rates,
  });

  // Early return if we filled the page
  if (edges.length >= first) {
    const effectiveBudget = Math.max(0, Number(budget ?? PREVIEW_PRICE_BUDGET) || 0);
    if (effectiveBudget > 0) {
      await attachPreviewPrices(edges.map(e => e.node), effectiveBudget, PREVIEW_PRICE_TIMEOUT_MS).catch(() => {});
    }

    logTiming('searchCardsConnection.total', { ms: delta(t0), first, returned: edges.length, hasNextPage });
    return {
      edges,
      pageInfo: { hasNextPage, endCursor },
      totalCount: edges.length,
    };
  }

  // 2) Need to top up with brand-new cards from upstream (hydrate before returning)
  const need = first - edges.length;
  if (need > 0) {
    const upstream = await withTimeout(
      fetchTCGDexCards({
        name: name || undefined,
        set: setCode || undefined,
        number: number || undefined,
        page: 1,
        pageSize: PROVIDER_PAGE_SIZE,
      }),
      Number(process.env.SEARCH_FETCH_TIMEOUT_MS || 9000),
      'tcgdex-connection-timeout'
    ).catch(() => ({ cards: [], total: 0 }));

    const haveIds = new Set(edges.map((e) => e.node.id));

    const limit = pLimit(ENRICH_CONCURRENCY);
    const newcomers = [];
    await Promise.all(
      (upstream.cards || []).map((c) =>
        limit(async () => {
          if (newcomers.length >= need) return;
          const setId = safeSetVal(getSetId(c), c.id);
          if (isSetBlocked(setId)) return;
          if (setCode && setId !== setCode) return;

          if (name && String(name).trim() && !String(c.name || '').toLowerCase().includes(String(name).toLowerCase())) {
            return;
          }
          if (number && String(number).trim() && String(c.number || '') !== String(number).trim()) {
            return;
          }

          if (haveIds.has(c.id)) return;

          try {
            const saved = await hydrateAndSaveNewCard(c, rates);
            newcomers.push(saved);
          } catch {}
        })
      )
    );

    newcomers.sort(cmpForKeyset);
    const toAdd = newcomers.slice(0, need);

    const startOffset = after ? (decodeCursor(after)?.offset ?? -1) + 1 : 0;
    const newEdges = toAdd.map((node, i) => ({
      cursor: encodeCursor({ offset: startOffset + edges.length + i, id: node.id, set: node.set, number: node.number }),
      node,
    }));

    edges = edges.concat(newEdges);
    endCursor = edges.length ? edges[edges.length - 1].cursor : null;
    hasNextPage = (upstream.cards?.length || 0) > newcomers.length;

    const effectiveBudget = Math.max(0, Number(budget ?? PREVIEW_PRICE_BUDGET) || 0);
    if (effectiveBudget > 0) {
      await attachPreviewPrices(edges.map(e => e.node), effectiveBudget, PREVIEW_PRICE_TIMEOUT_MS).catch(() => {});
    }
  }

  logTiming('searchCardsConnection.total', { ms: delta(t0), first, returned: edges.length, hasNextPage });
  return {
    edges,
    pageInfo: { hasNextPage, endCursor },
    totalCount: edges.length,
  };
}

/* =========================
   Other resolvers
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

  // DB-first (raw to avoid method collisions)
  let db = await Card.findByPk(id, { raw: true });
  if (db) {
    if (isStale(db.updatedAt)) {
      setImmediate(async () => {
        try {
          const rates = await getExchangeRates().catch(() => null);
          await hydrateAndSaveNewCard({ id: db.id, set: db.set, number: db.number, name: db.name }, rates || undefined);
        } catch {}
      });
    }
    const mapped = mapDbRowToCard(db);
    // Lift from cache if empty
    if (!mapped.pricing) {
      try {
        const cache = await getCardPriceCache(mapped.id);
        if (cache && (cache.tcgplayer || cache.cardmarket)) {
          const built = pricingFromCacheBlobs(cache.tcgplayer, cache.cardmarket || undefined);
          if (built) mapped.pricing = built;
        }
      } catch {}
    }
    logTiming('cardById.total', { ms: delta(tStart), id, result: 'db' });
    return mapped;
  }

  // Not in DB — fully hydrate (blocking) to avoid nulls
  let tcg = null;
  try { tcg = await withTimeout(fetchTCGDexCardById(id), 9000, 'tcgdex-byid-timeout'); } catch {}
  if (!tcg) {
    logTiming('cardById.total', { ms: delta(tStart), id, result: 'null' });
    return null;
  }
  let rates = null;
  try { rates = await getExchangeRates(); } catch {}

  const saved = await hydrateAndSaveNewCard(tcg, rates).catch(() => null);
  logTiming('cardById.total', { ms: delta(tStart), id, result: saved ? 'hydrated' : 'null' });
  return saved || null;
}

async function getSetResolver(_, { code }) {
  const canon = canonSet(code);
  if (isSetBlocked(canon)) return null;
  const res = await withTimeout(fetchTCGDexCards({ set: canon }), 9000, 'tcgdex-set-timeout').catch(() => ({ cards: [] }));
  const cards = (res.cards || []).filter((card) => {
    const setId = safeSetVal(typeof card.set === 'object' ? card.set?.id : card.set, card.id);
    return setId && !isSetBlocked(setId);
  });
  const total = getSetUniqueCardCount(canon, cards, true);
  return {
    code: canon,
    name: SET_MAPPING[canon]?.name || canon,
    total,
    tcgDexCode: SET_MAPPING[canon]?.tcgdex || canon,
    logo: SET_MAPPING[canon]?.logo || null,
    cards,
  };
}

async function cardSetCompletionResolver(_, { userId, set }) {
  const canon = canonSet(set);
  const ownedCards = await Collection.findAll({ where: { userId, set: canon }, raw: true });
  const totalOwned = new Set(ownedCards.map((card) => card.cardId)).size;
  const allSetCards = await withTimeout(fetchTCGDexCards({ set: canon }), 9000, 'tcgdex-set-timeout').catch(() => ({
    cards: [],
  }));
  const total = getSetUniqueCardCount(canon, allSetCards.cards || [], true);
  return total ? +((totalOwned / total) * 100).toFixed(2) : 0;
}

async function getExchangeRatesResolver() {
  return getExchangeRates();
}

/* =========================
   Price history (inline only)
   ========================= */

async function cardPriceHistoryResolver(_, { cardId, days = 30 }) {
  const limit = Math.min(days, 30);
  const row = await Card.findByPk(cardId, { attributes: ['pricing'], raw: true });
  if (!row?.pricing) return [];
  let obj = row.pricing;
  try { if (typeof obj === 'string') obj = JSON.parse(obj); } catch { return []; }
  const history = Array.isArray(obj?.history) ? obj.history : [];
  if (!history.length) return [];

  const slice = history.slice(-limit);
  const out = [];
  for (const h of slice) {
    const date = h?.date || null;
    for (const p of (h?.prices || [])) {
      const tcg = toNum(extractVendorGBP(p.tcgplayer, 'tcgplayer'));
      const cmk = toNum(extractVendorGBP(p.cardmarket, 'cardmarket'));
      const gbp = toNum(p.gbp ?? tcg ?? cmk);
      if (gbp != null) {
        out.push({
          date,
          variation: p.variation ?? 'normal',
          gbp,
          tcgplayer: tcg,
          cardmarket: cmk,
        });
      }
    }
  }
  return out;
}

/* =========================
   GraphQL type resolvers
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

    // Relay connection
    searchCardsConnection: searchCardsConnectionResolver,
  },

  Card: {
    set: (card) => {
      const raw = (typeof card.set === 'object' ? card.set?.id : card.set) ?? null;
      return safeSetVal(raw, card.id);
    },
    variations: (card) => {
      try {
        const val = typeof card.variations === 'string' ? JSON.parse(card.variations) : card.variations;
        if (!val) return { normal: true, reverse: false, holo: false, firstEdition: false };
        return {
          normal: !!(val.normal ?? val.Normal ?? true),
          reverse: !!(val.reverse || val.reverseHolofoil || val.Reverse),
          holo: !!(val.holo || val.holofoil || val.Holo),
          firstEdition: !!val.firstEdition,
        };
      } catch {
        return { normal: true, reverse: false, holo: false, firstEdition: false };
      }
    },
    prices: (card) => {
      if (card?.pricing) {
        const parsed = typeof card.pricing === 'string' ? parseMaybeJSON(card.pricing) : card.pricing;
        const norm = normalizePricesField(parsed);
        if (norm.length) return norm;
      }
      const built = pricingFromDbNumeric(card);
      return normalizePricesField(built);
    },

    // Inline-only history; no DB fallback
    priceHistory: async (card, { days = 30 }) => {
      const limit = Math.min(days, 30);
      const raw = card.pricing;
      if (!raw) return [];
      try {
        const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (obj && Array.isArray(obj.history) && obj.history.length) {
          const slice = obj.history.slice(-limit);
          const out = [];
          for (const h of slice) {
            for (const p of (h.prices || [])) {
              const tcg = toNum(extractVendorGBP(p.tcgplayer, 'tcgplayer'));
              const cmk = toNum(extractVendorGBP(p.cardmarket, 'cardmarket'));
              const gbp = toNum(p.gbp ?? tcg ?? cmk);
              if (gbp != null) {
                out.push({
                  date: h.date,
                  variation: p.variation ?? 'normal',
                  gbp,
                  tcgplayer: tcg,
                  cardmarket: cmk,
                });
              }
            }
          }
          return out;
        }
      } catch {}
      return [];
    },

    setName: (card) => {
      const setObj = typeof card.set === 'object' ? card.set : null;
      const setId = safeSetVal(setObj?.id ?? (typeof card.set === 'string' ? card.set : null), card.id);
      return setObj?.name ?? card.setName ?? (setId ? (SET_MAPPING[setId]?.name || FALLBACK_SET_NAMES[setId] || null) : null);
    },
    image: (card) => normalizeImage(card.image || null),
    rarity: (card) => card.rarity || null,
  },
};

export default resolvers;
