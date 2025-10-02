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
    const p = raw?.prices || raw?.data?.prices || raw?.card?.prices || null;

    if (!p || typeof p !== "object") continue;

    const { currency, market, low, mid, high } = pickPriceFields(p);
    if (market == null) continue;

    const variants = Array.isArray(variantsByNumber[number]) && variantsByNumber[number].length
      ? variantsByNumber[number]
      : ["normal"];

    for (const variant of variants) {
      out.push({
        card_id: `${resolveToCanonicalSet(ptcgCode)}-${String(number)}`, // convert to canonical tcgdex-like code
        variant: variant.toLowerCase(),
        currency: currency || "USD",
        amount: Number(market),
        observed_at: nowISO,
        source: "ptcgio",
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

function pickPriceFields(p) {
  // Flatten common vendor payloads
  const currency = (typeof p.currency === "string" ? p.currency.toUpperCase() : null) ||
                   (p.usd ? "USD" : p.eur ? "EUR" : p.gbp ? "GBP" : null);

  const low = num(p.low ?? p.floor ?? p.min ?? p.p10 ?? p.lowest ?? p.cheapest);
  const mid = num(p.mid ?? p.median ?? p.avg ?? p.average);
  const high = num(p.high ?? p.ceiling ?? p.max ?? p.p90 ?? p.highest);
  const market = num(p.market ?? p.price ?? p.value ?? mid ?? low ?? high);

  return { currency, market, low, mid, high };
}

function num(v) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

// Convert a ptcg set code to your canonical (tcgdex-like) set code.
// For most modern sets you provided a direct mapping (e.g. sv8 -> sv08).
import { resolveSet } from "../services/setMapping.service.js";
function resolveToCanonicalSet(ptcgCode) {
  const m = resolveSet(ptcgCode);
  return m?.tcgdex || ptcgCode; // fallback if not mapped
}

export default { fetchPricesPTCGIO };
