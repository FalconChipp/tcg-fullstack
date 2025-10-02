// src/modules/cardsearch/services/fx.service.js
// Foreign exchange helper for price ingestion & normalization.
// - Source: ECB (official) 90-day history XML (EUR base)
// - Cache:   src/modules/cardsearch/.cache/fx/ecb-YYYY-MM-DD.json
// - Converts arbitrary currency -> GBP using cross rates
//
// Public API:
//   await getFx({ date?: 'YYYY-MM-DD' }) -> { base:'EUR', date:'YYYY-MM-DD', rates:{ USD: 1.12, GBP: 0.85, ... } }
//   await convert(amount, fromCcy, toCcy = 'GBP', { date?: 'YYYY-MM-DD', round?: 4 }) -> number|null
//   await toGBP(amount, fromCcy, { date?: 'YYYY-MM-DD', round?: 4 }) -> number|null
//   isSupported(ccy) -> boolean
//
// Notes:
//   - ECB publishes 1 EUR = X <CCY>. We compute cross rates:
//       GBP = amount * (GBP_per_EUR / FROM_per_EUR)
//     Special cases:
//       FROM = EUR: GBP = amount * GBP_per_EUR
//       FROM = GBP: GBP = amount
//   - If asked for a date with no fix (weekends/holidays), we auto-fallback to the most recent prior fix (up to 10 days).
//   - If the network fails, we return cached rates if present. If neither, we return null on convert().

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// -------- Config --------
const ECB_90D_XML = process.env.ECB_90D_XML || "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml";
const MAX_LOOKBACK_DAYS = 10;         // how far to search prior fixes
const DEFAULT_ROUND_DP = 4;

// Resolve module-local cache dir
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, "..", ".cache", "fx");

// Built-in always-supported currencies; ECB set is larger, we’ll accept any fetched code
const CORE_CCYS = new Set(["EUR", "GBP", "USD", "EUR", "JPY", "CHF", "AUD", "CAD", "NZD", "SEK", "NOK", "DKK", "CNY"]);

// Reuse global fetch or undici
let _fetch = globalThis.fetch;
if (typeof _fetch !== "function") {
  try {
    const { fetch } = await import("undici");
    _fetch = fetch;
  } catch {
    // We don’t throw here; network will just fail if fetch is missing.
    _fetch = null;
  }
}

/* ========================================================================== *
 * Public API
 * ========================================================================== */

/**
 * Get ECB fx for a date (nearest prior business day).
 * @param {{date?: string}} [opts]
 * @returns {Promise<{ base: 'EUR', date: string, rates: Record<string, number> }>}
 */
export async function getFx(opts = {}) {
  const target = normalizeDateStr(opts.date) || todayISO();
  await ensureDir(CACHE_DIR);

  // Try exact, then look back up to MAX_LOOKBACK_DAYS
  const datesToTry = backfillDates(target, MAX_LOOKBACK_DAYS);

  // 1) Try cache hits
  for (const d of datesToTry) {
    const cached = await readCache(d);
    if (cached) return cached;
  }

  // 2) Fetch latest 90d, then satisfy the first date we can
  const byDate = await fetchEcb90dIndexed();
  for (const d of datesToTry) {
    const entry = byDate.get(d);
    if (entry) {
      await writeCache(d, entry);
      return entry;
    }
  }

  // 3) If still nothing, but the 90d feed had any date at all, cache and return the most recent
  if (byDate.size > 0) {
    const newest = Array.from(byDate.keys()).sort().pop();
    const entry = byDate.get(newest);
    await writeCache(newest, entry);
    return entry;
  }

  // 4) Hard fail: no network + no cache
  throw new Error("FX: Unable to obtain ECB rates (no cache and network unavailable).");
}

/**
 * Convert an amount between currencies (default to GBP as target).
 * Returns null if conversion not possible.
 */
export async function convert(amount, fromCcy, toCcy = "GBP", opts = {}) {
  const amt = toNum(amount);
  if (!Number.isFinite(amt)) return null;

  const from = normCcy(fromCcy);
  const to = normCcy(toCcy);
  if (!from || !to) return null;
  if (from === to) return round(amt, opts.round ?? DEFAULT_ROUND_DP);

  // Short-circuits
  if (from === "GBP" && to === "EUR") {
    const fx = await getFx({ date: opts.date });
    const gbpPerEUR = fx.rates["GBP"];
    if (!isFiniteNum(gbpPerEUR) || gbpPerEUR === 0) return null;
    // amount GBP -> EUR: divide by GBP_per_EUR
    const eur = amt / gbpPerEUR;
    return round(eur, opts.round ?? DEFAULT_ROUND_DP);
  }
  if (from === "EUR" && to === "GBP") {
    const fx = await getFx({ date: opts.date });
    const gbpPerEUR = fx.rates["GBP"];
    if (!isFiniteNum(gbpPerEUR)) return null;
    return round(amt * gbpPerEUR, opts.round ?? DEFAULT_ROUND_DP);
  }

  // General cross using EUR base
  const fx = await getFx({ date: opts.date });
  const fromPerEUR = from === "EUR" ? 1 : fx.rates[from];
  const toPerEUR = to === "EUR" ? 1 : fx.rates[to];

  if (!isFiniteNum(fromPerEUR) || !isFiniteNum(toPerEUR) || fromPerEUR === 0) return null;

  // amount_in_to = amount * (to_per_EUR / from_per_EUR)
  const converted = amt * (toPerEUR / fromPerEUR);
  return round(converted, opts.round ?? DEFAULT_ROUND_DP);
}

/**
 * Convenience: convert to GBP.
 */
export async function toGBP(amount, fromCcy, opts = {}) {
  return convert(amount, fromCcy, "GBP", opts);
}

/**
 * Is this currency supported for conversion (either core or present in cached rates)?
 */
export async function isSupported(ccy) {
  const code = normCcy(ccy);
  if (!code) return false;
  if (CORE_CCYS.has(code)) return true;
  try {
    const fx = await getFx();
    return Boolean(fx.rates[code]);
  } catch {
    return false;
  }
}

/* ========================================================================== *
 * ECB fetch & parse
 * ========================================================================== */

/**
 * Fetch and parse the ECB 90d XML into a Map keyed by date (YYYY-MM-DD)
 * Value: { base:'EUR', date, rates: { ... } }
 */
async function fetchEcb90dIndexed() {
  if (!_fetch) throw new Error("FX: fetch is not available (install 'undici' or use Node 18+).");

  const xml = await fetchWithRetry(ECB_90D_XML);
  const byDate = new Map();

  // Very small, dependency-free XML extraction tailored to ECB feed layout.
  // We only care about <Cube time="YYYY-MM-DD"> … <Cube currency="USD" rate="1.2345"/> … </Cube>
  // Strip whitespace to simplify regex spans.
  const compact = xml.replace(/\s+/g, " ");

  // Grab each date block
  const dateRe = /<Cube\s+time="([\d-]+)"\s*>((?:(?!<\/Cube>).)*?)<\/Cube>/g;
  let m;
  while ((m = dateRe.exec(compact)) !== null) {
    const date = m[1];
    const inner = m[2];

    const rates = Object.create(null);
    // Extract all currency rates inside this date block
    const rowRe = /<Cube\s+currency="([A-Z]{3})"\s+rate="([\d.]+)"/g;
    let r;
    while ((r = rowRe.exec(inner)) !== null) {
      const ccy = r[1];
      const rate = Number(r[2]);
      if (Number.isFinite(rate)) rates[ccy] = rate;
    }

    // ECB base is EUR implicitly (1 EUR = rate[CCY])
    if (Object.keys(rates).length > 0) {
      byDate.set(date, { base: "EUR", date, rates });
    }
  }

  if (byDate.size === 0) {
    throw new Error("FX: ECB parse produced no rates.");
  }

  return byDate;
}

/* ========================================================================== *
 * Cache helpers
 * ========================================================================== */

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readCache(date) {
  const file = cachePath(date);
  try {
    const buf = await fs.readFile(file, "utf8");
    const json = JSON.parse(buf);
    if (json && json.base === "EUR" && typeof json.date === "string" && json.rates && typeof json.rates === "object") {
      return json;
    }
  } catch {
    // ignore
  }
  return null;
}

async function writeCache(date, payload) {
  const file = cachePath(date);
  const tmp = `${file}.tmp-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf8");
  await fs.rename(tmp, file);
}

function cachePath(date) {
  return path.join(CACHE_DIR, `ecb-${date}.json`);
}

/* ========================================================================== *
 * Net helpers
 * ========================================================================== */

async function fetchWithRetry(url, { retries = 3, minDelay = 400, maxDelay = 1800 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await _fetch(url, { method: "GET" });
      if (!res || !res.ok) {
        const status = res?.status || 0;
        const text = res ? await res.text().catch(() => "") : "";
        throw new Error(`HTTP ${status} for ${url} :: ${text.slice(0, 160)}`);
      }
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (i === retries) break;
      await sleep(jitter(minDelay, maxDelay, i));
    }
  }
  throw lastErr || new Error(`Failed to fetch ${url}`);
}

/* ========================================================================== *
 * Utilities
 * ========================================================================== */

function normCcy(x) {
  if (!x) return null;
  return String(x).trim().toUpperCase();
}

function toNum(x) {
  if (typeof x === "number") return x;
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

function isFiniteNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}

function round(n, dp) {
  const f = Math.pow(10, dp | 0);
  return Math.round(n * f) / f;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDateStr(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function backfillDates(dateStr, maxBack = 10) {
  const out = [];
  const d0 = new Date(`${dateStr}T00:00:00Z`);
  for (let i = 0; i <= maxBack; i++) {
    const di = new Date(d0);
    di.setUTCDate(di.getUTCDate() - i);
    out.push(di.toISOString().slice(0, 10));
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(min, max, attempt) {
  const base = Math.min(max, Math.round(min * Math.pow(1.6, attempt)));
  return base + Math.floor(Math.random() * Math.round(base * 0.25));
}

/* ========================================================================== *
 * Default export for convenience
 * ========================================================================== */

export default {
  getFx,
  convert,
  toGBP,
  isSupported,
};
