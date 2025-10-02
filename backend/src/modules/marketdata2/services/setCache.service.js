// src/modules/marketdata2/services/setCache.service.js
// PURPOSE
// - Simple, filesystem-based cache for marketdata2 sets & scheduler/index data.
// - Stable paths + helpers used across ingest, scheduler, and pricing.
//
// EXPORTS
//   paths                         // { ROOT, SETS_ROOT, INDEX_ROOT }
//   ensureIndexDir()              // mkdir -p data/marketdata/index
//   ensureSetDir({ era })         // mkdir -p data/marketdata/sets/<era>
//   buildSetCachePath({ era, setCode }) -> string
//   writeSetCache({ era, setCode, json }) -> string (path written)
//   readSetCache({ era, setCode }) -> object|null
//   readJson(filePath) / writeJson(filePath, obj)
//   readIndex(name) / writeIndex(name, obj)        // JSON blobs in index/
//   touchIndexFlag(name, payload?)                 // writes {at, ...payload} in index/
//   listEras() -> string[]                         // eras under sets/
//   listSetFiles(era) -> [{setCode, path}]
//
// ✅ NEW (compat aliases for older code):
//   loadSetCache({ era, setCode })   == readSetCache
//   saveSetCache({ era, setCode, json }) == writeSetCache
//   getSetCachePath({ era, setCode }) == buildSetCachePath
//
// PATHS
//   data/marketdata/               ← ROOT
//     sets/<era>/<setCode>.json    ← cache per set
//     index/                       ← misc index files (locks, fx, scheduler snapshots, etc.)

import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';

// ------------------------------- Paths -------------------------------------

const ROOT = path.join(process.cwd(), 'data', 'marketdata');
const SETS_ROOT = path.join(ROOT, 'sets');
const INDEX_ROOT = path.join(ROOT, 'index');

export const paths = {
  ROOT,
  SETS_ROOT,
  INDEX_ROOT,
};

// ------------------------------ Utilities ----------------------------------

export async function ensureIndexDir() {
  await fs.mkdir(INDEX_ROOT, { recursive: true });
}

export async function ensureSetDir({ era }) {
  const dir = path.join(SETS_ROOT, String(era || 'sv'));
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function buildSetCachePath({ era, setCode }) {
  const file = `${String(setCode)}.json`;
  return path.join(SETS_ROOT, String(era || 'sv'), file);
}

export async function writeJson(filePath, obj) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), 'utf8');
  await fs.rename(tmp, filePath);
  return filePath;
}

export async function readJson(filePath) {
  try {
    if (!fssync.existsSync(filePath)) return null;
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ----------------------------- Set cache API -------------------------------

export async function writeSetCache({ era, setCode, json }) {
  const p = buildSetCachePath({ era, setCode });
  await writeJson(p, json);
  return p;
}

export async function readSetCache({ era, setCode }) {
  const p = buildSetCachePath({ era, setCode });
  return readJson(p);
}

// ----------------------------- Index helpers -------------------------------

/**
 * Read an arbitrary JSON blob from index/, e.g. "fx.cache.json".
 * @param {string} name  filename only (e.g., "fx.cache.json")
 */
export async function readIndex(name) {
  await ensureIndexDir();
  const p = path.join(INDEX_ROOT, name);
  return readJson(p);
}

/**
 * Write an arbitrary JSON blob under index/.
 * @param {string} name  filename only (e.g., "fx.cache.json")
 * @param {any} obj
 */
export async function writeIndex(name, obj) {
  await ensureIndexDir();
  const p = path.join(INDEX_ROOT, name);
  return writeJson(p, obj);
}

/**
 * Convenience for writing a small “flag” file in index/ with a timestamp.
 * @param {string} name  filename only (e.g., "last-ingest.json")
 * @param {object} payload optional extra fields to include
 */
export async function touchIndexFlag(name, payload = {}) {
  const obj = { at: new Date().toISOString(), ...payload };
  return writeIndex(name, obj);
}

// -------------------------- Discovery helpers ------------------------------

/** List all eras found under sets/ (directory names). */
export async function listEras() {
  if (!fssync.existsSync(SETS_ROOT)) return [];
  const entries = await fs.readdir(SETS_ROOT, { withFileTypes: true });
  return entries.filter(e => e.isDirectory()).map(e => e.name).sort();
}

/** List cached set files for an era. */
export async function listSetFiles(era) {
  const dir = path.join(SETS_ROOT, String(era || 'sv'));
  if (!fssync.existsSync(dir)) return [];
  const files = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const d of files) {
    if (!d.isFile()) continue;
    if (!d.name.endsWith('.json')) continue;
    const setCode = d.name.replace(/\.json$/i, '');
    out.push({ setCode, path: path.join(dir, d.name) });
  }
  return out.sort((a, b) => a.setCode.localeCompare(b.setCode));
}

// ------------------------------- Compat ------------------------------------
// These aliases keep older modules working without edits.
export const loadSetCache = readSetCache;         // used by price adapters
export const saveSetCache = writeSetCache;
export const getSetCachePath = buildSetCachePath;

export default {
  paths,
  ensureIndexDir,
  ensureSetDir,
  buildSetCachePath,
  writeSetCache,
  readSetCache,
  readJson,
  writeJson,
  readIndex,
  writeIndex,
  touchIndexFlag,
  listEras,
  listSetFiles,
  // compat
  loadSetCache,
  saveSetCache,
  getSetCachePath,
};
