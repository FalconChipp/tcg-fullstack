#!/usr/bin/env node
// scripts/marketdata/fetch-tcgdex-run.mjs
// Unified TCGdex runner (single file, no child scripts).
// Modes:
//   - Single set:       --set=sv10.5b                 OR positional that looks like a set code
//   - Multiple sets:    --sets=sv01,sv03.5,sv10
//   - One era:          sv                            (auto-detected via /series/<id>)
//   - Multiple eras:    sv,swsh
//
// Output:
//   data/marketdata/sets/<era>/<code>.json
//   data/marketdata/index/<era>.index.json
//   data/marketdata/index/sets.index.json
//
// Flags:
//   --concurrency=<n>   (parallel SETS to process, default 4; not used in single-set/multi-set unless >1 sets)
//   --cardConcurrency=<n> (parallel CARD details per set, default 6)
//   --limit=<n>         (limit sets per era; Infinity by default)
//   --retries=<n>       (retries per SET run; default 3)
//   --lang=<code>       (optional; or pass as 2nd positional)
//   --set=<code>        (single set)
//   --sets=<codes>      (comma-separated sets)
//
// Env:
//   MARKETDATA_SETS_ROOT=/abs/path/to/data/marketdata

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// ---------- arg parsing ----------
const argv = process.argv.slice(2);

function getFlag(name, def) {
  const x = argv.find(a => a.startsWith(`--${name}=`));
  if (!x) return def;
  const raw = x.split("=")[1];
  const n = Number(raw);
  return Number.isFinite(n) ? n : raw;
}
function boolFlag(name) {
  return argv.some(a => a === `--${name}`);
}

let target = null;            // positional 1: era or set or csv of eras
let lang = getFlag("lang", "en");

if (argv[0] && !argv[0].startsWith("--")) {
  target = argv[0].toLowerCase();
  // optional positional 2 is language unless --lang is already set
  if (argv[1] && !argv[1].startsWith("--") && getFlag("lang", null) == null) {
    lang = argv[1].toLowerCase();
  }
}

const SET_ONE   = (getFlag("set", null) || "").toLowerCase() || null;
const SET_LIST  = (getFlag("sets", "")   || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

const CONCURRENCY       = Number(getFlag("concurrency", 4));      // sets at a time
const CARD_CONCURRENCY  = Number(getFlag("cardConcurrency", 6));  // card detail calls at a time
const LIMIT             = getFlag("limit", Infinity);
const RETRIES           = Number(getFlag("retries", 3));

const BASE = `https://api.tcgdex.net/v2/${lang}`;
const ROOT = process.env.MARKETDATA_SETS_ROOT
  || path.join(process.cwd(), "data", "marketdata");
const GENERATOR_VERSION = "1.0.1";
const SCHEMA_VERSION    = "v1";

// ---------- tiny utils ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchJSON(url, retries = 3) {
  let attempt = 0, lastErr;
  while (attempt <= retries) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      attempt++;
      if (attempt > retries) break;
      const wait = Math.min(2000, 300 * Math.pow(2, attempt - 1)) + Math.random() * 200;
      await sleep(wait);
    }
  }
  throw lastErr;
}

function zpad(n) { return String(n).padStart(3, "0"); }
function toHighWebp(url) {
  if (!url || typeof url !== "string") return url;
  if (url.endsWith("/high.webp")) return url;
  const hasExt = /\.[a-z0-9]{3,4}(\?.*)?$/i.test(url);
  const base = hasExt ? url.replace(/\.[a-z0-9]{3,4}(\?.*)?$/i, "") : url;
  return `${base}/high.webp`;
}
function normalizeVariants(v) {
  if (!v || typeof v !== "object") return [];
  const map = { normal: "normal", reverse: "reverse", holo: "holo", firstEdition: "firstEdition", foil: "foil" };
  return Object.keys(map).filter(k => v[k]).map(k => map[k]);
}
function normalizeLegality(legal) {
  if (!legal || typeof legal !== "object") return undefined;
  const out = {};
  for (const k of ["standard", "expanded", "unlimited"]) {
    if (k in legal) out[k] = !!legal[k];
  }
  return Object.keys(out).length ? out : undefined;
}
function prune(obj) {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (
      v === null || v === undefined ||
      (Array.isArray(v) && v.length === 0) ||
      (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0)
    ) delete obj[k];
  }
  return obj;
}
async function ensureDir(dir) { await fs.mkdir(dir, { recursive: true }); }
async function readJSONSafe(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch { return fallback; }
}
async function writeJSONAtomic(file, data) {
  const tmp = `${file}.tmp-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}
function sortLimitCodes(codes) {
  codes.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }));
  return LIMIT === Infinity ? codes : codes.slice(0, LIMIT);
}
function looksLikeSetCode(x) {
  // starts with letters, then digit or 'p' (promos), e.g. sv10.5b, svp, swsh12.5
  return /^[a-z]+[0-9p]/i.test(x);
}

// ---------- discovery ----------
async function isEraId(id) {
  try {
    const serie = await fetchJSON(`${BASE}/series/${id}`);
    return Array.isArray(serie?.sets) && serie.sets.length > 0;
  } catch { return false; }
}
async function isSetCode(id) {
  try {
    const set = await fetchJSON(`${BASE}/sets/${id}`);
    return !!set?.id;
  } catch { return false; }
}
async function listEraSetCodes(eraId) {
  // primary: /series/<era>
  try {
    const serie = await fetchJSON(`${BASE}/series/${eraId}`);
    const codes = Array.isArray(serie?.sets) ? serie.sets.map(s => s?.id).filter(Boolean) : [];
    if (codes.length) return sortLimitCodes(codes);
  } catch {}
  // fallback: /sets filtered by id prefix
  const all = await fetchJSON(`${BASE}/sets`);
  const briefs = Array.isArray(all) ? all : [];
  const codes = briefs.map(s => s?.id).filter(Boolean).filter(id => new RegExp(`^${eraId}`, "i").test(id));
  return sortLimitCodes(codes);
}

// ---------- write indices ----------
async function updateEraAndGlobalIndices(setPayload, serieName) {
  const { code, era, name, releaseDate, totalCards } = setPayload;

  const indexDir = path.join(ROOT, "index");
  await ensureDir(indexDir);

  // Era index
  const eraIndexFile = path.join(indexDir, `${era}.index.json`);
  const eraIndex = await readJSONSafe(eraIndexFile, {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    era: { id: era, name: serieName || era },
    sets: [],
  });
  const eraSetMini = prune({ code, name, releaseDate, totalCards });
  const eraIdx = eraIndex.sets.findIndex(s => s.code === code);
  if (eraIdx >= 0) eraIndex.sets[eraIdx] = eraSetMini; else eraIndex.sets.push(eraSetMini);
  eraIndex.generatedAt = new Date().toISOString();
  await writeJSONAtomic(eraIndexFile, eraIndex);

  // Global index
  const globalIndexFile = path.join(indexDir, "sets.index.json");
  const globalIndex = await readJSONSafe(globalIndexFile, {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    eras: [],
    sets: [],
  });

  const eraMini = prune({ id: era, name: serieName || era, setCount: undefined });
  const eIdx = globalIndex.eras.findIndex(e => e.id === eraMini.id);
  if (eIdx >= 0) globalIndex.eras[eIdx] = { ...globalIndex.eras[eIdx], ...eraMini };
  else globalIndex.eras.push(eraMini);

  const setMini = prune({ code, era, name, releaseDate, totalCards });
  const sIdx = globalIndex.sets.findIndex(s => s.code === code);
  if (sIdx >= 0) globalIndex.sets[sIdx] = setMini; else globalIndex.sets.push(setMini);

  // recompute setCount per era
  const counts = globalIndex.sets.reduce((m, s) => {
    m[s.era] = (m[s.era] || 0) + 1;
    return m;
  }, {});
  globalIndex.eras = globalIndex.eras.map(e => ({ ...e, setCount: counts[e.id] || 0 }));
  globalIndex.generatedAt = new Date().toISOString();
  await writeJSONAtomic(globalIndexFile, globalIndex);
}

// ---------- single set fetch+write ----------
async function fetchAndWriteSet(code) {
  console.log(`• Fetching set ${code} (${lang}) from TCGdex`);
  const setData = await fetchJSON(`${BASE}/sets/${code}`, 3);

  const era       = setData?.serie?.id || "";
  const serieName = setData?.serie?.name || era;
  const name      = setData?.name || code.toUpperCase();
  const release   = setData?.releaseDate || null;
  const abbr      = setData?.abbreviation?.official || null;
  const official  = setData?.cardCount?.official ?? null;
  const total     = setData?.cardCount?.total ?? null;

  const setLogo   = toHighWebp(setData?.images?.logo || setData?.logo || null);
  const setSymbol = toHighWebp(setData?.images?.symbol || setData?.symbol || null);

  const briefs = Array.isArray(setData?.cards) ? setData.cards : [];
  console.log(`• Found ${briefs.length} card briefs`);

  const outCards = [];
  let ok = 0, fail = 0;

  // worker pool for card detail fetches
  let idx = 0;
  async function cardWorker() {
    while (idx < briefs.length) {
      const i = idx++;
      const b = briefs[i];
      const id     = b.id;
      const number = zpad(b.localId);
      const cname  = b.name || "";
      const image  = b.image || null;

      try {
        const card = await fetchJSON(`${BASE}/cards/${id}`, 3);
        const out = prune({
          id,
          number,
          name: cname,
          rarity: card?.rarity ?? null,
          imageUrl: toHighWebp(image),
          variants: normalizeVariants(card?.variants),
          regulationMark: card?.regulationMark || undefined,
          legality: normalizeLegality(card?.legal) || undefined,
        });
        outCards.push(out);
        ok++;
      } catch (err) {
        console.warn(`  ✖ ${id} (${cname}): ${err.message}`);
        outCards.push(prune({ id, number, name: cname, imageUrl: toHighWebp(image) }));
        fail++;
      }
    }
  }
  const workers = Math.min(CARD_CONCURRENCY, Math.max(1, briefs.length));
  await Promise.all(Array.from({ length: workers }, () => cardWorker()));
  console.log(`• Cards processed: ${ok} ok, ${fail} failed`);

  const payload = prune({
    schemaVersion: SCHEMA_VERSION,
    source: "tcgdex",
    sourceLang: lang,
    sourceAt: new Date().toISOString(),
    generatorVersion: GENERATOR_VERSION,

    code,
    name,
    era,
    releaseDate: release,
    abbreviation: abbr || undefined,
    officialCardCount: official ?? undefined,
    totalCards: total ?? official ?? outCards.length,
    totalCardsComputed: outCards.length,
    setLogo: setLogo || undefined,
    setSymbol: setSymbol || undefined,

    cards: outCards,
  });

  // write file
  const setsDir = path.join(ROOT, "sets", era || "unknown");
  await ensureDir(setsDir);
  const setFile = path.join(setsDir, `${code}.json`);
  await writeJSONAtomic(setFile, payload);
  console.log(`✔ Wrote set file: ${setFile}`);

  // update indices
  await updateEraAndGlobalIndices(payload, serieName);
}

async function runSingleWithRetries(code, retries = RETRIES) {
  let attempt = 0;
  while (true) {
    try { await fetchAndWriteSet(code); return; }
    catch (err) {
      attempt++;
      if (attempt > retries) throw err;
      const wait = Math.min(8000, 1000 * Math.pow(2, attempt - 1)) + Math.random() * 500;
      console.warn(`Retrying ${code} in ${Math.round(wait)}ms (attempt ${attempt}/${retries})…`);
      await sleep(wait);
    }
  }
}

// ---------- set/era runners ----------
async function runEra(eraId) {
  console.log(`• Discovering ${eraId.toUpperCase()} sets from TCGdex (${lang})…`);
  const codes = await listEraSetCodes(eraId);
  if (!codes.length) {
    console.error(`No ${eraId} sets discovered. Check the API or language.`);
    return { errors: [{ code: eraId, err: "no sets found" }] };
  }
  console.log(`• Found ${codes.length} ${eraId.toUpperCase()} sets:\n  ${codes.join(", ")}`);

  let i = 0;
  const errors = [];
  async function worker() {
    while (i < codes.length) {
      const idx = i++;
      const code = codes[idx];
      if (idx > 0) await sleep(Math.random() * 800);
      console.log(`\n[${idx + 1}/${codes.length}] Generating ${code}…`);
      try { await runSingleWithRetries(code, RETRIES); }
      catch (err) {
        errors.push({ code, err: String(err?.message || err) });
        console.error(`✖ Failed ${code}:`, err?.message || err);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker()));
  return { errors };
}

async function runMultiEras(csv) {
  const eras = csv.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  const allErrors = [];
  for (const e of eras) {
    const { errors } = await runEra(e);
    allErrors.push(...errors);
  }
  return { errors: allErrors };
}

async function runSetList(codes) {
  const list = Array.from(new Set(codes)); // de-dupe
  let i = 0;
  const errors = [];
  const par = Math.max(1, Math.min(CONCURRENCY, list.length));
  async function worker() {
    while (i < list.length) {
      const idx = i++;
      const code = list[idx];
      if (idx > 0) await sleep(Math.random() * 800);
      console.log(`\n[${idx + 1}/${list.length}] Generating ${code}…`);
      try { await runSingleWithRetries(code, RETRIES); }
      catch (err) {
        errors.push({ code, err: String(err?.message || err) });
        console.error(`✖ Failed ${code}:`, err?.message || err);
      }
    }
  }
  await Promise.all(Array.from({ length: par }, () => worker()));
  return { errors };
}

// ---------- entry ----------
async function main() {
  // explicit multiple sets
  if (SET_LIST.length) {
    const { errors } = await runSetList(SET_LIST);
    if (errors.length) {
      console.log(`\nCompleted with ${errors.length} failures:`);
      for (const e of errors) console.log(` - ${e.code}: ${e.err}`);
      process.exitCode = 1;
    } else {
      console.log(`\n✔ All requested sets completed successfully.`);
    }
    return;
  }

  // explicit one set
  if (SET_ONE) {
    await runSingleWithRetries(SET_ONE, RETRIES);
    console.log(`\n✔ Completed ${SET_ONE}`);
    return;
  }

  if (!target) {
    console.error("Usage:\n  node scripts/marketdata/fetch-tcgdex-run.mjs <era|era1,era2> [lang] [...flags]\n  node scripts/marketdata/fetch-tcgdex-run.mjs --set=<setCode> [--lang=en] [...flags]\n  node scripts/marketdata/fetch-tcgdex-run.mjs --sets=<a,b,c> [--lang=en] [...flags]");
    process.exit(1);
  }

  // comma ⇒ multi-eras
  if (target.includes(",")) {
    const { errors } = await runMultiEras(target);
    if (errors.length) {
      console.log(`\nCompleted with ${errors.length} failures:`);
      for (const e of errors) console.log(` - ${e.code}: ${e.err}`);
      process.exitCode = 1;
    } else {
      console.log(`\n✔ All requested eras completed successfully.`);
    }
    return;
  }

  // probe: era or set?
  if (await isEraId(target)) {
    const { errors } = await runEra(target);
    if (errors.length) {
      console.log(`\nCompleted with ${errors.length} failures:`);
      for (const e of errors) console.log(` - ${e.code}: ${e.err}`);
      process.exitCode = 1;
    } else {
      console.log(`\n✔ ${target.toUpperCase()} completed successfully.`);
    }
    return;
  }

  if (looksLikeSetCode(target) && await isSetCode(target)) {
    await runSingleWithRetries(target, RETRIES);
    console.log(`\n✔ Completed ${target}`);
    return;
  }

  console.error(`Could not resolve "${target}" as an era or a set (lang="${lang}").`);
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

// # Single set
// node scripts/marketdata/fetch-tcgdex-run.mjs --set=sv10.5b --lang=en

// # Multiple sets
// node scripts/marketdata/fetch-tcgdex-run.mjs --sets=sv01,sv03.5,sv10 --lang=en --concurrency=3

// # One era
// node scripts/marketdata/fetch-tcgdex-run.mjs sv en --concurrency=3 --retries=5

// # Multiple eras
// node scripts/marketdata/fetch-tcgdex-run.mjs sv,swsh en --limit=8 --concurrency=2

// # Different card concurrency
// node scripts/marketdata/fetch-tcgdex-run.mjs --set=sv08 --lang=en --cardConcurrency=10
