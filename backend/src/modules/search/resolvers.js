// backend/src/modules/search/resolvers.js
// ESM, default export

import crypto from 'node:crypto';
import { Op } from 'sequelize';

import { Card, CardPriceCache, CardPriceHistory } from '../../models/index.js';

// helpers & providers
import { toGBP } from './api/exchangeRates.js';
import tcgdex from './api/tcgdex.js';
import ptcg from './api/pokemontcg.js';
import {
  log,
  normalizeId,
  toVendorId,
  normalizeImage,
  encodeCursor, decodeCursor,
  compareCards, stableSort, applyFilters,
  mergePriceFields, withTimeout, createLimiter,
} from './helpers.js';

/* ---------- Tunables ---------- */
const CACHE_TTL_MIN        = +(process.env.CACHE_TTL_MIN || 120); // minutes
const ENRICH_CONCURRENCY   = +(process.env.ENRICH_CONCURRENCY || 2);
const PRICE_CONCURRENCY    = +(process.env.PRICE_CONCURRENCY || 1); // serialize vendor calls
const PRICE_TIMEOUT_MS     = +(process.env.PRICE_TIMEOUT_MS || 3000);
const PRICE_TRIES          = +(process.env.PRICE_TRIES || 2);
const SAFE_CARD_TIMEOUT_MS = +(process.env.SAFE_CARD_TIMEOUT_MS || 4000);

// serialize vendor hits (PTCG endpoints)
const priceLimiter = createLimiter(PRICE_CONCURRENCY);

/* ---------- small utils ---------- */
function freshSince(date, minutes) {
  if (!date) return false;
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < minutes * 60 * 1000;
}

// Normalize any incoming variation key to our canonical set
function normalizeVariantKey(key) {
  if (!key) return null;
  const raw = String(key).trim();
  const k = raw.toLowerCase().replace(/[\s_-]/g, '');
  if (k === 'holo' || k === 'holofoil' || k === 'foil') return 'holo';
  if (k === 'reverse' || k === 'reverseholo' || k === 'reverseholofoil' || k === 'rev') return 'reverse';
  if (k === 'normal' || k === 'nonholo' || k === 'nonfoil' || k === 'nonholofoil') return 'normal';
  return raw;
}

// Try to coerce anything into a finite number (numeric string, or object with known fields)
function toNum(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;

  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;

    // JSON object-as-string?
    if (s[0] === '{' || s[0] === '[') {
      try {
        const obj = JSON.parse(s);
        return selectNumeric(obj);
      } catch {
        // fall through to parseFloat
      }
    }
    const n = parseFloat(s.replace(/[^0-9.+-eE]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  if (typeof v === 'object') {
    return selectNumeric(v);
  }
  return null;
}

// Prefer the most representative numeric field from a price-like object
function selectNumeric(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const candidates = [
    obj.market, obj.mid, obj.low, obj.high,
    obj.trendPrice, obj.averageSellPrice, obj.lowPrice,
    obj.reverseHoloTrend, obj.reverseHoloSell, obj.reverseHoloLow,
    obj.avg30, obj.avg7, obj.avg1,
  ];
  for (const c of candidates) {
    const n = toNum(c);
    if (n != null) return n;
  }
  return null;
}

// Deep-sanitize a single price entry (convert numeric-like strings to numbers)
function coercePriceEntry(entry) {
  if (!entry || typeof entry !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(entry)) {
    if (v == null) continue;
    if (typeof v === 'number') {
      if (Number.isFinite(v)) out[k] = v;
    } else if (typeof v === 'string') {
      // stringified JSON?
      const s = v.trim();
      if (s && (s[0] === '{' || s[0] === '[')) {
        try {
          const parsed = JSON.parse(s);
          if (parsed && typeof parsed === 'object') {
            for (const [pk, pv] of Object.entries(parsed)) {
              const nn = toNum(pv);
              if (nn != null) out[pk] = nn;
            }
          }
        } catch {
          const n = toNum(s);
          if (n != null) out[k] = n;
        }
      } else {
        const n = toNum(s);
        if (n != null) out[k] = n;
      }
    } else if (typeof v === 'object') {
      const n = selectNumeric(v);
      if (n != null) out[k] = n;
    }
  }
  return out;
}

// Sanitize whole map of variations -> price entry
function sanitizePriceMap(mapLike) {
  const out = {};
  if (!mapLike || typeof mapLike !== 'object') return out;
  for (const [variant, entry] of Object.entries(mapLike)) {
    const v = normalizeVariantKey(variant);
    if (!v) continue;
    out[v] = coercePriceEntry(entry);
  }
  return out;
}

/* ---------- unified array pricing helpers ---------- */

function ymdSlash(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

function isUnifiedArray(val) {
  return Array.isArray(val) && val.every(
    (x) => x && typeof x === 'object' && typeof x.variation === 'string'
  );
}

// Prefer TCGplayer numeric signal from a vendor entry
function pickTcgplayerNumber(entry) {
  return toNum(
    entry?.tcgplayer ??
    entry?.market ??
    entry?.mid ??
    entry?.low ??
    entry?.high ??
    entry?.usd ??
    entry?.price
  );
}

// Prefer Cardmarket numeric signal from a vendor entry
function pickCardmarketNumber(entry) {
  return toNum(
    entry?.cardmarket ??
    entry?.trendPrice ??
    entry?.averageSellPrice ??
    entry?.lowPrice ??
    entry?.reverseHoloTrend ??
    entry?.eur
  );
}

// Turn a { variation -> vendorFields } map into unified array entries
function mapToUnifiedArray(priceMap, dateForUpdatedAt = new Date()) {
  if (!priceMap || typeof priceMap !== 'object' || Array.isArray(priceMap)) return [];
  const updatedAt = ymdSlash(dateForUpdatedAt);
  const out = [];
  for (const [rawVar, entry] of Object.entries(priceMap)) {
    const variation = normalizeVariantKey(rawVar);
    const tgp = pickTcgplayerNumber(entry);
    const cmk = pickCardmarketNumber(entry);
    if (variation && (tgp != null || cmk != null)) {
      out.push({ variation, tcgplayer: tgp ?? null, cardmarket: cmk ?? null, updatedAt });
    }
  }
  return out;
}

/**
 * Reconcile unified rows so Cardmarket aligns with the correct visible variant.
 * - If we have a Holo row (TCGplayer) and a Normal row with ONLY Cardmarket,
 *   move CM from Normal → Holo and drop Normal (phantom CM container).
 * - Reverse remains its own row and never merges into Holo/Normal.
 * - If Normal also has TCGplayer, keep it (no merge).
 */
function reconcileUnifiedVariants(unified) {
  if (!Array.isArray(unified)) return [];
  const toN = (v) => (v == null ? null : toNum(v));

  const byVar = new Map(
    unified.map((e) => [normalizeVariantKey(e.variation), { ...e, variation: normalizeVariantKey(e.variation) }])
  );

  const holo = byVar.get('holo');
  const normal = byVar.get('normal');

  if (holo && normal) {
    const holoTgp = toN(holo.tcgplayer);
    const holoCmk = toN(holo.cardmarket);
    const normalTgp = toN(normal.tcgplayer);
    const normalCmk = toN(normal.cardmarket);

    // Only “steal” CM from normal if normal has no TCGplayer (phantom) and holo needs CM
    if (holoTgp != null && holoCmk == null && normalTgp == null && normalCmk != null) {
      holo.cardmarket = normal.cardmarket; // copy CM to holo
      byVar.set('holo', holo);
      byVar.delete('normal');
    }
  }

  // prune any empty rows
  for (const [k, v] of byVar) {
    const hasAny = toN(v.tcgplayer) != null || toN(v.cardmarket) != null;
    if (!hasAny) byVar.delete(k);
  }

  // stable order: normal, holo, reverse, then lexicographic
  const order = { normal: 0, holo: 1, reverse: 2 };
  const rows = Array.from(byVar.values());
  rows.sort((a, b) => {
    const ak = a.variation; const bk = b.variation;
    const pa = (order[ak] ?? 99), pb = (order[bk] ?? 99);
    if (pa !== pb) return pa - pb;
    return String(ak).localeCompare(String(bk));
  });

  return rows;
}

/* ---------- “Upgrade” helper to fill Cardmarket gaps & synthesize reverse when expected ---------- */

function expectsReverse(rarity) {
  const r = String(rarity || '').toLowerCase();
  return r === 'common' || r === 'uncommon' || r === 'rare';
}

function shallowCloneUnified(unified) {
  return unified.map((u) => ({ ...u }));
}

function unifiedChanged(a, b) {
  try {
    return JSON.stringify(a) !== JSON.stringify(b);
  } catch {
    return true;
  }
}

/**
 * If cached/DB unified is missing Cardmarket (or reverse for C/U/R),
 * fetch the full card payload once and enrich.
 */
async function enrichWithCardmarketIfMissing(card, unifiedIn) {
  const unified = shallowCloneUnified(unifiedIn);
  const byVar = new Map(unified.map((u) => [normalizeVariantKey(u.variation), u]));

  const hasReverseRow = byVar.has('reverse');
  const needsReverse = expectsReverse(card?.rarity) && !hasReverseRow;

  const missingCmk =
    unified.some((u) => (u.variation === 'normal' || u.variation === 'reverse') && u.cardmarket == null) ||
    (needsReverse); // try to add reverse via CM if applicable

  if (!missingCmk) {
    return { unified: reconcileUnifiedVariants(unified), changed: false };
  }

  // Attempt enrichment
  try {
    const vendorId = toVendorId(card.id);
    const pt = await withTimeout(
      priceLimiter(() => ptcg.getCardById(vendorId)),
      Math.max(PRICE_TIMEOUT_MS, SAFE_CARD_TIMEOUT_MS)
    );

    if (pt && pt.cardmarket && pt.cardmarket.prices) {
      const cm = pt.cardmarket.prices;
      const cmNormal = selectNumeric({
        trendPrice: cm.trendPrice,
        averageSellPrice: cm.averageSellPrice,
        lowPrice: cm.lowPrice,
      });
      const cmReverse = selectNumeric({
        reverseHoloTrend: cm.reverseHoloTrend,
        reverseHoloSell: cm.reverseHoloSell,
        reverseHoloLow: cm.reverseHoloLow,
      });

      const today = ymdSlash(new Date());

      // normal
      if (cmNormal != null) {
        if (!byVar.has('normal')) {
          byVar.set('normal', { variation: 'normal', tcgplayer: null, cardmarket: cmNormal, updatedAt: today });
        } else {
          const row = byVar.get('normal');
          if (row.cardmarket == null) {
            row.cardmarket = cmNormal;
            row.updatedAt = today;
          }
          byVar.set('normal', row);
        }
      }

      // reverse
      if (cmReverse != null) {
        if (!byVar.has('reverse')) {
          byVar.set('reverse', { variation: 'reverse', tcgplayer: (byVar.get('reverse')?.tcgplayer ?? null), cardmarket: cmReverse, updatedAt: today });
        } else {
          const row = byVar.get('reverse');
          if (row.cardmarket == null) {
            row.cardmarket = cmReverse;
            row.updatedAt = today;
          }
          byVar.set('reverse', row);
        }
      }
    }
  } catch {
    // swallow: we'll just return original if we couldn't enrich
  }

  const out = reconcileUnifiedVariants(Array.from(byVar.values()));
  return { unified: out, changed: unifiedChanged(unifiedIn, out) };
}

/* ---------- DB helpers ---------- */
async function upsertCard(core) {
  const exists = await Card.findByPk(core.id);
  if (exists) {
    await Card.update({ updatedAt: new Date() }, { where: { id: core.id } });
    return exists;
  } else {
    await Card.create({
      ...core,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    log.cardDbInserted?.(core.id);
    return core;
  }
}

async function appendPriceHistory(cardId, variationRaw, tgpVal, cmktVal, gbp, currency = 'GBP') {
  // FK safety
  const exists = await Card.count({ where: { id: cardId } });
  if (!exists) {
    log.warn?.(`[PRICE][HISTORY] skip ${cardId} – parent row missing`);
    return;
  }

  const variation = normalizeVariantKey(variationRaw) || 'normal';

  const safeGBP = Number.isFinite(gbp) ? gbp : null;
  const fetchedAt = new Date();
  try {
    await CardPriceHistory.create({
      id: crypto.randomUUID(),
      cardId,
      variation,
      tcgplayer: tgpVal ?? null,
      cardmarket: cmktVal ?? null,
      gbp: safeGBP,
      currency,
      fetchedAt,
      createdAt: fetchedAt,
      updatedAt: fetchedAt,
    });

    // trim >30 days old
    const olderThan = new Date(fetchedAt.getTime() - 30 * 24 * 3600 * 1000);
    await CardPriceHistory.destroy({
      where: { cardId, fetchedAt: { [Op.lt]: olderThan } },
    });
  } catch (e) {
    log.error?.(`[PRICE][HISTORY] create failed for ${cardId}: ${e.message}`);
  }
}

/** Cache now stores the unified array shape */
async function getFreshPricesFromCache(cardId) {
  const row = await CardPriceCache.findOne({ where: { cardId }, raw: true });
  if (!row) return null;
  const t = new Date(row.lastFetched || row.updatedAt || 0).getTime();
  if (!Number.isFinite(t)) return null;
  if (Date.now() - t > CACHE_TTL_MIN * 60_000) return null;

  const blob = row.tcgplayer || row.cardmarket;
  if (!blob) return null;

  if (isUnifiedArray(blob)) {
    const arr = blob.length ? blob : null;
    return arr ? reconcileUnifiedVariants(arr) : null;
  }

  // older cache shape: variation-map → convert (only if non-empty)
  if (typeof blob === 'object' && !Array.isArray(blob)) {
    const map = sanitizePriceMap(blob);
    if (!Object.keys(map).length) return null;
    return reconcileUnifiedVariants(mapToUnifiedArray(map, new Date(row.lastFetched || row.updatedAt)));
  }

  return null;
}

async function savePricesToCache(cardId, pricesUnified) {
  const now = new Date();
  const existing = await CardPriceCache.findOne({ where: { cardId } });

  const payload = {
    // store unified array in both JSON columns so either path works
    tcgplayer: pricesUnified ?? null,
    cardmarket: pricesUnified ?? null,
    lastFetched: now,
    updatedAt: now,
  };

  if (existing) {
    await CardPriceCache.update(payload, { where: { cardId } });
  } else {
    await CardPriceCache.create({
      id: crypto.randomUUID(),
      cardId,
      createdAt: now,
      ...payload,
    });
  }
}

/* Prefer fresh DB pricing (row JSON) before upstream — only if NON-EMPTY */
async function getFreshDbPrices(cardId) {
  const row = await Card.findByPk(normalizeId(cardId));
  if (!row) return null;
  const json = row.get?.() || row;
  const p = json?.pricing;
  if (!p) return null;
  if (!freshSince(json.updatedAt, CACHE_TTL_MIN)) return null;

  // only accept non-empty payloads
  if (isUnifiedArray(p)) {
    return p.length ? reconcileUnifiedVariants(p) : null;
  }

  if (typeof p === 'object' && !Array.isArray(p)) {
    const map = sanitizePriceMap(p);
    if (!Object.keys(map).length) return null;
    return reconcileUnifiedVariants(mapToUnifiedArray(map, new Date(json.updatedAt)));
  }

  return null;
}

/* Allow using stale row JSON if live fetch fails — only if NON-EMPTY */
async function getAnyDbPrices(cardId) {
  const row = await Card.findByPk(normalizeId(cardId));
  if (!row) return null;
  const json = row.get?.() || row;
  const p = json?.pricing;
  if (!p) return null;

  if (isUnifiedArray(p)) {
    return p.length ? reconcileUnifiedVariants(p) : null;
  }

  if (typeof p === 'object' && !Array.isArray(p)) {
    const map = sanitizePriceMap(p);
    if (!Object.keys(map).length) return null;
    return reconcileUnifiedVariants(mapToUnifiedArray(map, new Date(json.updatedAt)));
  }

  return null;
}

/* Build unified array from latest history rows (numeric only) */
async function getLatestHistoryUnified(cardId) {
  const rows = await CardPriceHistory.findAll({
    where: { cardId: normalizeId(cardId) },
    attributes: ['variation','tcgplayer','cardmarket','fetchedAt'],
    order: [['fetchedAt', 'DESC']],
    raw: true,
  });
  if (!rows.length) return null;

  const firstPerVar = new Map();
  for (const r of rows) {
    const v = normalizeVariantKey(r.variation) || 'normal';
    if (firstPerVar.has(v)) continue;
    firstPerVar.set(v, { ...r, variation: v });
  }

  const out = [];
  for (const r of firstPerVar.values()) {
    const tgp = toNum(r.tcgplayer);
    const cmk = toNum(r.cardmarket);
    if (tgp != null || cmk != null) {
      out.push({
        variation: r.variation,
        tcgplayer: tgp ?? null,
        cardmarket: cmk ?? null,
        updatedAt: ymdSlash(new Date(r.fetchedAt)),
      });
    }
  }

  return out.length ? reconcileUnifiedVariants(out) : null;
}

/* ---------- Provider multiplex search ---------- */
async function searchUpstream({ name, set, number, trustUpstream }) {
  const t0 = Date.now();

  const [tcgList, ptcgList] = await Promise.allSettled([
    tcgdex.searchCards({ name, set, number }),
    ptcg.searchCards({ name, set, number }),
  ]);

  const a = tcgList.status === 'fulfilled' ? tcgList.value : [];
  const b = ptcgList.status === 'fulfilled' ? ptcgList.value : [];

  const byId = new Map();
  for (const c of a) if (c?.id) byId.set(normalizeId(c.id), c);
  for (const c of b) {
    if (!c?.id) continue;
    const key = normalizeId(c.id);
    byId.set(key, { ...byId.get(key), ...c });
  }

  const merged = Array.from(byId.values());
  log.timing?.({ ms: Date.now() - t0, label: 'searchCards.patchMissing' });

  let filtered = merged;
  if (!trustUpstream) {
    // allow set === null/undefined/'' (no filter)
    filtered = filtered.filter(
      (c) => !set || (c.set || '').toLowerCase() === String(set).toLowerCase()
    );
  }

  log.timing?.({
    before: merged.length,
    after: filtered.length,
    set,
    mode: trustUpstream ? 'trustUpstream' : undefined,
    label: 'searchCards.filter',
  });

  return filtered;
}

/* ---------- Lightweight hydration for missing fields ---------- */
async function hydrateFromDexIfNeeded(card) {
  const need = !card?.rarity || !card?.setName || !card?.image;
  if (!need) return card;

  // TCGdex preferred for rarity, setName, image
  try {
    const dex = await withTimeout(tcgdex.getCardById?.(normalizeId(card.id)), SAFE_CARD_TIMEOUT_MS);
    if (dex) {
      if (!card.rarity && dex.rarity) card.rarity = dex.rarity;
      if (!card.setName && dex.setName) card.setName = dex.setName;
      if (!card.image && dex.image) card.image = dex.image;
    }
  } catch {}

  // Fallback: PTCG API (images.large/small)
  if (!card.rarity || !card.setName || !card.image) {
    try {
      const vendorId = toVendorId(card.id);
      const pt = await withTimeout(priceLimiter(() => ptcg.getCardById(vendorId)), SAFE_CARD_TIMEOUT_MS);
      if (pt) {
        if (!card.rarity && pt.rarity) card.rarity = pt.rarity;
        if (!card.setName && pt.setName) card.setName = pt.setName;
        const ptImg = pt?.images?.large || pt?.images?.small || null;
        if (!card.image && ptImg) card.image = ptImg;
      }
    } catch {}
  }

  return card;
}

/* ---------- Compose unified prices (TCGplayer + Cardmarket) ---------- */

function mergeIntoVariant(target, variantRaw, obj) {
  const variant = normalizeVariantKey(variantRaw);
  if (!variant || !obj) return;
  target[variant] = { ...(target[variant] || {}), ...obj };
}

function composeUnifiedPricesFromPtCard(ptCard) {
  const out = {};

  // --- TCGplayer (per-variation object) ---
  const tgp = ptCard?.tcgplayer?.prices || {};
  for (const [k, v] of Object.entries(tgp)) {
    if (!v || typeof v !== 'object') continue;
    mergeIntoVariant(out, k, {
      low: toNum(v.low),
      mid: toNum(v.mid),
      high: toNum(v.high),
      market: toNum(v.market),
      directLow: toNum(v.directLow),
    });
  }

  // --- Cardmarket (single object with normal+reverse metrics) ---
  const cm = ptCard?.cardmarket?.prices || null;
  if (cm && typeof cm === 'object') {
    mergeIntoVariant(out, 'normal', {
      averageSellPrice: toNum(cm.averageSellPrice),
      lowPrice: toNum(cm.lowPrice),
      trendPrice: toNum(cm.trendPrice),
    });
    mergeIntoVariant(out, 'reverse', {
      reverseHoloSell: toNum(cm.reverseHoloSell),
      reverseHoloLow: toNum(cm.reverseHoloLow),
      reverseHoloTrend: toNum(cm.reverseHoloTrend),
    });
  }

  return out;
}

async function composeFromTcgplayerOnly(vendorId, rawMap) {
  const out = {};
  for (const [k, v] of Object.entries(rawMap || {})) {
    if (!v || typeof v !== 'object') continue;
    mergeIntoVariant(out, k, {
      low: toNum(v.low),
      mid: toNum(v.mid),
      high: toNum(v.high),
      market: toNum(v.market),
      directLow: toNum(v.directLow),
    });
  }

  // quick enrichment with Cardmarket by fetching the card payload (give it a fair timeout)
  try {
    const pt = await withTimeout(
      priceLimiter(() => ptcg.getCardById(vendorId)),
      Math.max(PRICE_TIMEOUT_MS, SAFE_CARD_TIMEOUT_MS)
    );
    if (pt) {
      const cm = pt?.cardmarket?.prices || null;
      if (cm && typeof cm === 'object') {
        mergeIntoVariant(out, 'normal', {
          averageSellPrice: toNum(cm.averageSellPrice),
          lowPrice: toNum(cm.lowPrice),
          trendPrice: toNum(cm.trendPrice),
        });
        mergeIntoVariant(out, 'reverse', {
          reverseHoloSell: toNum(cm.reverseHoloSell),
          reverseHoloLow: toNum(cm.reverseHoloLow),
          reverseHoloTrend: toNum(cm.reverseHoloTrend),
        });
      }
    }
  } catch {}

  return out;
}

/* ---------- Pricing fetch (cache/db-first; vendor with limiter + retries) ---------- */
async function fetchPricesForCard(card) {
  const canon = normalizeId(card.id);

  // (A) fresh row JSON (unified array) — only if non-empty
  const dbFresh = await getFreshDbPrices(canon);
  if (dbFresh) {
    const { unified, changed } = await enrichWithCardmarketIfMissing(card, dbFresh);
    if (changed && unified.length) await savePricesToCache(canon, unified);
    return unified; // unified (possibly enriched)
  }

  // (B) cache-first (unified array) — only if non-empty
  const cached = await getFreshPricesFromCache(canon);
  if (cached) {
    const { unified, changed } = await enrichWithCardmarketIfMissing(card, cached);
    if (changed && unified.length) await savePricesToCache(canon, unified);
    return unified; // unified (possibly enriched)
  }

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const tryOnce = async (i) => {
    // 1) Direct prices endpoint (TCGplayer)
    try {
      const vendorIdPrices = toVendorId(canon, 'prices');
      const tgpMap = await withTimeout(
        priceLimiter(() => ptcg.getPricesById(vendorIdPrices)),
        PRICE_TIMEOUT_MS
      );
      if (tgpMap && Object.keys(tgpMap).length) {
        log.priceOk?.(vendorIdPrices, `prices endpoint (try ${i})`);
        const unifiedMap = await composeFromTcgplayerOnly(toVendorId(canon, 'ptcg'), tgpMap);
        if (unifiedMap && Object.keys(unifiedMap).length) return sanitizePriceMap(unifiedMap); // MAP (live)
      }
      throw new Error('empty-prices');
    } catch (e) {
      log.priceErr?.(toVendorId(canon, 'prices'), i, e.code || null);
    }

    // 2) Fetch full card; compose TCGplayer + Cardmarket
    try {
      const vendorIdCard = toVendorId(canon, 'ptcg');
      const ptCard = await withTimeout(
        priceLimiter(() => ptcg.getCardById(vendorIdCard)),
        PRICE_TIMEOUT_MS
      );
      if (!ptCard) throw new Error('ptcg-byid-timeout');

      const unifiedMap = composeUnifiedPricesFromPtCard(ptCard);
      if (unifiedMap && Object.keys(unifiedMap).length) {
        log.priceOk?.(vendorIdCard, 'inline card.tcgplayer + cardmarket');
        return sanitizePriceMap(unifiedMap); // MAP (live)
      }

      // last fallback: prices endpoint again (tgp-only)
      const tgpMap = await withTimeout(
        priceLimiter(() => ptcg.getPricesById(vendorIdCard)),
        PRICE_TIMEOUT_MS
      );
      if (tgpMap && Object.keys(tgpMap).length) {
        log.priceOk?.(vendorIdCard, 'card-by-id fallback (tgp only)');
        return sanitizePriceMap(await composeFromTcgplayerOnly(vendorIdCard, tgpMap)); // MAP (live)
      }
      throw new Error('empty-prices');
    } catch (e) {
      log.priceFallbackErr?.(toVendorId(canon, 'ptcg'), e.message || 'ptcg-byid-timeout');
      return null;
    }
  };

  let pricesMap = null;
  for (let i = 1; i <= PRICE_TRIES; i++) {
    pricesMap = await tryOnce(i);
    if (pricesMap) break;
    // exp backoff with jitter (short)
    const backoff = Math.min(1200 * i, 4000) + Math.floor(Math.random() * 250);
    await delay(backoff);

    // optional last-resort rescue on final attempt
    if (!pricesMap && i === PRICE_TRIES) {
      try {
        const vendorId = toVendorId(canon, 'prices');
        const rescue = await withTimeout(
          priceLimiter(() => ptcg.getPricesById(vendorId)),
          Math.max(PRICE_TIMEOUT_MS, 7000)
        );
        if (rescue && Object.keys(rescue).length) {
          log.priceOk?.(vendorId, 'rescue prices endpoint');
          pricesMap = sanitizePriceMap(await composeFromTcgplayerOnly(toVendorId(canon, 'ptcg'), rescue)); // MAP (live)
          break;
        }
      } catch {}
    }
  }

  if (pricesMap && Object.keys(pricesMap).length) {
    // Cache unified array (reconciled), return MAP so caller can append history
    let unifiedArr = mapToUnifiedArray(pricesMap);
    unifiedArr = reconcileUnifiedVariants(unifiedArr);
    if (unifiedArr.length) await savePricesToCache(canon, unifiedArr);
    return unifiedArr; // return unified directly
  }

  // STALE DB JSON (unified, non-empty)
  const anyDb = await getAnyDbPrices(canon);
  if (anyDb && anyDb.length) {
    log.warn?.(`[PRICE][FALLBACK] using stale DB JSON for ${canon}`);
    const { unified } = await enrichWithCardmarketIfMissing(card, anyDb);
    return unified; // unified (possibly enriched)
  }

  // LATEST HISTORY ROWS (unified)
  const hist = await getLatestHistoryUnified(canon);
  if (hist) {
    log.warn?.(`[PRICE][FALLBACK] using latest history rows for ${canon}`);
    const { unified } = await enrichWithCardmarketIfMissing(card, hist);
    return unified; // unified (possibly enriched)
  }

  return []; // unified empty
}

/* ---------- Enrich slice ---------- */
async function enrichCards(cards) {
  const t0 = Date.now();
  const limit = createLimiter(ENRICH_CONCURRENCY);

  const out = await Promise.all(
    cards.map((card) =>
      limit(async () => {
        // Ensure parent row (FK safety for history)
        await upsertCard({
          id: normalizeId(card.id),
          name: card.name ?? null,
          number: card.number ?? null,
          set: card.set ?? null,
          setName: card.setName ?? null,
          image: normalizeImage(card.image ?? null),
          rarity: card.rarity ?? null,
          variations: Array.isArray(card.variations) ? card.variations.map(normalizeVariantKey) : [],
          pricing: (card.pricing && typeof card.pricing === 'object') ? card.pricing : {}, // <-- map
        });

        // Hydrate missing display fields
        await hydrateFromDexIfNeeded(card);

        // Fetch prices (db/cache-first + retries; inline fallback)
        const pricesData = await fetchPricesForCard(card);

        if (isUnifiedArray(pricesData)) {
          // Unified array path (already reconciled/enriched)
          card.pricing = pricesData;
        } else if (pricesData && typeof pricesData === 'object' && Object.keys(pricesData).length) {
          // Live MAP path: make sure we have a MAP to merge into
          if (!card.pricing || typeof card.pricing !== 'object' || Array.isArray(card.pricing)) {
            card.pricing = {};
          }

          const cleanMap = sanitizePriceMap(pricesData);

          for (const [variant, entry] of Object.entries(cleanMap)) {
            // merge into MAP
            mergePriceFields(card, entry, variant);

            const tgp = selectNumeric({ market: entry.market, mid: entry.mid, low: entry.low, high: entry.high }); // USD-ish
            const cmk = selectNumeric({
              trendPrice: entry.trendPrice,
              averageSellPrice: entry.averageSellPrice,
              lowPrice: entry.lowPrice,
              reverseHoloTrend: entry.reverseHoloTrend,
              reverseHoloSell: entry.reverseHoloSell,
              reverseHoloLow: entry.reverseHoloLow,
            }); // EUR-ish

            const basis = (typeof tgp === 'number' && Number.isFinite(tgp)) ? tgp
                        : (typeof cmk === 'number' && Number.isFinite(cmk)) ? cmk
                        : null;

            // correct currency for GBP conversion
            let gbp = null;
            if (basis != null) {
              const srcCurrency = (tgp != null) ? 'USD' : 'EUR';
              gbp = toGBP(basis, srcCurrency);
              if (!Number.isFinite(gbp)) gbp = null;
            }

            if (tgp != null || cmk != null) {
              await appendPriceHistory(card.id, variant, tgp ?? null, cmk ?? null, gbp, 'GBP');
            }
          }

          // Normalize MAP -> unified array for GraphQL JSON, then reconcile
          card.pricing = reconcileUnifiedVariants(mapToUnifiedArray(cleanMap));
        } else {
          // Last resort: ensure array
          card.pricing = [];
        }

        // Reflect normalized variations from unified array
        card.variations = Array.isArray(card.pricing)
          ? Array.from(new Set(card.pricing.map((p) => normalizeVariantKey(p.variation)))).sort()
          : Array.isArray(card.variations) ? card.variations.map(normalizeVariantKey).sort() : [];

        // Persist normalized pricing blob (unified array)
        await Card.update(
          {
            pricing: card.pricing,
            tcgplayerVariations: card.pricing,   // mirrors maintained for compatibility
            cardmarketVariations: card.pricing,
            updatedAt: new Date(),
          },
          { where: { id: card.id } },
        );

        // Always normalize image on the way out
        card.image = normalizeImage(card.image);
        return card;
      })
    ),
  );

  log.timing?.({
    ms: Date.now() - t0,
    count: out.length,
    listed: false,
    forTrade: false,
    rarity: false,
    label: 'enrichCards',
  });

  return out;
}

async function firstPassPricing(cards, budget) {
  const t0 = Date.now();
  const toPrice = cards.slice(0, Math.max(0, budget));
  const enriched = await enrichCards(toPrice);
  log.timing?.({
    ms: Date.now() - t0,
    returned: enriched.length,
    usedDb: 0,
    usedBulk: 0,
    usedLive: 0,
    label: 'firstPassPricing.total',
  });
  return enriched;
}

/* ---------- GraphQL Resolvers ---------- */
const Query = {
  async searchCards(_, { input }) {
    const start = Date.now();
    const {
      name: nameRaw = '',
      set: setRaw = null,            // allow null
      number: numberRaw = '',
      listed,
      forTrade,
      rarity,
      first = 25,
      after,
      budget = 8,
      trustUpstream = false,
    } = input || {};

    // Normalize strings; allow null set
    const name = String(nameRaw || '').trim();
    const set = (setRaw == null) ? '' : String(setRaw).trim();
    const number = String(numberRaw || '').trim();

    // 1) Upstream
    const upstream = await searchUpstream({ name, set, number, trustUpstream });

    // 2) Filters (includes Pocket-set block in helpers)
    let filtered = applyFilters(upstream, { listed, forTrade, rarity });

    // 3) Deterministic sort
    filtered = stableSort(filtered, compareCards);

    // 4) Cursor pagination
    let startIndex = 0;
    if (after) {
      const cur = decodeCursor(after);
      if (cur?.id) {
        const idx = filtered.findIndex((c) => normalizeId(c.id) === normalizeId(cur.id));
        if (idx >= 0) startIndex = idx + 1;
      }
    }

    // Page slice and pre-normalize so GraphQL never sees nulls
    const slice = filtered
      .slice(startIndex, startIndex + first)
      .map((c) => {
        const out = { ...c };
        out.id = normalizeId(out.id);
        out.image = normalizeImage(out.image ?? null);
        if (!Array.isArray(out.variations)) out.variations = [];
        // IMPORTANT: use MAP here so mergePriceFields can populate it
        if (!out.pricing || typeof out.pricing !== 'object' || Array.isArray(out.pricing)) out.pricing = {};
        return out;
      });

    // Upsert parents BEFORE any enrichment/history to avoid FK issues
    for (const c of slice) {
      await upsertCard({
        id: c.id,
        name: c.name ?? null,
        number: c.number ?? null,
        set: c.set ?? null,
        setName: c.setName ?? null,
        image: c.image ?? null,
        rarity: c.rarity ?? null,
        variations: c.variations,
        pricing: c.pricing, // map at this point
      });
    }

    // Build edges now; nodes will be mutated by enrichment
    const edges = slice.map((c) => ({
      cursor: encodeCursor({ id: c.id }),
      node: c,
    }));
    const hasNextPage = startIndex + first < filtered.length;
    const endCursor = edges.length ? edges[edges.length - 1].cursor : null;

    // 5) First pass pricing (best-effort)
    await firstPassPricing(slice, budget);

    // 6) After enrichment, pricing is unified array already

    const total = filtered.length;
    log.timing?.({
      ms: Date.now() - start,
      name,
      set,
      number,
      returned: slice.length,
      total,
      label: 'searchCards.total',
    });

    return {
      edges,
      pageInfo: { hasNextPage, endCursor },
      totalCount: total,
    };
  },

  async card(_, { id }) {
    const canon = normalizeId(id);
    const row = await Card.findByPk(canon);
    if (row) return row.toJSON();

    const vendorId = toVendorId(canon);
    const c = await ptcg.getCardById(vendorId);
    if (!c) return null;
    c.id = canon;
    c.image = normalizeImage(c.image ?? c?.images?.large ?? c?.images?.small ?? null);
    if (!Array.isArray(c.variations)) c.variations = [];
    // store as MAP initially; enrichment will normalize to array
    if (!c.pricing || typeof c.pricing !== 'object' || Array.isArray(c.pricing)) c.pricing = {};
    await upsertCard(c);
    return c;
  },
};

export default { Query };
