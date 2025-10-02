// src/modules/marketdata2/services/priceAdapter.ppt.service.js
// Patch fallback using your PPT key. Convert to GBP and return observations array.
// Wire your actual endpoint + mapping as needed.

import Fx from './fx.service.js';
import { withRetry } from './retry.js';
import { limit } from './rateLimiter.js';

const PPT_HOST = process.env.PPT_HOST || 'api.ppt.example';
const PPT_BASE = process.env.PPT_BASE || `https://${PPT_HOST}`;

function normalize(card_id, variant, raw, fx) {
  // Adjust if PPT returns a different shape
  const currency = raw?.currency || 'USD';
  const amount   = Number(raw?.price ?? raw?.market ?? raw?.avg);
  const amount_gbp = Fx.toGBP(amount, currency, fx);
  if (amount_gbp == null) return null;
  return { card_id, variant, currency, amount, amount_gbp, observed_at: new Date().toISOString(), source: 'ppt' };
}

export async function fetchSetPricesPatch(setCode, cards) {
  const fx = await Fx.getFxRatesGBP();
  const out = [];
  for (const c of cards) {
    // Replace with a PPT endpoint that can return a price per (card, variant)
    const url = `${PPT_BASE}/v1/price?card=${encodeURIComponent(c.card_id)}`;
    const data = await withRetry(async () => {
      const res = await limit(PPT_HOST, () => fetch(url, {
        headers: process.env.PPT_API_KEY ? { 'Authorization': `Bearer ${process.env.PPT_API_KEY}` } : {},
      }));
      if (!res.ok) throw new Error(`PPT ${c.card_id} ${res.status}`);
      return res.json();
    }, { label: `ppt:${c.card_id}` });

    for (const v of (c.variants || ['normal'])) {
      const p = Array.isArray(data?.prices) ? data.prices.find(x => x.variant === v) : data?.price || null;
      const n = p ? normalize(c.card_id, v, p, fx) : null;
      if (n) out.push(n);
    }
  }
  return out;
}
