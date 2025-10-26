// src/modules/cardsearch/adapters/priceAdapter.ppt.service.js
// PPT (gap-filler) price adapter
// - Input: set (abbr|tcgdex|ptcg), cardNumbers[], optional variantsByNumber
// - Output: normalized observations in provider currency
//
// Env:
//   PPT_BASE (no default; set if you have a PPT endpoint)
//   If no PPT_BASE is provided, this adapter returns [] immediately (feature-flag style).

let _fetch = globalThis.fetch;
if (typeof _fetch !== "function") {
  const { fetch } = await import("undici");
  _fetch = fetch;
}

import { resolveSet } from "../services/setMapping.service.js";
import { canonicalVariantKey, canonicalVariantSet } from "../services/variant.service.js";

const PPT_BASE = process.env.PPT_BASE || "";

/**
 * Fetch prices from PPT (gap filler). If PPT_BASE is not configured, returns [].
 * We implement a flexible route pattern similar to PTCG.io due to deployment differences:
 *  1) GET /v1/prices/{tcgdex}-{number}
 *  2) GET /prices/{tcgdex}/{number}
 *
 * @param {object} opts
 * @param {string} opts.set
 * @param {string[]} opts.cardNumbers
 * @param {Record<string, string[]>} [opts.variantsByNumber]
 */
export async function fetchPricesPPT({ set, cardNumbers, variantsByNumber = {} }) {
  if (!PPT_BASE) return []; // feature-flag: silently disabled unless configured
  const mapping = resolveSet(set);
  const tcgdex = mapping?.tcgdex || null;
  if (!tcgdex) return [];

  if (!Array.isArray(cardNumbers) || cardNumbers.length === 0) return [];

  const nowISO = new Date().toISOString();
  const out = [];

  for (const number of cardNumbers) {
    const id = `${tcgdex}-${String(number)}`;
    const candidateUrls = [
      `${PPT_BASE}/v1/prices/${encodeURIComponent(id)}`,
      `${PPT_BASE}/prices/${encodeURIComponent(tcgdex)}/${encodeURIComponent(number)}`,
    ];

    let raw = null;
    for (const url of candidateUrls) {
      raw = await fetchJsonSafe(url);
      if (raw) break;
    }
    if (!raw) continue;

    // Common shapes for simple pricing services:
    // { currency: 'USD', price: 1.23 } or { market: 1.23, currency: 'USD' } or nested vendor
    const p = raw?.prices || raw?.price || raw;
    const variantSet = canonicalVariantSet(variantsByNumber[number]);
    const payloads = collectVariantPayloads(p, { fallbackCurrency: "USD" });
    if (!payloads.length) continue;

    for (const payload of payloads) {
      if (!variantSet.has(payload.variant)) continue;
      out.push({
        card_id: id,
        variant: payload.variant,
        currency: payload.currency || "USD",
        amount: Number(payload.market),
        observed_at: payload.observedAt || nowISO,
        source: payload.source || "ppt",
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
        if (res.status === 429 && i < retries) {
          await new Promise((r) => setTimeout(r, 800 * (i + 1)));
          continue;
        }
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
      }
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

function collectVariantPayloads(section, { fallbackCurrency } = {}) {
  if (!section || typeof section !== "object") return [];

  const payloads = [];
  const base = pickSectionPrice(section, { fallbackCurrency });
  const variants = new Map();

  for (const [key, value] of Object.entries(section)) {
    if (!value || typeof value !== "object") continue;
    const variant = canonicalVariantKey(key, { fallback: null });
    if (!variant) continue;
    const price = pickSectionPrice(value, { fallbackCurrency });
    if (!price || price.market == null) continue;
    if (!variants.has(variant)) {
      variants.set(variant, price);
    }
  }

  for (const [variant, price] of variants) {
    payloads.push({
      variant,
      market: price.market,
      currency: price.currency,
      observedAt: price.observedAt,
      source: price.source || "ppt",
      meta: price.meta,
    });
  }

  if (base && base.market != null && !variants.has("normal")) {
    payloads.push({
      variant: "normal",
      market: base.market,
      currency: base.currency,
      observedAt: base.observedAt,
      source: base.source || "ppt",
      meta: base.meta,
    });
  }

  return payloads;
}

function pickSectionPrice(section, { fallbackCurrency } = {}) {
  const currency = typeof section.currency === "string"
    ? section.currency.toUpperCase()
    : section.usd != null
      ? "USD"
      : section.eur != null
        ? "EUR"
        : section.gbp != null
          ? "GBP"
          : fallbackCurrency || null;

  const low = num(section.low ?? section.floor ?? section.min ?? section.p10 ?? section.lowest);
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

export default { fetchPricesPPT };
