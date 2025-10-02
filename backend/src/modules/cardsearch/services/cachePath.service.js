// src/modules/cardsearch/services/cachePath.service.js
// Cache path helpers + tiny JSON read/write utilities used by adapters.

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR =
  process.env.CARDSEARCH_CACHE_DIR && process.env.CARDSEARCH_CACHE_DIR.trim() !== ""
    ? path.resolve(process.env.CARDSEARCH_CACHE_DIR)
    : path.resolve(__dirname, "../../../..", ".cache", "cardsearch");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

/**
 * Return a filesystem path for a cache file.
 * @param {string} kind - subdir (e.g. 'sets' or 'cards')
 * @param {string} code - set code (e.g. 'sv02')
 * @param {string} file - filename
 */
export function getCachePath(kind, code, file) {
  const safeKind = String(kind || "").replace(/[^a-z0-9._-]/gi, "");
  const safeCode = String(code || "").replace(/[^a-z0-9._-]/gi, "");
  const dir = path.join(BASE_DIR, safeKind, safeCode);
  ensureDir(dir);
  return path.join(dir, file);
}

/**
 * Build standard cache file paths for a set.
 * Accepts (code) OR (ignoredFirstArg, code) for backward compatibility.
 * Returns both legacy and new property names.
 */
export function withCachePaths(arg1, arg2) {
  // Support both withCachePaths(code) and withCachePaths(_, code)
  const code = arg2 ? String(arg2) : String(arg1);
  const set = getCachePath("sets", code, `${code}.json`);
  const cards = getCachePath("cards", code, `${code}.cards.json`);
  // Also expose aliases setPath/cardsPath for callers expecting those
  return { set, cards, setPath: set, cardsPath: cards };
}

/** Read JSON file if present, else throw to let caller decide fallback. */
export async function readCacheJSON(p) {
  return await new Promise((resolve, reject) => {
    fs.readFile(p, "utf8", (err, data) => {
      if (err) return reject(err);
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
  });
}

/** Write JSON pretty (2 spaces). Creates directories if needed. */
export async function saveCacheJSON(p, data) {
  ensureDir(path.dirname(p));
  return await new Promise((resolve, reject) => {
    fs.writeFile(p, JSON.stringify(data, null, 2), "utf8", (err) => {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

export default { getCachePath, withCachePaths, readCacheJSON, saveCacheJSON };
