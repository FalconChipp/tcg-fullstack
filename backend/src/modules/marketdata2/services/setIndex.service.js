// src/modules/marketdata2/services/setIndex.service.js
// Central place for on-disk caches and the lightweight "set index" shown in admin.
// Keeps counts, last-run timestamps, scheduling notes, and provides helpers used by admin endpoints.
//
// CHANGES in this version:
// - FIX: upsertSetIndexEntry now supports BOTH signatures used in codebases:
//        (setCode, meta)  and  ({ setCode, setMeta })
// - ADDED: rebuildIndexFromCaches() now scans multiple legacy cache roots (not only MD2_CACHE_DIR/sets).
// - ADDED: DB fallback: if no JSON caches are found, it derives sets from DB (m_Card / m_CardVariant).
// - ADDED: rebuildIndexFromDb() exported explicitly (used internally by rebuildIndexFromCaches()).
// - Kept all legacy aliases: getIndex, getSetIndex, getSetIndexEntry, plus getSchedulingRules() used by /admin/md2/rules.

import fs from 'node:fs/promises';
import path from 'node:path';
import createLogger from './logger.js';

const log = createLogger('md2:setIndex');

const ROOT = process.env.MD2_CACHE_DIR || path.join(process.cwd(), 'data', 'marketdata2');
const SETS_DIR = path.join(ROOT, 'sets');
const INDEX_FILE = path.join(ROOT, 'set-index.json');

export const paths = {
  root: ROOT,
  setsDir: SETS_DIR,
  indexFile: INDEX_FILE,
  setJson: (code) => path.join(SETS_DIR, code, 'set.json'),
  cardsJson: (code) => path.join(SETS_DIR, code, 'cards.json'),
};

async function ensureDirs() {
  await fs.mkdir(SETS_DIR, { recursive: true });
}

/** Load set-index.json (or return an empty structure if missing). */
export async function readIndex() {
  try {
    const buf = await fs.readFile(INDEX_FILE, 'utf-8');
    return JSON.parse(buf);
  } catch {
    return { sets: {} };
  }
}

/** Persist the full index object to disk. */
export async function writeIndex(idx) {
  await ensureDirs();
  await fs.writeFile(INDEX_FILE, JSON.stringify(idx, null, 2), 'utf-8');
}

/** Write cache files for a set (set.json + cards.json). */
export async function writeSetCache(setCode, data) {
  await ensureDirs();
  const sdir = path.join(SETS_DIR, setCode);
  await fs.mkdir(sdir, { recursive: true });
  if (data?.set)   await fs.writeFile(paths.setJson(setCode),   JSON.stringify(data.set,   null, 2), 'utf-8');
  if (data?.cards) await fs.writeFile(paths.cardsJson(setCode), JSON.stringify(data.cards, null, 2), 'utf-8');
}

/**
 * Ensure index has an entry for this set and update basic metadata.
 *
 * BACK-COMPAT: supports both call styles:
 *   upsertSetIndexEntry('sv01', { name, era })
 *   upsertSetIndexEntry({ setCode: 'sv01', setMeta: { name, era }})
 */
export async function upsertSetIndexEntry(a, b) { // CHANGED: signature widened
  let setCode, meta;
  if (typeof a === 'string') {
    setCode = a; meta = b || {};
  } else if (a && typeof a === 'object') {
    setCode = a.setCode;
    meta = a.setMeta || b || {};
  }
  if (!setCode) throw new Error('upsertSetIndexEntry: setCode required');

  const idx = await readIndex();
  if (!idx.sets[setCode]) idx.sets[setCode] = {};

  // Merge metadata (prefer incoming)
  const s = idx.sets[setCode];
  s.name = meta?.name ?? s.name ?? setCode;
  s.releaseDate = meta?.releaseDate ?? s.releaseDate ?? null;
  if (meta?.era != null) s.era = meta.era;              // keep era if provided
  if (meta?.abbreviation != null) s.abbr = meta.abbreviation;

  await writeIndex(idx);
  return idx.sets[setCode];
}

/** Record a run (ingest/prices/etc.) into the index with a small history. */
export async function recordSetRun({ setCode, kind, ok, startedAt, finishedAt, counts = {}, errors = [] }) {
  const idx = await readIndex();
  if (!idx.sets[setCode]) idx.sets[setCode] = {};
  const s = idx.sets[setCode];
  const stamp = { kind, ok, startedAt, finishedAt, counts, errors };
  s.lastRun = stamp;
  if (kind === 'ingest' && ok) s.cardsLastIngestedAt = finishedAt;
  if (kind === 'prices' && ok) s.pricesLastFetchedAt = finishedAt;
  if (!s.history) s.history = [];
  s.history.push(stamp);
  if (s.history.length > 50) s.history = s.history.slice(-50);
  await writeIndex(idx);
  return s;
}

/** Recompute counts for a set from its cached cards.json and persist to index. */
export async function refreshCountsFromSetCache(setCode) {
  try {
    const cards = JSON.parse(await fs.readFile(paths.cardsJson(setCode), 'utf-8'));
    const total = Array.isArray(cards) ? cards.length : 0;
    const variants = cards.reduce((acc, c) => {
      const vs = Array.isArray(c?.variants) && c.variants.length ? c.variants : ['normal'];
      return acc + new Set(vs.map(v => String(v).toLowerCase())).size;
    }, 0);
    const idx = await readIndex();
    if (!idx.sets[setCode]) idx.sets[setCode] = {};
    idx.sets[setCode].counts = { cards: total, variants };
    await writeIndex(idx);
    return { cards: total, variants };
  } catch {
    return { cards: 0, variants: 0 };
  }
}

/** List sets as an array for admin rendering. */
export async function listSets() {
  const idx = await readIndex();
  return Object.entries(idx.sets).map(([setCode, meta]) => ({ setCode, ...meta }));
}

/* =======================================================================================
   NEW: rebuildIndexFromCaches()
   - Scans multiple roots for legacy caches:
     1) MD2_CACHE_DIR/sets (current)
     2) ./data/tcgdex/*
     3) ./data/sets/*
     4) ./cache/tcgdex/*
     5) ./tcgdex/*  ./src/data/tcgdex/*
   - If still empty, falls back to DB via rebuildIndexFromDb().
   USED BY: /admin/md2/sets (see index.js handler). It expects the function to return the full index,
   because the route reads `Object.keys(idx.sets || {}).length`. :contentReference[oaicite:0]{index=0} :contentReference[oaicite:1]{index=1}
   ======================================================================================= */
export async function rebuildIndexFromCaches() { // CHANGED: returns the index object
  await ensureDirs();
  const idx = await readIndex();

  const candidateRoots = [
    SETS_DIR,
    path.join(process.cwd(), 'data', 'tcgdex'),
    path.join(process.cwd(), 'data', 'sets'),
    path.join(process.cwd(), 'cache', 'tcgdex'),
    path.join(process.cwd(), 'tcgdex'),
    path.join(process.cwd(), 'src', 'data', 'tcgdex'),
  ];

  const seen = new Set();

  for (const root of candidateRoots) {
    let entries = [];
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch { continue; }
    for (const d of entries) {
      if (!d.isDirectory()) continue;
      const setCode = d.name;
      if (seen.has(setCode)) continue;

      // Locate likely files in this root
      const setPath   = path.join(root, setCode, 'set.json');
      const cardsPath = path.join(root, setCode, 'cards.json');

      let setMeta = null;
      let countCards = 0, countVariants = 0;

      // read set meta if present
      try {
        const raw = await fs.readFile(setPath, 'utf-8');
        setMeta = JSON.parse(raw);
      } catch {}

      // read cards
      try {
        const rawCards = await fs.readFile(cardsPath, 'utf-8');
        const cards = JSON.parse(rawCards);
        if (Array.isArray(cards)) {
          countCards = cards.length;
          countVariants = cards.reduce((acc, c) => {
            const vs = Array.isArray(c?.variants) && c.variants.length ? c.variants : ['normal'];
            return acc + new Set(vs.map(v => String(v).toLowerCase())).size;
          }, 0);
        }
      } catch {}

      if (!setMeta && !countCards) continue; // nothing useful here

      idx.sets[setCode] = {
        ...(idx.sets[setCode] || {}),
        name: setMeta?.name ?? idx.sets[setCode]?.name ?? setCode,
        releaseDate: setMeta?.releaseDate ?? idx.sets[setCode]?.releaseDate ?? null,
        era: idx.sets[setCode]?.era ?? setMeta?.serie?.id ?? setMeta?.serie ?? undefined,
        abbr: idx.sets[setCode]?.abbr ?? setMeta?.abbreviation ?? undefined,
        counts: {
          cards: countCards || idx.sets[setCode]?.counts?.cards || 0,
          variants: countVariants || idx.sets[setCode]?.counts?.variants || 0,
        },
        // keep any timestamps already present (cardsLastIngestedAt/pricesLastFetchedAt)
        cardsLastIngestedAt: idx.sets[setCode]?.cardsLastIngestedAt ?? null,
        pricesLastFetchedAt: idx.sets[setCode]?.pricesLastFetchedAt ?? null,
      };

      seen.add(setCode);
    }
  }

  // Fallback to DB if we still have nothing
  if (!Object.keys(idx.sets).length) {
    await rebuildIndexFromDb(idx); // ADDED: DB fallback
  }

  await writeIndex(idx);
  log.info('rebuildIndexFromCaches: done', { sets: Object.keys(idx.sets).length });
  return idx; // IMPORTANT: return the actual index object (what /sets expects)
}

/* =======================================================================================
   NEW: rebuildIndexFromDb(idx?)
   - Populate index purely from DB (distinct set_code from m_Card; counts from m_Card & m_CardVariant)
   - If idx passed, mutate it; else create a fresh one.
   ======================================================================================= */
export async function rebuildIndexFromDb(idx = null) {
  // Lazy import to avoid coupling when DB isn’t configured
  let mCard = null, mCardVariant = null;
  try {
    const mod = await import('../../../models/index.js');
    mCard = mod.m_Card || mod.m_card || null;
    mCardVariant = mod.m_CardVariant || mod.m_card_variant || null;
  } catch (e) {
    log.warn('rebuildIndexFromDb: models unavailable; skipping DB fallback');
    return idx || { sets: {} };
  }
  if (!mCard) {
    log.warn('rebuildIndexFromDb: m_Card model not found');
    return idx || { sets: {} };
  }

  const out = idx || { sets: {} };

  // Distinct set codes
  const rows = await mCard.findAll({
    attributes: ['set_code'],
    group: ['set_code'],
    raw: true,
  });

  for (const r of rows) {
    const setCode = r.set_code;
    // Cards count
    const cardsCount = await mCard.count({ where: { set_code: setCode } });
    // Variants count (optional)
    let variantsCount = 0;
    if (mCardVariant) {
      const vRows = await mCardVariant.findAll({
        attributes: ['variant'],
        where: { card_id: { $like: `${setCode}-%` } }, // basic LIKE; works across dialects w/ replacements
        raw: true,
      }).catch(() => []);
      variantsCount = Array.isArray(vRows) ? new Set(vRows.map(v => String(v.variant).toLowerCase())).size : 0;
    }

    out.sets[setCode] = {
      ...(out.sets[setCode] || {}),
      name: out.sets[setCode]?.name ?? setCode,
      releaseDate: out.sets[setCode]?.releaseDate ?? null,
      counts: {
        cards: cardsCount,
        variants: variantsCount || out.sets[setCode]?.counts?.variants || 0,
      },
      // timestamps preserved if present
      cardsLastIngestedAt: out.sets[setCode]?.cardsLastIngestedAt ?? null,
      pricesLastFetchedAt: out.sets[setCode]?.pricesLastFetchedAt ?? null,
    };
  }

  log.info('rebuildIndexFromDb: done', { sets: Object.keys(out.sets).length });
  return out;
}

/* =======================================================================================
   getSchedulingRules()
   Used by /admin/md2/rules to display a human-readable summary of scheduler settings.
   Pulls from ENV with sensible defaults to match index.js behavior. :contentReference[oaicite:2]{index=2}
   ======================================================================================= */
export async function getSchedulingRules() {
  const rules = [];
  rules.push(`Health cache TTL: ${Number(process.env.MD2_HEALTH_TTL_MS || 60000)} ms`);
  rules.push(`TCGdex request timeout: ${Number(process.env.MD2_TCGDEX_TIMEOUT_MS || 8000)} ms`);
  rules.push(`Language: ${process.env.MD2_LANG || 'en'}`);
  rules.push(`Metadata tick per run: ${Number(process.env.MD2_METADATA_PER_TICK || 2)}`);
  rules.push(`Pricing tick per run: ${Number(process.env.MD2_PRICING_PER_TICK || 2)}`);
  if (process.env.MD2_PARALLEL_MAX) rules.push(`Max parallel jobs: ${Number(process.env.MD2_PARALLEL_MAX)}`);
  if (process.env.MD2_ROLLUP_WINDOWS) rules.push(`Rollup windows: ${process.env.MD2_ROLLUP_WINDOWS}`);
  rules.push('Newly ingested sets are eligible for inclusion in upcoming pricing ticks.');
  return rules;
}

/* =========================
   Backward-compat helpers
   ========================= */

/** Legacy alias often imported as { getIndex } */
export async function getIndex() {
  return readIndex();
}

/** Legacy alias sometimes used elsewhere */
export async function getSetIndex() {
  return readIndex();
}

/** Legacy helper requested by resolvers.js */
export async function getSetIndexEntry(setCode) {
  const idx = await readIndex();
  return idx?.sets?.[setCode] ?? null;
}

export default {
  paths,
  readIndex,
  writeIndex,
  writeSetCache,
  upsertSetIndexEntry,     // CHANGED: supports both signatures
  recordSetRun,
  refreshCountsFromSetCache,
  listSets,
  rebuildIndexFromCaches,  // CHANGED: multi-root + DB fallback, returns full idx
  rebuildIndexFromDb,      // NEW
  getSchedulingRules,
  // Back-compat
  getIndex,
  getSetIndex,
  getSetIndexEntry,
};
