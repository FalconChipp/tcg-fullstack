// src/modules/cardsearch/adapters/fxAdapter.ecb.service.js
// ECB FX adapter (fetch + normalize only; no caching or DB writes).
//
// Public API:
//   - await fetch90d(): Map<string, { base:'EUR', date:string, rates: Record<string, number> }>
//   - await fetchSince('YYYY-MM-DD'): Map<date, table> filtered to >= given date (but only within the ECB 90d feed)
//   - await getNearest('YYYY-MM-DD'): { base:'EUR', date, rates } | null  (nearest prior fix within 90d)
//     * If date omitted, uses today.
//
// Notes:
//   - ECB publishes 1 EUR = X <CCY>.
//   - Parsing is tailored to the official 90-day XML: eurofxref-hist-90d.xml
//   - Keep this adapter side-effect free; caching is done in fx.service.js.

let _fetch = globalThis.fetch;
if (typeof _fetch !== "function") {
  try {
    const { fetch } = await import("undici");
    _fetch = fetch;
  } catch {
    throw new Error("fxAdapter: fetch is not available (use Node 18+ or install 'undici').");
  }
}

const ECB_90D_XML =
  process.env.ECB_90D_XML ||
  "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml";

/* ============================================================================
   Public
   ========================================================================== */

/**
 * Fetch and parse the ECB 90-day XML.
 * @returns {Promise<Map<string, { base:'EUR', date:string, rates:Record<string,number> }>>}
 */
export async function fetch90d() {
  const xml = await fetchWithRetry(ECB_90D_XML);
  const byDate = parseEcb90d(xml);
  if (byDate.size === 0) {
    throw new Error("fxAdapter: ECB feed parsed with zero dates.");
  }
  return byDate;
}

/**
 * Fetch the 90-day feed, then return only entries >= the provided date (YYYY-MM-DD).
 * If date is outside the available range, returns an empty Map.
 * @param {string} date
 */
export async function fetchSince(date) {
  const d = normalizeDateStr(date);
  const all = await fetch90d();
  if (!d) return all;
  const out = new Map();
  for (const [key, table] of all) {
    if (key >= d) out.set(key, table);
  }
  return out;
}

/**
 * Return the nearest prior business-day table for `onDate` from the 90-day feed.
 * Falls back to null if the feed doesn’t include any prior date within the window.
 * @param {string} [onDate] 'YYYY-MM-DD' (defaults to today)
 */
export async function getNearest(onDate) {
  const target = normalizeDateStr(onDate) || todayISO();
  const all = await fetch90d();
  // Find the largest date <= target
  let best = null;
  for (const key of all.keys()) {
    if (key <= target && (!best || key > best)) best = key;
  }
  return best ? all.get(best) : null;
}

/* ============================================================================
   Internals
   ========================================================================== */

function parseEcb90d(xml) {
  const byDate = new Map();
  if (!xml || typeof xml !== "string") return byDate;

  // Compact whitespace to make regex spans predictable.
  const compact = xml.replace(/\s+/g, " ");

  // Each day: <Cube time="YYYY-MM-DD"> ... </Cube>
  const dateRe = /<Cube\s+time="([\d-]+)"\s*>((?:(?!<\/Cube>).)*?)<\/Cube>/g;
  let m;
  while ((m = dateRe.exec(compact)) !== null) {
    const date = m[1];
    const inner = m[2];
    const rates = Object.create(null);

    // Each rate row: <Cube currency="USD" rate="1.2345"/>
    const rowRe = /<Cube\s+currency="([A-Z]{3})"\s+rate="([\d.]+)"/g;
    let r;
    while ((r = rowRe.exec(inner)) !== null) {
      const ccy = r[1];
      const rate = Number(r[2]);
      if (Number.isFinite(rate)) {
        rates[ccy] = rate;
      }
    }

    if (Object.keys(rates).length > 0) {
      byDate.set(date, { base: "EUR", date, rates });
    }
  }

  return byDate;
}

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
  throw lastErr || new Error(`fxAdapter: failed to fetch ${url}`);
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(min, max, attempt) {
  const base = Math.min(max, Math.round(min * Math.pow(1.6, attempt)));
  return base + Math.floor(Math.random() * Math.round(base * 0.25));
}

/* ============================================================================
   Default export (convenience)
   ========================================================================== */

export default {
  fetch90d,
  fetchSince,
  getNearest,
};
