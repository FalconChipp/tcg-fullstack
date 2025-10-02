/**
 * Fast card search via cached JSON (primary) with DB fallback.
 *
 * CHANGED (fix):
 * - Removed the duplicate declaration of `listAvailableSetCodesFromCache`.
 * - Kept a single implementation near the top and reused it below.
 *
 * TWEAKS:
 * - Added extra guards when reading cache files.
 * - Types/subtype fields are read defensively from DB rows (they may be null).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { Op } from 'sequelize';
import { m_Card, m_CardVariant } from '../../../models/index.js'; // fallback only

const DATA_DIR = process.env.MD2_DATA_DIR || path.join(process.cwd(), 'data', 'marketdata2');
const SETS_DIR = path.join(DATA_DIR, 'sets');

/* -------------------------
   Cache helpers
   ------------------------- */

async function listAvailableSetCodesFromCache() {
  // CHANGED: single, canonical implementation (removed duplicate at end of file)
  try {
    const files = await fs.readdir(SETS_DIR);
    return files
      .filter(f => f.endsWith('.cards.json'))
      .map(f => f.replace(/\.cards\.json$/, ''));
  } catch {
    return [];
  }
}

async function readSetCache(setCode) {
  const file = path.join(SETS_DIR, `${setCode}.cards.json`);
  let raw;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    // bubble up to trigger DB fallback in caller
    throw new Error(`cache-miss:${setCode}`);
  }

  let j;
  try {
    j = JSON.parse(raw);
  } catch {
    throw new Error(`cache-parse-failed:${setCode}`);
  }

  // Expected shape:
  // { setCode, cards: [ { card_id, name, number, rarity, supertype, subtype, types, images, variants } ], fetchedAt }
  const normalized = (j.cards || []).map(c => ({
    id: c.card_id,
    set_code: j.setCode || setCode,
    number: c.number || null,
    name: c.name || null,
    rarity: c.rarity || null,
    supertype: c.supertype || null,
    subtype: c.subtype || null,
    types: Array.isArray(c.types) ? c.types : (c.types ? [c.types] : []),
    image_small: c.images?.small || null,
    image_large: c.images?.large || null,
    variants: Array.isArray(c.variants) && c.variants.length ? c.variants : ['normal'],
  }));

  return normalized;
}

/* -------------------------
   Text / filter helpers
   ------------------------- */

function textMatch(hay, needle) {
  if (!needle) return true;
  if (!hay) return false;
  return hay.toLowerCase().includes(needle.toLowerCase());
}

function normalizeCardNumber(n) {
  // Turn "123a" into { base:123, suffix:"a" } for stable sort; fallback to string compare
  if (!n) return { base: Number.MAX_SAFE_INTEGER, suffix: '' };
  const m = String(n).match(/^(\d+)(.*)$/);
  if (!m) return { base: Number.MAX_SAFE_INTEGER, suffix: String(n) };
  return { base: parseInt(m[1], 10), suffix: m[2] || '' };
}

function applyFilters(cards, input) {
  const q = input?.q?.trim();
  const setCode = input?.setCode?.trim();
  const number = input?.number?.trim();
  const rarity = input?.rarity?.trim();
  const supertype = input?.supertype?.trim();
  const subtype = input?.subtype?.trim();
  const typeIn = Array.isArray(input?.typeIn) ? input.typeIn.filter(Boolean) : null;
  const variantIn = Array.isArray(input?.variantIn) ? input.variantIn.filter(Boolean) : null;

  let out = cards;

  if (q) {
    out = out.filter(c =>
      textMatch(c.name, q) ||
      textMatch(c.id, q) ||
      textMatch(c.number, q)
    );
  }
  if (setCode) {
    out = out.filter(c => String(c.set_code).toLowerCase() === setCode.toLowerCase());
  }
  if (number) {
    out = out.filter(c => String(c.number).toLowerCase() === number.toLowerCase());
  }
  if (rarity) {
    out = out.filter(c => (c.rarity || '').toLowerCase() === rarity.toLowerCase());
  }
  if (supertype) {
    out = out.filter(c => (c.supertype || '').toLowerCase() === supertype.toLowerCase());
  }
  if (subtype) {
    out = out.filter(c => (c.subtype || '').toLowerCase() === subtype.toLowerCase());
  }
  if (typeIn && typeIn.length) {
    const set = new Set(typeIn.map(t => t.toLowerCase()));
    out = out.filter(c => (c.types || []).some(t => set.has(String(t).toLowerCase())));
  }
  if (variantIn && variantIn.length) {
    const vset = new Set(variantIn.map(v => v.toLowerCase()));
    out = out.filter(c => (c.variants || []).some(v => vset.has(String(v).toLowerCase())));
  }

  return out;
}

function sortCardsNatural(a, b) {
  // Sort by set_code, then number (natural)
  const sa = String(a.set_code || '');
  const sb = String(b.set_code || '');
  if (sa !== sb) return sa < sb ? -1 : 1;

  const na = normalizeCardNumber(a.number);
  const nb = normalizeCardNumber(b.number);
  if (na.base !== nb.base) return na.base - nb.base;
  return na.suffix.localeCompare(nb.suffix);
}

function page(cards, offset, limit) {
  const total = cards.length;
  const sliced = cards.slice(offset, offset + limit);
  return { total, offset, limit, items: sliced };
}

/* -------------------------
   DB fallback (cache miss)
   ------------------------- */

async function queryDb(setCode) {
  const where = setCode ? { set_code: setCode } : {};
  const rows = await m_Card.findAll({ where, raw: true });
  const ids = rows.map(r => r.id);
  const vars = ids.length
    ? await m_CardVariant.findAll({ where: { card_id: { [Op.in]: ids } }, raw: true })
    : [];

  const vmap = new Map();
  for (const v of vars) {
    if (!vmap.has(v.card_id)) vmap.set(v.card_id, []);
    vmap.get(v.card_id).push(v.variant);
  }

  return rows.map(r => ({
    id: r.id,
    set_code: r.set_code,
    number: r.number,
    name: r.name,
    rarity: r.rarity,
    supertype: r.supertype,
    subtype: r.subtype,
    // Some schemas may not have JSON types; normalize to array if present.
    types: Array.isArray(r.types) ? r.types : (r.types ? [r.types] : []),
    image_small: r.image_small,
    image_large: r.image_large,
    variants: vmap.get(r.id) || ['normal'],
  }));
}

/* -------------------------
   Public API
   ------------------------- */

export async function searchCards({ input = {}, offset = 0, limit = 50 }) {
  const setRequested = input?.setCode?.trim();
  const setsToRead = setRequested ? [setRequested] : await listAvailableSetCodesFromCache();

  let cards = [];
  if (setsToRead.length) {
    for (const code of setsToRead) {
      try {
        const one = await readSetCache(code);
        cards.push(...one);
      } catch (e) {
        // Cache miss -> DB fallback for that set only
        const one = await queryDb(code);
        cards.push(...one);
      }
    }
  } else {
    // No cache files at all -> full DB fallback (be careful on huge DBs)
    cards = await queryDb(null);
  }

  const filtered = applyFilters(cards, input);
  filtered.sort(sortCardsNatural);
  return page(filtered, offset, limit);
}
