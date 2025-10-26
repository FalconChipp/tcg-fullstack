// src/modules/cardsearch/adapters/priceAdapter.ptcgio.service.js
// PTCG.io price adapter
// - Input: set (abbr|tcgdex|ptcg), cardNumbers[], optional variantsByNumber
// - Output: normalized observations in provider currency
//
// Env:
//   PTCGIO_BASE (default 'https://api.ptcg.io')  <-- adjustable; endpoint patterns vary by deployment

let _fetch = globalThis.fetch;
if (typeof _fetch !== "function") {
  const { fetch } = await import("undici");
  _fetch = fetch;
}

import { resolveToPTCG } from "../services/setMapping.service.js";
import { canonicalVariantKey, canonicalVariantSet } from "../services/variant.service.js";

const PTCGIO_BASE = process.env.PTCGIO_BASE || "https://api.ptcg.io";

/**
 * Attempt to fetch price info per card number from PTCG.io-like API.
 * Since instances differ, we implement a flexible probe:
 *  1) GET /v1/sets/{ptcgCode}/cards/{number}
 *  2) Fallback: GET /v1/cards/{ptcgCode}-{number}
 *  3) Fallback: GET /cards/{ptcgCode}-{number}
 *
 * We then look for price-like fields and normalize.
 */
export async function fetchPricesPTCGIO({ set, cardNumbers, variantsByNumber = {} }) {
  const ptcgCode = resolveToPTCG(set);
  if (!ptcgCode) throw new Error(`PTCG.io: unable to resolve set from '${set}'`);
  if (!Array.isArray(cardNumbers) || cardNumbers.length === 0) return [];

  const nowISO = new Date().toISOString();
  const out = [];

  for (const number of cardNumbers) {
    const cardId = `${ptcgCode}-${String(number)}`; // provider id shape, not our canonical
    const candidateUrls = [
      `${PTCGIO_BASE}/v1/sets/${encodeURIComponent(ptcgCode)}/cards/${encodeURIComponent(number)}`,
      `${PTCGIO_BASE}/v1/cards/${encodeURIComponent(ptcgCode)}-${encodeURIComponent(number)}`,
      `${PTCGIO_BASE}/cards/${encodeURIComponent(ptcgCode)}-${encodeURIComponent(number)}`,
    ];

    let raw = null;
    for (const url of candidateUrls) {
      raw = await fetchJsonSafe(url);
      if (raw) break;
    }
    if (!raw) continue;

    // Try a few common shapes:
    // raw.prices || raw.data?.prices || raw.card?.prices
    const pricePayloads = collectPricePayloads(raw);
    if (!pricePayloads.length) continue;

    const variantSet = canonicalVariantSet(variantsByNumber[number]);
    const remapVariant = createVariantResolver(variantSet);
    const canonicalId = `${resolveToCanonicalSet(ptcgCode)}-${String(number)}`;

    for (const payload of pricePayloads) {
      const variant = remapVariant(payload.variant);
      if (!variant) continue;
      const amount = num(payload.market);
      if (amount == null) continue;
      out.push({
        card_id: canonicalId,
        variant,
        currency: payload.currency || "USD",
        amount,
        observed_at: payload.observedAt || nowISO,
        source: payload.source,
        meta: payload.meta,
      });
    }
  }

  return out;
}

async function fetchJsonSafe(url, { retries = 2 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await _fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        if (res.status === 404) return null;
        // For permissive instances, 429 is possible — small backoff and retry
        if (res.status === 429 && i < retries) {
          await new Promise((r) => setTimeout(r, 800 * (i + 1)));
          continue;
        }
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
      }
      // Some endpoints return { data: {...} }
      const json = await res.json();
      return json?.data ?? json;
    } catch (e) {
      lastErr = e;
      if (i === retries) break;
      await new Promise((r) => setTimeout(r, 450 * Math.pow(1.6, i)));
    }
  }
  return null;
}

function num(v) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function collectPricePayloads(raw) {
  const payloads = [];
  const seenVariants = new Set();

  const sections = [
    { node: raw, label: "ptcgio" },
    { node: raw?.prices, label: "ptcgio" },
    { node: raw?.data, label: "ptcgio:data" },
    { node: raw?.data?.prices, label: "ptcgio:data" },
    { node: raw?.card, label: "ptcgio:card" },
    { node: raw?.card?.prices, label: "ptcgio:card" },
    { node: raw?.tcgplayer, label: "ptcgio:tcgplayer" },
    { node: raw?.tcgplayer?.prices, label: "ptcgio:tcgplayer" },
    { node: raw?.data?.tcgplayer, label: "ptcgio:tcgplayer" },
    { node: raw?.data?.tcgplayer?.prices, label: "ptcgio:tcgplayer" },
    { node: raw?.cardmarket, label: "ptcgio:cardmarket" },
    { node: raw?.cardmarket?.prices, label: "ptcgio:cardmarket" },
    { node: raw?.data?.cardmarket, label: "ptcgio:cardmarket" },
    { node: raw?.data?.cardmarket?.prices, label: "ptcgio:cardmarket" },
  ];

  for (const { node, label } of sections) {
    if (!node || typeof node !== "object") continue;

    const base = pickSimplePrice(node);
    const variants = pickVariantPrices(node);

    for (const [variant, entry] of variants) {
      if (seenVariants.has(variant)) continue;
      if (entry.market == null) continue;
      payloads.push({
        variant,
        market: entry.market,
        currency: entry.currency,
        observedAt: entry.observedAt,
        source: entry.source || label || "ptcgio",
        meta: entry.meta,
      });
      seenVariants.add(variant);
    }

    if (base && base.market != null && !seenVariants.has("normal")) {
      payloads.push({
        variant: "normal",
        market: base.market,
        currency: base.currency,
        observedAt: base.observedAt,
        source: base.source || label || "ptcgio",
        meta: base.meta,
      });
      seenVariants.add("normal");
    }
  }

  return payloads;
}

function pickSimplePrice(section) {
  const currency = deduceCurrency(section);
  const low = num(section.low ?? section.floor ?? section.min ?? section.p10 ?? section.lowest ?? section.cheapest);
  const mid = num(section.mid ?? section.median ?? section.avg ?? section.average);
  const high = num(section.high ?? section.ceiling ?? section.max ?? section.p90 ?? section.highest);
  const market = num(section.market ?? section.price ?? section.value ?? mid ?? low ?? high);
  const observedAt = typeof section.updated === "string"
    ? section.updated
    : typeof section.updatedAt === "string"
      ? section.updatedAt
      : null;
  if (market == null && low == null && mid == null && high == null) {
    return null;
  }
  return { currency, market, low, mid, high, observedAt, meta: section };
}

function pickVariantPrices(section) {
  const entries = new Map();
  for (const [key, value] of Object.entries(section)) {
    if (!value || typeof value !== "object") continue;
    const variant = canonicalVariantKey(key, { fallback: null });
    if (!variant) continue;
    const price = pickSimplePrice(value);
    if (!price || price.market == null) continue;
    if (!entries.has(variant)) {
      entries.set(variant, price);
    }
  }
  return entries;
}

function deduceCurrency(section) {
  const direct = typeof section.currency === "string" ? section.currency.toUpperCase() : null;
  if (direct) return direct;
  if (section.usd != null) return "USD";
  if (section.eur != null) return "EUR";
  if (section.gbp != null) return "GBP";
  if (typeof section.currencyCode === "string") return section.currencyCode.toUpperCase();
  return null;
}

function createVariantResolver(variantSet) {
  const accepted = new Set(variantSet || []);
  const singleton = accepted.size === 1 ? [...accepted][0] : null;

  return (incoming) => {
    const variant = canonicalVariantKey(incoming, { fallback: null }) || incoming || null;
    if (variant && accepted.has(variant)) {
      return variant;
    }
    if (variant === "normal" && singleton && singleton !== "normal") {
      return singleton;
    }
    return null;
  };
}

// Convert a ptcg set code to your canonical (tcgdex-like) set code.
// For most modern sets you provided a direct mapping (e.g. sv8 -> sv08).
import { resolveSet } from "../services/setMapping.service.js";
function resolveToCanonicalSet(ptcgCode) {
  const m = resolveSet(ptcgCode);
  return m?.tcgdex || ptcgCode; // fallback if not mapped
}

export default { fetchPricesPTCGIO };
