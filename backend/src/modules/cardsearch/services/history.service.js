// src/modules/cardsearch/services/history.service.js
// Helper utilities to derive price history series (daily buckets) for a card/variant.

import { Op } from "sequelize";
import { m_PriceObservation } from "../../../models/index.js";

const GBP = "GBP";
const MAX_LIMIT = 730; // cap to 2y of daily points to avoid runaway payloads

const VARIANT_ALIASES = {
  normal: "normal",
  standard: "normal",
  holo: "holo",
  holofoil: "holo",
  "holofoil": "holo",
  "holo_foil": "holo",
  reverse: "reverse",
  "reverseholo": "reverse",
  "reverse_holo": "reverse",
  "reverse holo": "reverse",
  "reverseholofoil": "reverse",
  "reverse holofoil": "reverse",
  firstedition: "firstEdition",
  "first_edition": "firstEdition",
  "first edition": "firstEdition",
  foil: "foil",
};

function normalizeVariant(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const aliasKey = trimmed.replace(/[\s_-]+/g, "").toLowerCase();
  return VARIANT_ALIASES[aliasKey] ?? trimmed;
}

function toDateOnly(dateLike) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function coerceLimit(limit) {
  const n = Number(limit);
  if (!Number.isFinite(n)) return 180;
  const clamped = Math.max(1, Math.min(MAX_LIMIT, Math.floor(n)));
  return clamped;
}

function coerceOffset(offset) {
  const n = Number(offset);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/**
 * Build per-day history rows using the trailing observations table.
 * - Groups by calendar day (UTC)
 * - Uses the last price of the day as `market`
 * - Computes min/max/average from all samples that day
 *
 * @param {string} cardId
 * @param {{ variant?: string|null, startDate?: string|null, endDate?: string|null, limit?: number, offset?: number }} [options]
 * @returns {Promise<Array<{ date:string, variant:string|null, market:number|null, mid:number|null, low:number|null, high:number|null, provider:string|null }>>}
 */
export async function fetchPriceHistory(cardId, options = {}) {
  if (!cardId) return [];

  const variant = normalizeVariant(options.variant);
  const startDate = options.startDate ? String(options.startDate).slice(0, 10) : null;
  const endDate = options.endDate ? String(options.endDate).slice(0, 10) : null;
  const limit = coerceLimit(options.limit);
  const offset = coerceOffset(options.offset);

  const where = { card_id: cardId };
  if (variant) where.variant = variant;

  const observedAt = {};
  if (startDate) {
    const start = new Date(`${startDate}T00:00:00Z`);
    if (!Number.isNaN(start.getTime())) observedAt[Op.gte] = start;
  }
  if (endDate) {
    const end = new Date(`${endDate}T23:59:59Z`);
    if (!Number.isNaN(end.getTime())) observedAt[Op.lte] = end;
  }
  if (Object.keys(observedAt).length) {
    where.observed_at = observedAt;
  }

  const rows = await m_PriceObservation.findAll({
    where,
    attributes: ["observed_at", "amount_gbp", "source"],
    order: [["observed_at", "ASC"]],
    raw: true,
  });

  if (!rows.length) return [];

  const daily = new Map();
  for (const row of rows) {
    const when = row.observed_at ? new Date(row.observed_at) : null;
    const price = row.amount_gbp != null ? Number(row.amount_gbp) : null;
    if (!when || Number.isNaN(when.getTime()) || !Number.isFinite(price)) continue;

    const dayKey = when.toISOString().slice(0, 10);
    let entry = daily.get(dayKey);
    if (!entry) {
      entry = {
        date: dayKey,
        variant: variant,
        low: price,
        high: price,
        sum: price,
        count: 1,
        lastPrice: price,
        lastAt: when.getTime(),
        provider: row.source ?? null,
      };
      daily.set(dayKey, entry);
      continue;
    }

    entry.low = Math.min(entry.low, price);
    entry.high = Math.max(entry.high, price);
    entry.sum += price;
    entry.count += 1;
    const at = when.getTime();
    if (at >= entry.lastAt) {
      entry.lastAt = at;
      entry.lastPrice = price;
      entry.provider = row.source ?? entry.provider ?? null;
    }
  }

  if (!daily.size) return [];

  const history = Array.from(daily.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({
      date: row.date,
      variant,
      market: Number.isFinite(row.lastPrice) ? Number(row.lastPrice) : null,
      mid: row.count ? Number((row.sum / row.count).toFixed(2)) : null,
      low: Number.isFinite(row.low) ? Number(row.low) : null,
      high: Number.isFinite(row.high) ? Number(row.high) : null,
      provider: row.provider ?? null,
      currency: GBP,
    }));

  if (!history.length) return [];

  let windowed = history;
  if (!startDate && !endDate) {
    // Default behaviour: take most recent slice window respecting offset.
    const total = history.length;
    const endIndex = Math.max(0, total - offset);
    if (endIndex === 0) {
      windowed = [];
    } else {
      const startIndex = Math.max(0, endIndex - limit);
      windowed = history.slice(startIndex, endIndex);
    }
  } else if (offset || limit) {
    windowed = history.slice(offset, offset + limit);
  }

  return windowed;
}

export default {
  fetchPriceHistory,
};
