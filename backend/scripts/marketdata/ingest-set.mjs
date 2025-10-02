#!/usr/bin/env node
// Ingest set JSONs into m_sets/m_cards/m_card_variants.
//
// Modes:
//   • Single set (default):   node scripts/marketdata/ingest-set.mjs sv10.5b [--era=sv] [--quiet]
//   • All sets:               node scripts/marketdata/ingest-set.mjs --all [--era=sv] [--concurrency=4] [--retries=3] [--quiet]
//   • All sets for an era:    node scripts/marketdata/ingest-set.mjs --all --era=sv
//
// Env:
//   MARKETDATA_SETS_ROOT overrides the data directory if needed.
//
// Notes:
//   - Uses data/marketdata/index/sets.index.json when available (fast).
//   - Falls back to scanning data/marketdata/sets/<era>/*.json.
//   - Retries each set with exponential backoff + jitter.

import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { ingestSet } from "../../src/modules/marketdata/jobs/ingestSet.job.js";

/* ---------------- args & flags ---------------- */

const argv = process.argv.slice(2);
const DATA_ROOT =
  process.env.MARKETDATA_SETS_ROOT ||
  path.join(process.cwd(), "data", "marketdata");

function getFlag(name, def) {
  const f = argv.find(a => a.startsWith(`--${name}=`));
  if (!f) return def;
  const raw = f.split("=")[1];
  const n = Number(raw);
  return Number.isFinite(n) ? n : raw;
}
const quiet        = argv.includes("--quiet");
const allMode      = argv.includes("--all");
const eraFlag      = getFlag("era", null);             // string era id (e.g., sv)
const retries      = Number(getFlag("retries", 3));
const concurrency  = Math.max(1, Number(getFlag("concurrency", 4)));

const positionalSet = argv.find(a => !a.startsWith("--"));

/* ---------------- tiny utils ---------------- */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function readJSONSafe(file, fallback = null) {
  try {
    const txt = await fs.readFile(file, "utf8");
    return JSON.parse(txt);
  } catch {
    return fallback;
  }
}

/* ---------------- discovery ---------------- */

async function listSetCodesFromIndex(eraFilter = null) {
  const indexPath = path.join(DATA_ROOT, "index", "sets.index.json");
  const idx = await readJSONSafe(indexPath, { sets: [] });
  if (!Array.isArray(idx.sets)) return [];
  const filtered = eraFilter
    ? idx.sets.filter(s => s?.era?.toLowerCase() === eraFilter.toLowerCase())
    : idx.sets;
  return filtered.map(s => s.code).filter(Boolean);
}

async function listSetCodesByScanning(eraFilter = null) {
  const setsRoot = path.join(DATA_ROOT, "sets");
  let eras = [];
  try {
    eras = (await fs.readdir(setsRoot, { withFileTypes: true }))
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch { eras = []; }

  if (eraFilter) eras = eras.filter(e => e.toLowerCase() === eraFilter.toLowerCase());

  const codes = [];
  for (const era of eras) {
    let files = [];
    try { files = await fs.readdir(path.join(setsRoot, era)); } catch { files = []; }
    for (const f of files) {
      if (f.toLowerCase().endsWith(".json")) {
        codes.push(f.replace(/\.json$/i, ""));
      }
    }
  }
  return codes;
}

function dedupeAndSort(arr) {
  const out = Array.from(new Set(arr.filter(Boolean)));
  out.sort((a,b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }));
  return out;
}

async function listAllAvailableSetCodes(eraFilter = null) {
  // NEW: union of index and scan (so we never miss sets that aren’t indexed yet)
  const [fromIdx, fromScan] = await Promise.all([
    listSetCodesFromIndex(eraFilter),
    listSetCodesByScanning(eraFilter),
  ]);
  return dedupeAndSort([...fromIdx, ...fromScan]);
}

/* ---------------- runners ---------------- */

async function runOneSet(setCode, eraHint, maxRetries = retries) {
  let attempt = 0;
  while (true) {
    try {
      return await ingestSet({ setCode, eraHint });
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) {
        throw err;
      }
      const wait =
        Math.min(8000, 1000 * Math.pow(2, attempt - 1)) + Math.random() * 500;
      if (!quiet) {
        console.warn(
          `Retrying ${setCode} in ${Math.round(wait)}ms (attempt ${attempt}/${maxRetries})…`
        );
      }
      await sleep(wait);
    }
  }
}

async function runAllSets({ eraHint = null } = {}) {
  const codes = await listAllAvailableSetCodes(eraHint);
  if (!quiet) {
    console.log(`• Discovered ${codes.length} set(s)${eraHint ? ` for era ${eraHint.toUpperCase()}` : ""}`);
  }
  if (!codes.length) {
    console.error(
      `No set JSON files found under ${path.join(DATA_ROOT, "sets")}${
        eraHint ? ` for era "${eraHint}"` : ""
      }`
    );
    process.exit(1);
  }

  if (!quiet) {
    console.log(
      `• Ingesting ${codes.length} set(s)${
        eraHint ? ` for era ${eraHint.toUpperCase()}` : ""
      } with concurrency=${concurrency}…`
    );
  }

  let i = 0;
  const errors = [];
  const start = Date.now();

  async function worker() {
    while (i < codes.length) {
      const idx = i++;
      const code = codes[idx];
      if (!quiet) {
        console.log(`[${idx + 1}/${codes.length}] ${code}…`);
      }
      try {
        await runOneSet(code, eraHint, retries);
      } catch (err) {
        errors.push({ code, err: String(err?.message || err) });
        if (!quiet) console.error(`✖ Failed ${code}:`, err?.message || err);
      }
    }
  }

  const pool = Math.min(concurrency, codes.length);
  await Promise.all(Array.from({ length: pool }, () => worker()));

  const ms = Date.now() - start;
  if (!quiet) {
    console.log(
      `\n✔ Ingested ${codes.length - errors.length}/${codes.length} sets in ${ms}ms`
    );
    if (errors.length) {
      console.log("Failures:");
      for (const e of errors) console.log(` - ${e.code}: ${e.err}`);
    }
  }

  // non-zero exit if there were failures (handy for CI/cron)
  if (errors.length) process.exitCode = 1;
}

/* ---------------- entrypoint ---------------- */

(async () => {
  try {
    if (allMode) {
      await runAllSets({ eraHint: eraFlag || null });
      return;
    }

    if (!positionalSet) {
      console.error(
        "Usage:\n" +
          "  node scripts/marketdata/ingest-set.mjs <setCode> [--era=sv] [--quiet]\n" +
          "  node scripts/marketdata/ingest-set.mjs --all [--era=sv] [--concurrency=4] [--retries=3] [--quiet]"
      );
      process.exit(1);
    }

    if (!quiet) {
      console.log(
        `• Ingesting set ${positionalSet}${eraFlag ? ` (era hint: ${eraFlag})` : ""}…`
      );
    }
    const res = await runOneSet(positionalSet, eraFlag || undefined, retries);

    if (!quiet) {
      console.log("✔ Ingest complete");
      console.log(JSON.stringify(res, null, 2));
    } else {
      console.log(`ok code=${res.code} cards=${res.cards} file=${res.file}`);
    }
  } catch (err) {
    console.error("✖ Ingest failed:", err?.message || err);
    process.exit(1);
  }
})();
