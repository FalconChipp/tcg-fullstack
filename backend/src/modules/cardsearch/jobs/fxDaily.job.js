// src/modules/cardsearch/jobs/fxDaily.job.js
// Pre-warm the ECB FX cache used by fx.service.js so price collection jobs convert to GBP
// without extra network calls.
//
// Two modes:
//
// 1) prewarm90d: true  (default)
//    - Fetch ECB 90-day XML ONCE, parse, and write all days into the cache directory.
//    - Fastest, least API hammering.
//
// 2) backfillDays: N (explicit)
//    - Call fx.service.getFx() for each of the last N days (including today), letting the
//      service write per-day cache on demand. This may fetch more than once if caches are cold,
//      but is useful when you want to exercise exactly the same path as production conversion.
//
// Usage (programmatic):
//    const res = await fxDaily({ prewarm90d: true });
//    const res = await fxDaily({ backfillDays: 7, prewarm90d: false });
//    const res = await fxDaily({ date: '2025-10-01', prewarm90d: true });
//
// CLI:
//    node src/modules/cardsearch/jobs/fxDaily.job.js               # prewarm90d
//    node src/modules/cardsearch/jobs/fxDaily.job.js --backfill=7  # backfill 7 days via getFx()
//    node src/modules/cardsearch/jobs/fxDaily.job.js --date=2025-10-01 --no-prewarm
//
// Returns:
//   {
//     ok: true,
//     mode: 'prewarm90d' | 'backfill',
//     fxDate: 'YYYY-MM-DD',     // reference day used (today or provided)
//     counts: {
//       attempted: 90,          // dates attempted
//       written: 90,            // cache files written (or confirmed)
//       fromNetwork: 1          // actual network fetches performed (prewarm90d)
//     },
//     cacheDir: '.../.cache/fx',
//     ms: 321
//   }

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Reuse your fx.service for validation/backfill mode
import { getFx } from "../services/fx.service.js";

// -------- Config (kept in sync with fx.service.js) --------
const ECB_90D_XML = process.env.ECB_90D_XML || "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml";

// Resolve the module-local cache dir identical to fx.service.js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, "..", ".cache", "fx");

// Fetch impl (Node 18+ global or undici)
let _fetch = globalThis.fetch;
if (typeof _fetch !== "function") {
  try {
    const { fetch } = await import("undici");
    _fetch = fetch;
  } catch {
    _fetch = null;
  }
}

/* ============================================================================
   Public API
   ========================================================================== */

/**
 * @typedef {Object} FxDailyOptions
 * @property {string} [date]           - ISO date (YYYY-MM-DD). Defaults to today.
 * @property {boolean} [prewarm90d]    - If true (default), one-shot 90d prewarm.
 * @property {number}  [backfillDays]  - If set, backfill N days using getFx() (sets prewarm90d=false).
 * @property {{log:Function, warn:Function, error:Function}} [logger]
 */

/**
 * Pre-warm ECB rates cache.
 * - If backfillDays is provided, runs in "backfill" mode via getFx().
 * - Otherwise runs in "prewarm90d" mode (single network request, write all days).
 */
export async function fxDaily(opts = {}) {
  const started = Date.now();
  const logger = opts?.logger ?? console;
  const date = normalizeDateStr(opts?.date) || todayISO();

  await ensureDir(CACHE_DIR);

  if (Number.isInteger(opts?.backfillDays) && opts.backfillDays > 0) {
    const days = Number(opts.backfillDays);
    const dates = backfillDates(date, days);
    let written = 0;
    let attempted = 0;

    for (const d of dates) {
      attempted++;
      try {
        // This will fetch 90d if necessary and write one day's cache; subsequent dates may
        // still refetch depending on cache presence, but we're intentionally using the same path
        // as runtime conversions for this mode.
        const fx = await getFx({ date: d });
        if (fx?.date) written++;
      } catch (err) {
        logger.warn?.(`fxDaily backfill: failed for ${d}: ${err?.message || String(err)}`);
      }
    }

    return {
      ok: true,
      mode: "backfill",
      fxDate: date,
      counts: {
        attempted,
        written,
        fromNetwork: null, // not tracked in this mode
      },
      cacheDir: CACHE_DIR,
      ms: Date.now() - started,
    };
  }

  // Default: prewarm 90d with a single network call
  if (!_fetch) {
    throw new Error("fxDaily: fetch is not available (install 'undici' or use Node 18+).");
  }

  const xml = await fetchWithRetry(ECB_90D_XML);
  const byDate = parseEcb90d(xml); // Map<string, { base:'EUR', date, rates:Record<string,number> }>
  if (byDate.size === 0) {
    throw new Error("fxDaily: ECB feed parsed with zero dates.");
  }

  let attempted = 0;
  let written = 0;

  for (const [d, payload] of byDate.entries()) {
    attempted++;
    const file = cachePath(d);
    const already = await readCache(file);
    if (already) {
      // Confirm cache entry looks valid; if so, skip write
      if (already.base === "EUR" && typeof already.date === "string" && already.rates && typeof already.rates === "object") {
        continue;
      }
    }
    await writeCache(file, payload);
    written++;
  }

  return {
    ok: true,
    mode: "prewarm90d",
    fxDate: date,
    counts: {
      attempted,
      written,
      fromNetwork: 1, // exactly one network call for the feed
    },
    cacheDir: CACHE_DIR,
    ms: Date.now() - started,
  };
}

/* ============================================================================
   Internal: ECB fetch/parse identical shape to fx.service.js cache entries
   ========================================================================== */

function parseEcb90d(xml) {
  const byDate = new Map();
  if (!xml || typeof xml !== "string") return byDate;

  const compact = xml.replace(/\s+/g, " ");

  // Match each <Cube time="YYYY-MM-DD"> ... </Cube>
  const dateRe = /<Cube\s+time="([\d-]+)"\s*>((?:(?!<\/Cube>).)*?)<\/Cube>/g;
  let m;
  while ((m = dateRe.exec(compact)) !== null) {
    const date = m[1];
    const inner = m[2];
    const rates = Object.create(null);

    // Extract each <Cube currency="XXX" rate="N.NNNN"/>
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

/* ============================================================================
   IO helpers (same file naming convention as fx.service.js)
   ========================================================================== */

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function cachePath(date) {
  return path.join(CACHE_DIR, `ecb-${date}.json`);
}

async function readCache(file) {
  try {
    const text = await fs.readFile(file, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function writeCache(file, payload) {
  const tmp = `${file}.tmp-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf8");
  await fs.rename(tmp, file);
}

/* ============================================================================
   Net + small utils
   ========================================================================== */

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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function backfillDates(dateStr, days) {
  const out = [];
  const d0 = new Date(`${dateStr}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    const di = new Date(d0);
    di.setUTCDate(di.getUTCDate() - i);
    out.push(di.toISOString().slice(0, 10));
  }
  return out;
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
   Optional CLI
   ========================================================================== */

const isDirect = (() => {
  try {
    const modulePath = fileURLToPath(import.meta.url);
    return process.argv[1] && fileURLToPath(process.argv[1]) === modulePath;
  } catch {
    return false;
  }
})();

if (isDirect) {
  (async () => {
    const dateArg = process.argv.find((a) => a.startsWith("--date="));
    const date = dateArg ? dateArg.split("=")[1] : undefined;
    const backfillArg = process.argv.find((a) => a.startsWith("--backfill="));
    const backfillDays = backfillArg ? Number(backfillArg.split("=")[1]) : undefined;
    const noPrewarm = process.argv.includes("--no-prewarm");

    try {
      const res = await fxDaily({
        date,
        prewarm90d: !noPrewarm && !backfillDays,
        backfillDays,
        logger: console,
      });
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    } catch (err) {
      console.error(err?.stack || String(err));
      process.exit(2);
    }
  })();
}

export default { fxDaily };
