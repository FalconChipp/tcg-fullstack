// src/modules/search/resolvers.js
import {
  normalizeSetCode,
  isSetBlocked,
  tcgdexImageUrl,
  getSetUniqueCardCount,
  getAllRarities,
  getCardPriceCache,
  saveCardPriceCache,
  tcgdexToPtcgId,
  hydrateCard
} from './helpers.js';

import { fetchTCGDexCards, fetchTCGDexCardById } from './api/tcgdex.js';
import { fetchPTCGCardById, fetchPTCGCardPrices, fetchPTCGCards } from './api/pokemontcg.js';
import { getExchangeRates } from './api/exchangeRates.js';
import { saveOrUpdateCard } from './cardPersistence.js';
import { SET_MAPPING } from './SetMapping.js';
import { Card, Listing, Collection, CardPriceHistory } from '../../models/index.js';
import { Op } from 'sequelize';
import pLimit from 'p-limit';

/* =========================
   Feature flags / Tunables
   ========================= */

// Keep pricing reliable: do not hard-timeout pricing calls (0 disables)
const PRICE_TIMEOUT_MS = Number(process.env.PRICE_TIMEOUT_MS || 0);

// Safe concurrency when enriching prices
const PRICE_CONCURRENCY = Number(process.env.PRICE_CONCURRENCY || 6);

// Fast-path: return immediately; enrich later
const SEARCH_FAST_PATH = process.env.SEARCH_FAST_PATH !== '0'; // default ON

// Background enrichment (used for all enrichment now)
const SEARCH_ENRICH_ASYNC = process.env.SEARCH_ENRICH_ASYNC !== '0'; // default ON

// Previously "tiny sync budget" — we now schedule this slice async too.
const SEARCH_SYNC_ENRICH_LIMIT = Number(process.env.SEARCH_SYNC_ENRICH_LIMIT || 3);

// Allow disabling enrichment entirely (debug/testing)
const DISABLE_ENRICH = process.env.DISABLE_PRICE_ENRICHMENT === '1';

// Warm cache TTL for set-level bulk prices
const BULK_SET_PRICE_CACHE_TTL_MS = Number(process.env.BULK_SET_PRICE_CACHE_TTL_MS || 3 * 60 * 1000);

// Optional debug logs for pricing hits/misses
const DEBUG_PRICE = process.env.DEBUG_PRICE ? Number(process.env.DEBUG_PRICE) : 0;

// Cap how many cards we attempt to price on FIRST PASS (cheap).
const FIRST_PASS_PRICE_MAX = Number(process.env.FIRST_PASS_PRICE_MAX || 8);

// Tiny live fetch budget for precise queries.
const PRECISE_SYNC_PRICE_MAX = Number(process.env.PRECISE_SYNC_PRICE_MAX || 3);

/* =========================
   Timing helpers
   ========================= */

const nowMs = () => Number(process.hrtime.bigint() / 1_000_000n);
const delta = (start) => nowMs() - start;
function logTiming(label, data) {
  console.log(`[SEARCH][timing] ${JSON.stringify({ ...data, label })}`);
}

/* =========================
   Warm cache for bulk set prices
   ========================= */
const _bulkSetPriceCache = new Map(); // key=setId -> { value, expiry }

function getWarmSetPrices(ptcgSetId) {
  const e = _bulkSetPriceCache.get(ptcgSetId);
  if (!e) return null;
  if (Date.now() > e.expiry) {
    _bulkSetPriceCache.delete(ptcgSetId);
    return null;
  }
  return e.value;
}
function setWarmSetPrices(ptcgSetId, value) {
  _bulkSetPriceCache.set(ptcgSetId, { value, expiry: Date.now() + BULK_SET_PRICE_CACHE_TTL_MS });
}

// Convert tcgdex set code to PokémonTCG set id (e.g., sv08 -> sv8, sv08.5 -> sv8pt5)
function tcgdexSetToPtcgSetId(tcgdexSet) {
  if (!tcgdexSet) return null;

  // Prefer explicit mapping if present
  for (const [, m] of Object.entries(SET_MAPPING)) {
    if (m && m.tcgdex === tcgdexSet && m.ptcg) return m.ptcg;
  }

  // Fallback heuristic
  const m = String(tcgdexSet).match(/^([a-z]+)(\d+)(?:\.(\d+))?$/i);
  if (!m) return null;
  const prefix = m[1].toLowerCase();
  const main   = String(parseInt(m[2], 10));
  const dot    = m[3] ? `pt${parseInt(m[3], 10)}` : '';
  return `${prefix}${main}${dot}`;
}

/* =========================
   Pricing fetch path (resilient)
   ========================= */
async function fetchPricesWithFallback(ptcgId, { timeoutMs, retries = 1 }) {
  let lastErr = null;

  // 1) Try “prices” endpoint
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const prices = await withTimeout(fetchPTCGCardPrices(ptcgId), timeoutMs, 'price-timeout');
      if (prices && (prices.tcgplayer || prices.cardmarket)) {
        if (DEBUG_PRICE) console.log(`[PRICE][OK] ${ptcgId} via prices endpoint (try ${attempt + 1})`);
        return {
          tcgplayer: prices.tcgplayer || null,
          cardmarket: prices.cardmarket || null
        };
      }
    } catch (e) {
      lastErr = e;
      if (DEBUG_PRICE) console.log(`[PRICE][ERR] ${ptcgId} prices try ${attempt + 1}:`, e?.message || e);
    }
  }

  // 2) Fallback: fetch full card
  try {
    const card = await withTimeout(fetchPTCGCardById(ptcgId), Math.max(timeoutMs, 7000), 'ptcg-byid-timeout');
    const data = card?.data || card;
    if (data && (data.tcgplayer || data.cardmarket)) {
      if (DEBUG_PRICE) console.log(`[PRICE][OK] ${ptcgId} via card-by-id fallback`);
      return {
        tcgplayer: data.tcgplayer || null,
        cardmarket: data.cardmarket || null
      };
    }
  } catch (e) {
    lastErr = e;
    if (DEBUG_PRICE) console.log(`[PRICE][ERR] ${ptcgId} card-by-id fallback:`, e?.message || e);
  }

  if (DEBUG_PRICE) console.log(`[PRICE][FAIL] ${ptcgId} after fallback`, lastErr?.message || lastErr);
  return null;
}

/* =========================
   Utilities
   ========================= */

function withTimeout(promise, ms, label = 'timeout') {
  // Respect “no timeout” policy for pricing/persistence
  if (!ms || ms <= 0) return promise;
  let t;
  const timer = new Promise((_, rej) => (t = setTimeout(() => rej(new Error(label)), ms)));
  return Promise.race([promise.finally(() => clearTimeout(t)), timer]);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function gbpFromTcgplayerUSD(val, rates) {
  if (val == null) return null;
  if (!rates || !rates.USD || !rates.GBP) return null;
  // USD -> GBP: value_in_usd * (GBP/USD)
  const usdPerOne = rates.USD;
  const gbpPerOne = rates.GBP;
  const usdToGbp = gbpPerOne / usdPerOne;
  return +(val * usdToGbp).toFixed(2);
}
function gbpFromCardmarketEUR(val, rates) {
  if (val == null) return null;
  if (!rates || !rates.EUR || !rates.GBP) return null;
  // EUR -> GBP: value_in_eur * (GBP/EUR)
  const eurPerOne = rates.EUR;
  const gbpPerOne = rates.GBP;
  const eurToGbp = gbpPerOne / eurPerOne;
  return +(val * eurToGbp).toFixed(2);
}

// Build a "pricing.latest" array compatible with your Card.prices resolver
function buildLatestPricingGBP({ variation = 'normal', tcgplayerUSD, cardmarketEUR, rates }) {
  const tp = gbpFromTcgplayerUSD(tcgplayerUSD, rates);
  const cm = gbpFromCardmarketEUR(cardmarketEUR, rates);
  if (tp == null && cm == null) return null;
  return [{
    variation,
    tcgplayer: tp == null ? null : { gbp: tp },
    cardmarket: cm == null ? null : { gbp: cm },
    updatedAt: new Date().toISOString()
  }];
}

/* =========================
   Enrichment (background or sync)
   ========================= */
async function enrichCards(cards, { listed, forTrade, rarity }) {
  const t0 = nowMs();
  const limit = pLimit(PRICE_CONCURRENCY);
  const cardIds = cards.map(c => c.id);

  let rates = null;
  try { rates = await getExchangeRates(); } catch { rates = null; }

  // Try to bulk-fetch prices by set and cache them
  let setPriceMap = {}; // number -> {tcgplayer, cardmarket}
  if (cards.length) {
    const setIds = new Set(
      cards.map(c => (typeof c.set === 'object' ? c.set?.id : c.set)).filter(Boolean)
    );
    if (setIds.size === 1) {
      const tcgdexSetCode = [...setIds][0];
      const ptcgSetId = tcgdexSetToPtcgSetId(tcgdexSetCode);
      if (ptcgSetId) {
        const warm = getWarmSetPrices(ptcgSetId);
        if (warm) {
          setPriceMap = warm;
          if (DEBUG_PRICE) console.log(`[PRICE][BULK][CACHE] hit for ${ptcgSetId}`);
        } else {
          try {
            const bulk = await fetchPTCGCards({ set: ptcgSetId });
            if (Array.isArray(bulk) && bulk.length) {
              const map = {};
              for (const c of bulk) {
                if (!c?.number) continue;
                map[String(c.number)] = {
                  tcgplayer: c.tcgplayer || null,
                  cardmarket: c.cardmarket || null
                };
              }
              setPriceMap = map;
              setWarmSetPrices(ptcgSetId, map);
              if (DEBUG_PRICE) console.log(`[PRICE][BULK] fetched=${bulk.length} mapped=${Object.keys(map).length}`);
            }
          } catch (err) {
            if (DEBUG_PRICE) console.log(`[PRICE][BULK][ERR] ${ptcgSetId}:`, err?.message || err);
          }
        }
      }
    }
  }

  await Promise.allSettled(
    cards.map(card =>
      limit(async () => {
        const hydrated = await withTimeout(hydrateCard(card), PRICE_TIMEOUT_MS, 'hydrate-timeout')
          .catch(() => card);

        let rawPrices = { tcgplayer: null, cardmarket: null };

        if (!DISABLE_ENRICH) {
          const n1 = String(card.number || '');
          const n2 = n1.replace(/^0+/, '');
          const bulkHit = setPriceMap[n1] || setPriceMap[n2];

          if (bulkHit) {
            rawPrices = bulkHit;
            if (DEBUG_PRICE) console.log(`[PRICE][HIT][BULK] ${card.id} #${card.number}`);
          } else {
            const ptcgId = tcgdexToPtcgId(card.id);
            if (ptcgId) {
              let cached = await getCardPriceCache(card.id);
              if (!cached) {
                const fetched = await fetchPricesWithFallback(ptcgId, {
                  timeoutMs: PRICE_TIMEOUT_MS,
                  retries: 1
                });
                if (fetched) {
                  cached = fetched;
                  await saveCardPriceCache(card.id, cached).catch(() => {});
                }
              }
              if (cached) rawPrices = cached;
            }
          }
        }

        await saveOrUpdateCard(hydrated, rawPrices, rates).catch(() => {});
      })
    )
  );

  // Optional extras: listings & forTrade
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

  // Optional rarity filter (post-persist)
  let filtered = cards;
  if (rarity) filtered = filtered.filter(c => (c.rarity || '').toLowerCase() === rarity.toLowerCase());

  // Read freshly saved rows in bulk (no N+1)
  const dbCards = await Card.findAll({ where: { id: filtered.map(c => c.id) } });
  const dbMap = new Map(dbCards.map(c => [c.id, c]));

  const out = filtered.map(card => {
    const dbCard = dbMap.get(card.id) || card;
    const setObj = (typeof dbCard.set === 'object' ? dbCard.set : { id: dbCard.set });
    const setId = setObj?.id || null;
    const setName = SET_MAPPING[setId]?.name || dbCard.setName || null;
    const setLogo = SET_MAPPING[setId]?.logo || dbCard.setLogo || null;

    const base = dbCard.dataValues ? dbCard.dataValues : dbCard;
    return {
      ...base,
      setName,
      setLogo,
      image: base.image || tcgdexImageUrl({ ...base, set: setId }),
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
    rarity: !!rarity
  });

  return out;
}

/* =========================
   FIRST-PASS PRICING (NEW)
   ========================= */

// Returns a map: cardId -> { latest: [...] } compatible with Card.prices
async function buildFirstPassPricing({ cards, dbMap, rates, setCodeForBulk }) {
  const t0 = nowMs();

  const result = new Map();
  if (!cards.length) return result;

  // 1) Use DB pricing when available (fast)
  let usedDb = 0;
  for (const c of cards) {
    const db = dbMap.get(c.id);
    if (!db || !db.pricing) continue;
    try {
      const parsed = typeof db.pricing === 'string' ? JSON.parse(db.pricing) : db.pricing;
      if (parsed && (Array.isArray(parsed.latest) ? parsed.latest.length : Array.isArray(parsed) ? parsed.length : parsed.variation)) {
        result.set(c.id, parsed.latest ? { latest: parsed.latest } : (Array.isArray(parsed) ? { latest: parsed } : { latest: [parsed] }));
        usedDb++;
      }
    } catch {}
  }

  // If we already have enough first-pass prices, bail out early.
  if (result.size >= Math.min(cards.length, FIRST_PASS_PRICE_MAX)) {
    logTiming('firstPassPricing.dbOnly', { ms: delta(t0), got: result.size });
    return result;
  }

  // 2) Warm set-level bulk prices (fast when warm; still pretty quick if single fetch)
  let bulkMap = null;
  if (setCodeForBulk) {
    const ptcgSetId = tcgdexSetToPtcgSetId(setCodeForBulk);
    if (ptcgSetId) {
      const warm = getWarmSetPrices(ptcgSetId);
      if (warm) {
        bulkMap = warm;
      } else {
        try {
          const bulk = await fetchPTCGCards({ set: ptcgSetId });
          if (Array.isArray(bulk) && bulk.length) {
            const m = {};
            for (const b of bulk) {
              if (!b?.number) continue;
              m[String(b.number)] = {
                tcgplayer: b.tcgplayer || null,
                cardmarket: b.cardmarket || null
              };
            }
            setWarmSetPrices(ptcgSetId, m);
            bulkMap = m;
          }
        } catch {
          bulkMap = null;
        }
      }
    }
  }

  let usedBulk = 0;
  if (bulkMap) {
    for (const c of cards) {
      if (result.has(c.id)) continue;
      if (result.size >= FIRST_PASS_PRICE_MAX) break;
      const n1 = String(c.number || '');
      const n2 = n1.replace(/^0+/, '');
      const hit = bulkMap[n1] || bulkMap[n2];
      if (!hit) continue;

      const latest = buildLatestPricingGBP({
        variation: 'normal',
        tcgplayerUSD: hit.tcgplayer?.prices?.normal?.market ?? hit.tcgplayer?.prices?.holofoil?.market ?? null,
        cardmarketEUR: hit.cardmarket?.prices?.trendPrice ?? hit.cardmarket?.prices?.averageSellPrice ?? null,
        rates
      });
      if (latest) {
        result.set(c.id, { latest });
        usedBulk++;
      }
    }
  }

  // 3) Tiny live fetch budget
  let usedLive = 0;
  const need = Math.min(FIRST_PASS_PRICE_MAX, cards.length) - result.size;
  if (need > 0) {
    const candidates = cards.filter(c => !result.has(c.id)).slice(0, Math.min(need, PRECISE_SYNC_PRICE_MAX));
    for (const c of candidates) {
      const ptcgId = tcgdexToPtcgId(c.id);
      if (!ptcgId) continue;
      try {
        const fetched = await fetchPricesWithFallback(ptcgId, { timeoutMs: PRICE_TIMEOUT_MS, retries: 1 });
        if (fetched) {
          const latest = buildLatestPricingGBP({
            variation: 'normal',
            tcgplayerUSD: fetched.tcgplayer?.prices?.normal?.market ?? fetched.tcgplayer?.prices?.holofoil?.market ?? null,
            cardmarketEUR: fetched.cardmarket?.prices?.trendPrice ?? fetched.cardmarket?.prices?.averageSellPrice ?? null,
            rates
          });
          if (latest) {
            result.set(c.id, { latest });
            usedLive++;
          }
        }
      } catch {}
      if (result.size >= FIRST_PASS_PRICE_MAX) break;
    }
  }

  logTiming('firstPassPricing.total', {
    ms: delta(t0),
    returned: result.size,
    usedDb,
    usedBulk,
    usedLive
  });
  return result;
}

/* =========================
   FAST PATH render helpers
   ========================= */

function buildFastReturn(cards, { listed, forTrade, rarity }, pre = {}) {
  const { listingsMap = {}, forTradeMap = {}, dbMap = new Map(), pricingMap = new Map() } = pre;

  let filtered = cards;
  if (rarity) filtered = filtered.filter(c => (c.rarity || '').toLowerCase() === rarity.toLowerCase());

  return filtered.map(card => {
    const dbCard = dbMap.get(card.id) || card;
    const setObj = (typeof dbCard.set === 'object' ? dbCard.set : { id: dbCard.set });
    const setId = setObj?.id || null;
    const setName = SET_MAPPING[setId]?.name || dbCard.setName || null;
    const setLogo = SET_MAPPING[setId]?.logo || dbCard.setLogo || null;

    const base = dbCard.dataValues ? dbCard.dataValues : dbCard;
    const pricing = pricingMap.get(card.id) || dbCard.pricing || null;

    return {
      ...base,
      pricing,
      setName,
      setLogo,
      image: base.image || tcgdexImageUrl({ ...base, set: setId }),
      listings: listingsMap[card.id] || [],
      isListed: !!(listingsMap[card.id]?.length),
      isForTrade: !!forTradeMap[card.id],
      setSize: null,
      setCompletion: null,
    };
  });
}

/* =========================
   MAIN RESOLVERS
   ========================= */

async function searchCardsResolver(_, { input }) {
  const tStart = nowMs();

  const {
    name,
    set,
    number,
    forTrade,
    listed,
    rarity,
    page = 1,
    pageSize = 25
  } = input || {};

  const setCode = set ? normalizeSetCode(set) : null;
  if (setCode && isSetBlocked(setCode)) {
    const out = { cards: [], total: 0, page, pageSize };
    logTiming('searchCards.blockedSet', {
      ms: delta(tStart),
      name, set: setCode, number, rarity, listed, forTrade, page, pageSize
    });
    return out;
  }

  // Phase 1: TCGDex fetch
  const tTCGDexStart = nowMs();
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
  logTiming('searchCards.tcgdex', {
    ms: delta(tTCGDexStart),
    count: tcgdexRes.cards?.length || 0
  });

  // Fallback byId when we have set+number but zero results
  if ((!tcgdexRes.cards || tcgdexRes.cards.length === 0) && setCode && number != null && String(number).trim() !== '') {
    const tFallbackStart = nowMs();
    const n = String(number).replace(/\D/g, '');
    const candidates = [];
    if (n) {
      candidates.push(`${setCode}-${n}`);
      if (n.length < 3) candidates.push(`${setCode}-${n.padStart(3, '0')}`);
    }
    const byIdHits = [];
    for (const id of candidates) {
      try {
        const card = await withTimeout(fetchTCGDexCardById(id), 3000, 'tcgdex-byid-timeout');
        if (card) {
          const cardSetId = typeof card.set === 'object' ? card.set?.id : card.set;
          if (cardSetId === setCode) byIdHits.push(card);
        }
      } catch {}
    }
    if (byIdHits.length) {
      tcgdexRes.cards = byIdHits;
      tcgdexRes.total = byIdHits.length;
    }
    logTiming('searchCards.tcgdex.fallbackById', { ms: delta(tFallbackStart), tried: candidates.length, hits: byIdHits.length });
  }

  // Name-only fallback when set+name yields 0
  if ((!tcgdexRes.cards || tcgdexRes.cards.length === 0) && setCode && name && String(name).trim() !== '') {
    const tNameFallback = nowMs();
    try {
      const nameOnly = await withTimeout(
        fetchTCGDexCards({ name, page, pageSize }), // no set filter
        Number(process.env.SEARCH_FETCH_TIMEOUT_MS || 8000),
        'tcgdex-nameonly-timeout'
      ).catch(() => ({ cards: [] }));
      const hits = (nameOnly.cards || []).filter(c => {
        const sid = typeof c.set === 'object' ? c.set?.id : c.set;
        return sid === setCode;
      });
      if (hits.length) {
        tcgdexRes.cards = hits;
        tcgdexRes.total = hits.length;
      }
      logTiming('searchCards.tcgdex.fallbackNameOnly', { ms: delta(tNameFallback), scanned: nameOnly.cards?.length || 0, hits: hits.length });
    } catch {
      logTiming('searchCards.tcgdex.fallbackNameOnly', { ms: delta(tNameFallback), scanned: 0, hits: 0 });
    }
  }

  // Patch cards with missing set via byId (short timeout each)
  const tPatchStart = nowMs();
  const cardsPatched = await Promise.all(
    (tcgdexRes.cards || []).map(async (c) => {
      if (!c?.set) {
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
  logTiming('searchCards.patchMissing', { ms: delta(tPatchStart) });

  // Filter: valid set, not blocked, ensure number present; enforce requested set equality
  const filtered = cardsPatched.filter(card => {
    const setId = typeof card.set === 'object' ? card.set?.id : card.set;
    if (!setId) return false;
    if (isSetBlocked(setId)) return false;
    if (setCode && setId !== setCode) return false; // strict set filter
    return true;
  });
  const numbered = filtered.filter(card => {
    if (card == null) return false;
    const n = card.number;
    if (n == null) return false;
    return String(n).trim() !== '';
  });

  // Phase 2: bulk prefetch from DB + optional extras
  const tDBStart = nowMs();
  const cardIds = numbered.map(c => c.id).filter(Boolean);
  const haveIds = cardIds.length > 0;
  const [dbCards, listings, tradeEntries] = await Promise.all([
    haveIds ? Card.findAll({ where: { id: cardIds } }) : Promise.resolve([]),
    listed ? Listing.findAll({ where: { cardId: cardIds, status: 'active' } }) : Promise.resolve([]),
    forTrade ? Collection.findAll({ where: { cardId: cardIds, wantsTrade: true } }) : Promise.resolve([])
  ]);
  const dbMap = new Map(dbCards.map(c => [c.id, c]));
  const listingsMap = {};
  for (const l of listings) {
    if (!listingsMap[l.cardId]) listingsMap[l.cardId] = [];
    listingsMap[l.cardId].push(l.toJSON());
  }
  const forTradeMap = {};
  for (const entry of tradeEntries) forTradeMap[entry.cardId] = true;

  logTiming('searchCards.dbPrefetch', {
    ms: delta(tDBStart),
    dbFound: dbCards.length,
    listed: !!listed,
    forTrade: !!forTrade
  });

  // Phase 3: FIRST-PASS PRICING (cheap & bounded)
  const tQuickPrice = nowMs();
  let rates = null;
  try { rates = await getExchangeRates(); } catch { rates = null; }

  const oneSetId = (() => {
    const s = new Set(
      numbered
        .map(c => (typeof c.set === 'object' ? c.set?.id : c.set))
        .map(v => (v == null ? null : String(v)))
        .filter(Boolean)
    );
    return s.size === 1 ? [...s][0] : null;
  })();

  const firstPassPricing = await buildFirstPassPricing({
    cards: numbered.slice(0, FIRST_PASS_PRICE_MAX),
    dbMap,
    rates,
    setCodeForBulk: oneSetId
  });
  logTiming('searchCards.firstPassPricing', {
    ms: delta(tQuickPrice),
    priced: firstPassPricing.size,
    budget: FIRST_PASS_PRICE_MAX
  });

  // FAST RETURN with prices
  if (SEARCH_FAST_PATH || DISABLE_ENRICH) {
    const tFastStart = nowMs();
    const cardsOut = buildFastReturn(numbered, { listed, forTrade, rarity }, {
      listingsMap, forTradeMap, dbMap, pricingMap: firstPassPricing
    });

    // Use filtered length so total matches returned cards
    const out = { cards: cardsOut, total: numbered.length, page, pageSize };

    logTiming('searchCards.fastReturn', {
      ms: delta(tFastStart),
      returned: cardsOut.length,
      total: out.total
    });

    // Enrichment — schedule both the small slice and the rest in the background
    if (!DISABLE_ENRICH && SEARCH_ENRICH_ASYNC && cardsOut.length > 0) {
      const syncSlice = cardsOut.slice(0, Math.min(SEARCH_SYNC_ENRICH_LIMIT, cardsOut.length)).map(c => ({
        id: c.id, set: c.set, number: c.number, rarity: c.rarity, image: c.image, setName: c.setName, setLogo: c.setLogo
      }));
      const rest = cardsOut.slice(syncSlice.length).map(c => ({
        id: c.id, set: c.set, number: c.number, rarity: c.rarity, image: c.image, setName: c.setName, setLogo: c.setLogo
      }));

      setImmediate(() => {
        if (syncSlice.length) {
          enrichCards(syncSlice, { listed, forTrade, rarity }).catch(() => {});
        }
        if (rest.length) {
          enrichCards(rest, { listed, forTrade, rarity }).catch(() => {});
        }
      });
    }

    logTiming('searchCards.total', {
      ms: delta(tStart),
      name, set: setCode, number, rarity, listed, forTrade,
      returned: out.cards.length
    });
    return out;
  }

  // Legacy synchronous enrichment path (if flags flipped off entirely)
  const tLegacyEnrich = nowMs();
  let enriched = numbered;
  try { enriched = await enrichCards(numbered, { listed, forTrade, rarity }); } catch {}
  logTiming('searchCards.legacyEnrich', { ms: delta(tLegacyEnrich), count: enriched.length });

  const out = { cards: enriched, total: enriched.length, page, pageSize };
  logTiming('searchCards.total', {
    ms: delta(tStart),
    name, set: setCode, number, rarity, listed, forTrade,
    returned: enriched.length
  });
  return out;
}

async function searchSetsResolver(_, { query }) {
  const results = [];
  for (const [code, data] of Object.entries(SET_MAPPING)) {
    if (isSetBlocked(code)) continue;
    if (!query ||
        (data.name && data.name.toLowerCase().includes(query.toLowerCase())) ||
        code.toLowerCase().includes(query.toLowerCase())) {
      results.push({
        code, name: data.name, total: data.total || null,
        tcgDexCode: data.tcgdex, logo: data.logo || null, cards: null
      });
    }
  }
  return { sets: results, total: results.length };
}

async function cardByIdResolver(_, { id }) {
  const tStart = nowMs();

  let card = await Card.findByPk(id);
  if (!card || !card.set) {
    const tTCGDex = nowMs();
    try {
      card = await withTimeout(fetchTCGDexCardById(id), 5000, 'tcgdex-byid-timeout');
    } catch {
      card = null;
    }
    logTiming('cardById.tcgdex', { ms: delta(tTCGDex), id });
    if (!card) {
      logTiming('cardById.total', { ms: delta(tStart), id, result: 'null' });
      return null;
    }
  }

  // Single-card view: we can afford full sync enrichment
  const tEnrich = nowMs();
  let enrichedArr = [card];
  try { enrichedArr = await enrichCards([card], { listed: false, forTrade: false }); } catch {}
  const enriched = enrichedArr[0];
  logTiming('cardById.enrich', { ms: delta(tEnrich), id });

  logTiming('cardById.total', { ms: delta(tStart), id, result: 'ok' });
  return enriched;
}

async function getSetResolver(_, { code }) {
  if (isSetBlocked(code)) return null;
  const cardsRes = await withTimeout(fetchTCGDexCards({ set: code }), 8000, 'tcgdex-set-timeout').catch(() => ({ cards: [] }));
  let cards = (cardsRes.cards || []).filter(card => {
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
    cards
  };
}

async function cardSetCompletionResolver(_, { userId, set }) {
  const ownedCards = await Collection.findAll({ where: { userId, set } });
  const totalOwned = new Set(ownedCards.map(card => card.cardId)).size;
  const allSetCards = await withTimeout(fetchTCGDexCards({ set }), 8000, 'tcgdex-set-timeout').catch(() => ({ cards: [] }));
  const total = getSetUniqueCardCount(set, allSetCards.cards || [], true);
  return total ? +(totalOwned / total * 100).toFixed(2) : 0;
}

async function getExchangeRatesResolver() { return getExchangeRates(); }

// Price history helpers (unchanged)
function mapVariationKey(v) {
  switch (v) {
    case 'reverse': return 'reverseHolofoil';
    case 'holo': return 'holofoil';
    case 'firstEdition': return 'firstEdition';
    case 'wPromo': return 'normal';
    default: return 'normal';
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
    order: [['fetchedAt', 'ASC']]
  });
  return rows.map(r => ({
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
  },
  Card: {
    variations: (card) => {
      if (!card.variations) return null;
      try { return typeof card.variations === 'string' ? JSON.parse(card.variations) : card.variations; }
      catch { return null; }
    },
    prices: (card) => {
      const raw = card.pricing;
      if (!raw) return [];
      try {
        const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const latest = Array.isArray(obj?.latest) ? obj.latest :
                       Array.isArray(obj) ? obj :
                       (obj && typeof obj === 'object' && obj.variation) ? [obj] : [];
        return latest.map(p => ({
          variation: p.variation,
          tcgplayer: p?.tcgplayer?.gbp ?? (typeof p.tcgplayer === 'number' ? p.tcgplayer : null),
          cardmarket: p?.cardmarket?.gbp ?? (typeof p.cardmarket === 'number' ? p.cardmarket : null),
          updatedAt: p.updatedAt
        }));
      } catch {
        return [];
      }
    },
    priceHistory: async (card, { days = 30 }) => {
      const limit = Math.min(days, 30);
      const raw = card.pricing;
      if (raw) {
        try {
          const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (obj && Array.isArray(obj.history) && obj.history.length) {
            const slice = obj.history.slice(-limit);
            return slice.flatMap(h =>
              (h.prices || []).map(p => ({
                date: h.date,
                variation: p.variation,
                gbp: p.gbp ?? null,
                tcgplayer: p.tcgplayer ?? null,
                cardmarket: p.cardmarket ?? null,
              }))
            );
          }
        } catch {}
      }
      return fetchHistoryFromTable(card.id, limit);
    },
    setName: (card) => card.setName || null,
    image: (card) => card.image || null,
    rarity: (card) => card.rarity || null,
  }
};

export default resolvers;
