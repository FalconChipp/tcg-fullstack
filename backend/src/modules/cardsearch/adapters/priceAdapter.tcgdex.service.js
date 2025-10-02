// src/modules/cardsearch/adapters/priceAdapter.tcgdex.service.js
// TCGdex price adapter
// - Input: set (abbr|tcgdex|ptcg), cardNumbers[], optional variantsByNumber
// - Output: normalized observations in provider currency (no FX conversion here)
//
// Env:
//   TCGDEX_BASE (default 'https://api.tcgdex.net/v2')
//   MD_LANG     (default 'en')

import { fileURLToPath } from "node:url";
import path from "node:path";

let _fetch = globalThis.fetch;
if (typeof _fetch !== "function") {
  const { fetch } = await import("undici");
  _fetch = fetch;
}

import { resolveToTcgdex } from "../services/setMapping.service.js";

const TCGDEX_BASE = process.env.TCGDEX_BASE || "https://api.tcgdex.net/v2";
const LANG = process.env.MD_LANG || "en";

/**
 * Fetch latest price-ish data for a set from TCGdex.
 * Strategy:
 *  - For each `number`, GET /{lang}/cards/{setCode}-{number}
 *  - Look for a price object; prefer fields like { prices: { currency, market/mid/avg/low/high } }
 *  - If none, skip that card.
 *
 * @param {object} opts
 * @param {string} opts.set - abbr|tcgdex|ptcg (will resolve to tcgdex)
 * @param {string[]} opts.cardNumbers - list like ['001','123','123a']
 * @param {Record<string, string[]>} [opts.variantsByNumber] - e.g., { '123': ['normal','reverse'] }
 * @returns {Promise<Array<{card_id:string, variant:string, currency:string, amount:number|null, observed_at:string, source:string, meta?:any}>>}
 */
export async function fetchPricesTCGdex({ set, cardNumbers, variantsByNumber = {} }) {
  const setCode = resolveToTcgdex(set);
  if (!setCode) throw new Error(`TCGdex: unable to resolve set from '${set}'`);
  if (!Array.isArray(cardNumbers) || cardNumbers.length === 0) return [];

  const nowISO = new Date().toISOString();
  const out = [];

  for (const number of cardNumbers) {
    const cardId = `${setCode}-${String(number)}`;
    const url = `${TCGDEX_BASE}/${LANG}/cards/${encodeURIComponent(setCode)}-${encodeURIComponent(number)}`;

    const raw = await fetchJsonSafe(url);
    if (!raw) continue;

    // Heuristic: TCGdex often returns { prices: { ... } } or vendor-split pricing.
    // We'll try a few common shapes.
    const p = raw?.prices || raw?.price || null;

    // Try simple unified price object
    let currency = guessCurrency(p) || "USD";
    let market = pickMarketPrice(p);

    // If vendor-split (e.g., { tcgplayer: {...}, cardmarket: {...} }) — pick any best-effort
    if (market == null && p && typeof p === "object") {
      const vendorKeys = Object.keys(p);
      for (const vk of vendorKeys) {
        const pv = p[vk];
        if (!pv || typeof pv !== "object") continue;
        currency = guessCurrency(pv) || currency;
        market = pickMarketPrice(pv);
        if (market != null) break;
      }
    }

    if (market == null) {
      // No price we recognize — skip
      continue;
    }

    // Variants: if caller provides hints, record for each. Otherwise default to 'normal'.
    const variants = Array.isArray(variantsByNumber[number]) && variantsByNumber[number].length
      ? variantsByNumber[number]
      : ["normal"];

    for (const variant of variants) {
      out.push({
        card_id: cardId,
        variant: variant.toLowerCase(),
        currency,
        amount: Number(market),
        observed_at: nowISO,
        source: "tcgdex",
        meta: p || null,
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
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i === retries) break;
      await new Promise((r) => setTimeout(r, 450 * Math.pow(1.6, i)));
    }
  }
  // swallow as "no data" to keep adapter resilient
  return null;
}

function guessCurrency(obj) {
  if (!obj || typeof obj !== "object") return null;
  const cur = obj.currency || obj.curr || obj.ccy || null;
  if (typeof cur === "string" && cur.length <= 4) return cur.toUpperCase();
  // heuristics: presence of 'eur'/'usd' keys
  const keys = Object.keys(obj).map((k) => k.toLowerCase());
  if (keys.includes("eur")) return "EUR";
  if (keys.includes("usd")) return "USD";
  if (keys.includes("gbp")) return "GBP";
  return null;
}

function pickMarketPrice(obj) {
  if (!obj || typeof obj !== "object") return null;
  // Favor typical "market" or "mid" fields
  const fields = ["market", "mid", "median", "avg", "average", "price", "value"];
  for (const f of fields) {
    const v = obj[f];
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) return n;
  }
  // If nested per-currency (e.g., { usd: { market: 1.23 } })
  for (const cur of ["usd", "eur", "gbp"]) {
    const x = obj[cur];
    if (x && typeof x === "object") {
      const v = pickMarketPrice(x);
      if (v != null) return v;
    }
  }
  return null;
}

export default { fetchPricesTCGdex };
