// src/hooks/useSetPrices.js
import { useMemo } from "react";

const toNum = (v) => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
};

function pickVariationPriceGBP(prices = []) {
  if (!Array.isArray(prices) || prices.length === 0) return null;

  // Prefer "normal" variation, else first with data
  let p = prices.find((x) => x && String(x.variation || "").toLowerCase() === "normal");
  if (!p) p = prices.find(Boolean);
  if (!p) return null;

  const gbp = toNum(p.gbp);
  const tcg = toNum(p.tcgplayer);
  const cmk = toNum(p.cardmarket);

  if (gbp != null) return gbp;

  const nums = [tcg, cmk].filter((n) => n != null);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export default function useSetPrices(setObj) {
  return useMemo(() => {
    const cards = Array.isArray(setObj?.cards) ? setObj.cards : [];
    const pricesById = {};
    let totalSetPriceGbp = 0;

    for (const c of cards) {
      const id = c?.id || (c?.number != null && c?.name ? `${c.number}-${c.name}` : null);
      if (!id) continue;

      const gbp = pickVariationPriceGBP(c.prices);
      if (gbp != null) {
        pricesById[id] = { gbp, currency: "£" };
        totalSetPriceGbp += gbp;
      }
    }

    return { pricesById, totalSetPriceGbp };
  }, [setObj]);
}
