// GBP-centric FX service (robust).
// - Fetches USD/EUR *per GBP* directly from two public sources.
// - Caches locally to data/marketdata2/fx/gbp.latest.json
// - Exports: getFxRatesGBP({ force? }), toGBP(amount, currency, fx)

import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchWithTimeout } from './net.js';

const DATA_DIR = process.env.MD2_DATA_DIR || path.join(process.cwd(), 'data', 'marketdata2');
const FX_DIR = path.join(DATA_DIR, 'fx');
const FX_FILE = path.join(FX_DIR, 'gbp.latest.json');

const TTL_MS = Number(process.env.MD2_FX_TTL_MS || 2 * 60 * 60 * 1000); // default 2h
const TIMEOUT_MS = Number(process.env.MD2_FX_TIMEOUT_MS || 8000);

async function readJson(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; }
}
async function writeJson(file, obj) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(obj, null, 2), 'utf8');
}

// ---- fetchers (per GBP) ----

// exchangerate.host
async function fetchPerGbp_exchangerateHost() {
  const url = 'https://api.exchangerate.host/latest?base=GBP&symbols=USD,EUR';
  const r = await fetchWithTimeout(url, undefined, TIMEOUT_MS);
  if (!r.ok) throw new Error(`exchangerate.host ${r.status}`);
  const j = await r.json();
  // shape: { base: 'GBP', rates: { USD: number, EUR: number } }
  const USD = Number(j?.rates?.USD);
  const EUR = Number(j?.rates?.EUR);
  if (!Number.isFinite(USD) || !Number.isFinite(EUR)) throw new Error('exchangerate.host bad payload');
  return { USD, EUR, source: 'exchangerate.host', updatedAt: new Date().toISOString() };
}

// open.er-api.com
async function fetchPerGbp_erapi() {
  const url = 'https://open.er-api.com/v6/latest/GBP';
  const r = await fetchWithTimeout(url, undefined, TIMEOUT_MS);
  if (!r.ok) throw new Error(`er-api ${r.status}`);
  const j = await r.json();
  // shape: { base_code: 'GBP', rates: { USD: number, EUR: number } }
  const USD = Number(j?.rates?.USD);
  const EUR = Number(j?.rates?.EUR);
  if (!Number.isFinite(USD) || !Number.isFinite(EUR)) throw new Error('er-api bad payload');
  return { USD, EUR, source: 'er-api', updatedAt: new Date().toISOString() };
}

async function fetchPerGBP() {
  // Try exchangerate.host first, then er-api
  try { return await fetchPerGbp_exchangerateHost(); }
  catch (e1) {
    try { return await fetchPerGbp_erapi(); }
    catch (e2) {
      const msg = `FX fetch failed: ${String(e1?.message || e1)}; ${String(e2?.message || e2)}`;
      throw new Error(msg);
    }
  }
}

/** Get USD/EUR per GBP (cached to disk). */
export async function getFxRatesGBP({ force = false } = {}) {
  if (!force) {
    const cached = await readJson(FX_FILE);
    if (cached?.updatedAt && (Date.now() - new Date(cached.updatedAt).getTime()) < TTL_MS) {
      return cached;
    }
  }
  const fx = await fetchPerGBP();
  await writeJson(FX_FILE, fx);
  return fx;
}

/** Convert USD/EUR/GBP amounts -> GBP using current fx object. */
export function toGBP(amount, currency, fx) {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  if (!fx) return null;
  const v = Number(amount);
  const c = String(currency || '').toUpperCase();
  if (c === 'GBP') return v;
  if (c === 'USD' && fx.USD) return v / fx.USD; // USD per GBP ⇒ divide to get GBP
  if (c === 'EUR' && fx.EUR) return v / fx.EUR; // EUR per GBP ⇒ divide to get GBP
  return null;
}

export default { getFxRatesGBP, toGBP };
