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

    const currency = (typeof p?.currency === "string" ? p.currency.toUpperCase() : null) ||
                     (p?.usd ? "USD" : p?.eur ? "EUR" : p?.gbp ? "GBP" : null) || "USD";

    const low = num(p.low ?? p.floor ?? p.min ?? p.p10 ?? p.lowest);
    const mid = num(p.mid ?? p.median ?? p.avg ?? p.average);
    const high = num(p.high ?? p.ceiling ?? p.max ?? p.p90 ?? p.highest);
    const market = num(p.market ?? p.price ?? p.value ?? mid ?? low ?? high);
    if (market == null) continue;

    const variants = Array.isArray(variantsByNumber[number]) && variantsByNumber[number].length
      ? variantsByNumber[number]
      : ["normal"];

    for (const variant of variants) {
      out.push({
        card_id: id,
        variant: variant.toLowerCase(),
        currency,
        amount: Number(market),
        observed_at: nowISO,
        source: "ppt",
        meta: { low, mid, high, raw: p },
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

export default { fetchPricesPPT };
