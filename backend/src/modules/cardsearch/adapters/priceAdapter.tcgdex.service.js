// src/modules/cardsearch/adapters/priceAdapter.tcgdex.service.js
// TCGdex price adapter
// - Input: set (abbr|tcgdex|ptcg), cardNumbers[], optional variantsByNumber
// - Output: normalized observations in provider currency (no FX conversion here)
//
// Env:
//   TCGDEX_BASE (default 'https://api.tcgdex.net/v2')
//   MD_LANG     (default 'en')

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
 *  - Gather any price payloads (legacy `prices` or new `pricing` vendor objects)
 *  - Emit one observation per vendor/variant in provider currency.
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

    const priceCandidates = gatherPriceCandidates(raw);
    if (!priceCandidates.length) continue;

    const baseVariants = Array.isArray(variantsByNumber[number]) && variantsByNumber[number].length
      ? variantsByNumber[number]
      : ["normal"];

    for (const candidate of priceCandidates) {
      const baseCurrency = (candidate.currency || "USD").toUpperCase();
      const observedAt = candidate.observedAt || raw?.updated || nowISO;
      const variantSet = new Set();

      for (const v of baseVariants) {
        const canon = canonicalVariantKey(v) || v;
        if (canon) variantSet.add(canon);
      }

      const candidateVariantKeys = candidate.variantAmounts ? Object.keys(candidate.variantAmounts) : [];
      for (const v of candidateVariantKeys) {
        const canon = canonicalVariantKey(v) || v;
        if (canon) variantSet.add(canon);
      }

      if (variantSet.size === 0) variantSet.add('normal');

      for (const variant of variantSet) {
        const amount = pickVariantAmount(candidate, variant);
        if (!Number.isFinite(amount)) continue;

        out.push({
          card_id: cardId,
          variant,
          currency: baseCurrency,
          amount: Number(amount),
          observed_at: observedAt,
          source: candidate.source,
          meta: candidate.meta,
        });
      }
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

function gatherPriceCandidates(raw) {
  const list = [];

  const pushCandidate = (data, vendorLabel) => {
    if (!data || typeof data !== "object") return;
    const market = pickMarketPrice(data);
    if (market == null) return;
    const currency = guessCurrency(data);
    const variantAmounts = extractVariantOverrides(data);
    const observedAt = data?.updated || data?.lastUpdated || null;
    list.push({
      source: vendorLabel,
      market: Number(market),
      currency,
      variantAmounts,
      observedAt,
      meta: data,
    });
  };

  const direct = raw?.prices || raw?.price;
  if (direct && typeof direct === "object") pushCandidate(direct, "tcgdex");

  const pricing = raw?.pricing;
  if (pricing && typeof pricing === "object") {
    for (const [vendor, payload] of Object.entries(pricing)) {
      if (!payload || typeof payload !== "object") continue;
      pushCandidate(payload, `tcgdex:${vendor}`);
    }
  }

  // Legacy fields (cardmarket/tcgplayer) appeared on some older responses.
  if (raw?.cardmarket && typeof raw.cardmarket === "object") pushCandidate(raw.cardmarket, "tcgdex:cardmarket");
  if (raw?.tcgplayer && typeof raw.tcgplayer === "object") pushCandidate(raw.tcgplayer, "tcgdex:tcgplayer");

  return list;
}

const VARIANT_KEY_CANON = new Map([
  ['normal', 'normal'],
  ['standard', 'normal'],
  ['default', 'normal'],
  ['regular', 'normal'],
  ['reverse', 'reverse'],
  ['reverseholo', 'reverse'],
  ['reverseholofoil', 'reverse'],
  ['holoreverse', 'reverse'],
  ['reversefoil', 'reverse'],
  ['holo', 'holo'],
  ['holfoil', 'holo'],
  ['holofoil', 'holo'],
  ['shiny', 'holo'],
  ['foil', 'foil'],
  ['firstedition', 'firstEdition'],
  ['1stedition', 'firstEdition'],
  ['firsteditionholo', 'firstEdition'],
]);

function canonicalVariantKey(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return VARIANT_KEY_CANON.get(key) || null;
}

function pickVariantAmount(candidate, variantKey) {
  const canon = canonicalVariantKey(variantKey) || variantKey;
  if (candidate?.variantAmounts && candidate.variantAmounts[canon] != null) {
    return candidate.variantAmounts[canon];
  }
  return candidate?.market ?? null;
}

function extractVariantOverrides(obj) {
  const out = Object.create(null);
  for (const [key, value] of Object.entries(obj)) {
    const num = Number(value);
    if (!Number.isFinite(num)) continue;
    const lower = String(key).toLowerCase();
    let canon = canonicalVariantKey(key);
    if (!canon) {
      if (lower.includes('reverse')) canon = 'reverse';
      else if (lower.includes('holo')) canon = 'holo';
      else if (lower.includes('foil')) canon = 'foil';
      else if (lower.includes('first')) canon = 'firstEdition';
      else if (lower.includes('normal')) canon = 'normal';
    }
    if (!canon) continue;
    if (canon === 'reverse' && out.reverse == null) {
      out.reverse = num;
    } else if (canon === 'holo') {
      out.holo = num;
    } else if (canon === 'foil') {
      out.foil = num;
    } else if (canon === 'firstEdition') {
      out.firstEdition = num;
    } else if (canon === 'normal') {
      out.normal = num;
    }
  }
  if (out.reverse == null && out.holo != null) out.reverse = out.holo;
  if (out.holo == null && out.reverse != null) out.holo = out.reverse;
  return Object.keys(out).length ? out : null;
}

function guessCurrency(obj) {
  if (!obj || typeof obj !== "object") return null;
  const cur = obj.currency || obj.curr || obj.ccy || obj.unit || null;
  if (typeof cur === "string" && cur.length <= 4) return cur.toUpperCase();
  // heuristics: presence of 'eur'/'usd'/'gbp' keys
  const keys = Object.keys(obj).map((k) => k.toLowerCase());
  if (keys.includes("eur")) return "EUR";
  if (keys.includes("usd")) return "USD";
  if (keys.includes("gbp")) return "GBP";
  return null;
}

function pickMarketPrice(obj) {
  if (!obj || typeof obj !== "object") return null;
  const fields = [
    "market",
    "mid",
    "median",
    "avg",
    "average",
    "price",
    "value",
    "trend",
    "avgSellPrice",
    "averageSellPrice",
    "lowPrice",
    "highPrice",
  ];
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
