// src/modules/cardsearch/services/validation.service.js
// Centralized, dependency-free validators for the Card Search module.
//
// Design:
// - validateX(...)  -> { ok: boolean, value?: T, issues?: Issue[] }  // never throws
// - assertX(...)    -> T                                            // throws ValidationError on failure
//
// Notes:
// - We keep validation pure & side-effect free.
// - Where helpful, we "normalize" values (trim, upper/lower, defaulting) before returning.
// - For currencies, we provide both a fast syntactic check and an async capability
//   to confirm support via fx.service.isSupported().
//
// Integration points used:
//   - setMapping.service.js : resolveSet(input)
//   - normalizers.service.js: norm, splitCardId, normalizeVariantKey
//   - fx.service.js         : isSupported (optional async)

// ---- Imports ---------------------------------------------------------------

import { resolveSet } from "./setMapping.service.js";
import { norm, splitCardId, normalizeVariantKey } from "./normalizers.service.js";
import { isSupported as fxIsSupported } from "./fx.service.js";

// ---- Types & helpers -------------------------------------------------------

/**
 * @typedef {{ path: string, code: string, message: string, meta?: any }} Issue
 */

export class ValidationError extends Error {
  /** @param {string} message @param {Issue[]} issues */
  constructor(message, issues = []) {
    super(message);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

/** @template T @param {T} value */
function ok(value) {
  return { ok: true, value, issues: [] };
}

/** @param {Issue[]|Issue} issues */
function fail(issues) {
  const arr = Array.isArray(issues) ? issues : [issues];
  return { ok: false, issues: arr };
}

/** @param {Issue[]} issues */
function throwIfIssues(issues) {
  if (issues.length) throw new ValidationError("Validation failed", issues);
}

/** Clamp integer in [min, max] */
function clampInt(v, min, max) {
  const n = Number.isInteger(v) ? v : Number.parseInt(String(v), 10);
  if (!Number.isFinite(n)) return { n: null, issue: { path: "", code: "not_integer", message: "Expected integer" } };
  const c = Math.max(min, Math.min(max, n));
  return { n: c, issue: null };
}

/** YYYY-MM-DD strict check */
function isDateISO(s) {
  return typeof s === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s);
}

/** Non-empty string after trim */
function nonEmptyStr(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/** Simple currency code check (syntax only) */
function looksLikeCcy(s) {
  return typeof s === "string" && /^[A-Za-z]{3}$/.test(s);
}

// ---- Core validators -------------------------------------------------------

/**
 * Validate & resolve a set selector (abbr | tcgdex | ptcg).
 * Returns normalized mapping and canonical tcgdex code.
 */
export function validateSetSelector(input, { path = "set" } = {}) {
  const issues = [];
  const raw = norm(input);
  if (!raw) {
    issues.push({ path, code: "required", message: "Set is required." });
    return fail(issues);
  }

  const mapping = resolveSet(raw);
  if (!mapping || !mapping.tcgdex) {
    issues.push({
      path,
      code: "unknown_set",
      message: `Could not resolve set: '${raw}'`,
      meta: { input: raw },
    });
    return fail(issues);
  }

  return ok({
    input: raw,
    mapping,
    tcgdex: mapping.tcgdex,
    abbr: mapping.abbr ?? null,
    ptcg: mapping.ptcg ?? null,
  });
}

/**
 * Validate canonical cardId "<setCode>-<number>".
 */
export function validateCardId(cardId, { path = "cardId" } = {}) {
  const issues = [];
  if (!nonEmptyStr(cardId)) {
    issues.push({ path, code: "required", message: "cardId is required." });
    return fail(issues);
  }
  const { setCode, number } = splitCardId(cardId);
  if (!nonEmptyStr(setCode)) issues.push({ path, code: "invalid_card_id", message: "Missing set code." });
  if (!nonEmptyStr(number)) issues.push({ path, code: "invalid_card_id", message: "Missing card number." });
  if (issues.length) return fail(issues);
  return ok({ setCode, number });
}

/**
 * Validate a printed card number (keeps suffixes, allows alphanumerics and dashes).
 */
export function validateCardNumber(number, { path = "number" } = {}) {
  const issues = [];
  const s = norm(number);
  if (!s) {
    issues.push({ path, code: "required", message: "Card number is required." });
    return fail(issues);
  }
  if (!/^[0-9A-Za-z-]+$/.test(s)) {
    issues.push({ path, code: "invalid_number", message: "Card number must be alphanumeric (dashes ok)." });
    return fail(issues);
  }
  return ok(s);
}

/**
 * Validate and normalize a variant label (non-strict; unknowns are normalized, not rejected).
 */
export function validateVariant(variant, { path = "variant" } = {}) {
  const s = normalizeVariantKey(variant);
  if (!s) {
    return fail({ path, code: "invalid_variant", message: "Variant is invalid." });
  }
  return ok(s);
}

/**
 * Validate a 3-letter currency code (syntax only).
 * Use validateCurrencySupported for FX-aware validation.
 */
export function validateCurrency(ccy, { path = "currency" } = {}) {
  const issues = [];
  const s = norm(ccy).toUpperCase();
  if (!s) issues.push({ path, code: "required", message: "Currency is required." });
  else if (!looksLikeCcy(s)) issues.push({ path, code: "invalid_currency", message: "Currency must be a 3-letter code." });
  if (issues.length) return fail(issues);
  return ok(s);
}

/**
 * FX-aware currency validation (async): checks syntactic form then consults fx.service.isSupported().
 */
export async function validateCurrencySupported(ccy, { path = "currency" } = {}) {
  const base = validateCurrency(ccy, { path });
  if (!base.ok) return base;
  try {
    const supported = await fxIsSupported(base.value);
    if (!supported) {
      return fail({ path, code: "unsupported_currency", message: `Currency not supported: ${base.value}` });
    }
  } catch {
    // If fx service is not reachable, keep syntactic validation only.
  }
  return base;
}

/**
 * Validate pagination (limit, offset) with sensible defaults.
 */
export function validatePagination(pagination, { path = "pagination", maxLimit = 200, defaultLimit = 50 } = {}) {
  const issues = [];
  const out = { limit: defaultLimit, offset: 0 };

  // limit
  if (pagination?.limit != null) {
    const { n, issue } = clampInt(pagination.limit, 1, maxLimit);
    if (!n && issue) {
      issues.push({ ...issue, path: `${path}.limit` });
    } else {
      out.limit = n;
    }
  }

  // offset
  if (pagination?.offset != null) {
    const { n, issue } = clampInt(pagination.offset, 0, Number.MAX_SAFE_INTEGER);
    if (n == null && issue) {
      issues.push({ ...issue, path: `${path}.offset` });
    } else {
      out.offset = n ?? 0;
    }
  }

  if (issues.length) return fail(issues);
  return ok(out);
}

/**
 * Validate orderBy for card search.
 */
export function validateOrderBy(orderBy, { path = "orderBy" } = {}) {
  const allowed = new Set(["RELEVANCE", "NAME_ASC", "NAME_DESC", "NUMBER_ASC", "NUMBER_DESC", "SET_ASC", "SET_DESC"]);
  const s = norm(orderBy).toUpperCase() || "RELEVANCE";
  if (!allowed.has(s)) {
    return fail({
      path,
      code: "invalid_enum",
      message: `Invalid orderBy. Allowed: ${Array.from(allowed).join(", ")}`,
      meta: { value: orderBy },
    });
  }
  return ok(s);
}

/**
 * Validate a single ISO date (YYYY-MM-DD).
 */
export function validateDateISO(dateStr, { path = "date" } = {}) {
  if (!isDateISO(dateStr)) {
    return fail({ path, code: "invalid_date", message: "Expected YYYY-MM-DD." });
  }
  return ok(dateStr);
}

/**
 * Validate date range [start, end] (both optional).
 * Ensures proper format and start <= end when both present.
 */
export function validateDateRange({ start, end }, { path = "dateRange" } = {}) {
  const issues = [];
  let s = null, e = null;

  if (start != null) {
    if (!isDateISO(start)) issues.push({ path: `${path}.start`, code: "invalid_date", message: "Expected YYYY-MM-DD." });
    else s = start;
  }
  if (end != null) {
    if (!isDateISO(end)) issues.push({ path: `${path}.end`, code: "invalid_date", message: "Expected YYYY-MM-DD." });
    else e = end;
  }
  if (s && e && s > e) {
    issues.push({ path, code: "invalid_range", message: "start must be <= end." });
  }
  if (issues.length) return fail(issues);
  return ok({ start: s, end: e });
}

/**
 * Validate the Card Search input (GraphQL or REST).
 * Fields: { name?, number?, set?, orderBy?, fuzzy?, limit?, offset? }
 */
export function validateSearchCardsInput(input) {
  const issues = [];
  const out = {
    name: null,
    number: null,
    set: null,
    orderBy: "RELEVANCE",
    fuzzy: true,
    limit: 50,
    offset: 0,
  };

  // name
  if (input?.name != null) {
    const s = norm(input.name, { collapse: true });
    if (s.length > 0) out.name = s;
    else issues.push({ path: "name", code: "invalid_string", message: "Name must be a non-empty string when provided." });
  }

  // number
  if (input?.number != null) {
    const n = norm(input.number);
    if (!/^[0-9A-Za-z-]+$/.test(n)) {
      issues.push({ path: "number", code: "invalid_number", message: "Number must be alphanumeric (dashes ok)." });
    } else {
      out.number = n;
    }
  }

  // set
  if (input?.set != null) {
    const s = norm(input.set);
    if (s.length === 0) {
      issues.push({ path: "set", code: "invalid_string", message: "Set must be non-empty when provided." });
    } else {
      out.set = s;
    }
  }

  // orderBy
  if (input?.orderBy != null) {
    const v = validateOrderBy(input.orderBy);
    if (!v.ok) issues.push(...v.issues);
    else out.orderBy = v.value;
  }

  // fuzzy
  if (input?.fuzzy != null) {
    if (typeof input.fuzzy !== "boolean") {
      issues.push({ path: "fuzzy", code: "invalid_boolean", message: "fuzzy must be boolean." });
    } else out.fuzzy = input.fuzzy;
  }

  // pagination
  const p = validatePagination(
    { limit: input?.limit, offset: input?.offset },
    { maxLimit: 200, defaultLimit: 50 }
  );
  if (!p.ok) issues.push(...p.issues);
  else {
    out.limit = p.value.limit;
    out.offset = p.value.offset;
  }

  // At least one of name | number | set must be present
  if (!out.name && !out.number && !out.set) {
    issues.push({
      path: "input",
      code: "missing_query",
      message: "Provide at least one of: name, number, set.",
    });
  }

  if (issues.length) return fail(issues);
  return ok(out);
}

/**
 * Validate ingestSet job options.
 * { input: 'SSP'|'sv08'|'sv8', refresh?:boolean, dryRun?:boolean }
 */
export function validateIngestSetOptions(opts) {
  const issues = [];
  if (!opts || !nonEmptyStr(opts.input)) {
    issues.push({ path: "input", code: "required", message: "input (set selector) is required." });
    return fail(issues);
  }
  const setSel = validateSetSelector(opts.input);
  if (!setSel.ok) issues.push(...setSel.issues);

  if (opts.refresh != null && typeof opts.refresh !== "boolean") {
    issues.push({ path: "refresh", code: "invalid_boolean", message: "refresh must be boolean." });
  }
  if (opts.dryRun != null && typeof opts.dryRun !== "boolean") {
    issues.push({ path: "dryRun", code: "invalid_boolean", message: "dryRun must be boolean." });
  }

  if (issues.length) return fail(issues);
  return ok({
    input: setSel.value.input,
    tcgdex: setSel.value.tcgdex,
    abbr: setSel.value.abbr,
    ptcg: setSel.value.ptcg,
    refresh: !!opts.refresh,
    dryRun: !!opts.dryRun,
  });
}

/**
 * Validate collectPrices job options.
 * { set: selector, since?: 'YYYY-MM-DD', dryRun?:boolean }
 */
export function validateCollectPricesOptions(opts) {
  const issues = [];
  if (!opts || !nonEmptyStr(opts.set)) {
    issues.push({ path: "set", code: "required", message: "set is required." });
  } else {
    const setSel = validateSetSelector(opts.set, { path: "set" });
    if (!setSel.ok) issues.push(...setSel.issues);
    else opts = { ...opts, tcgdex: setSel.value.tcgdex };
  }

  if (opts?.since != null) {
    if (!isDateISO(opts.since)) {
      issues.push({ path: "since", code: "invalid_date", message: "since must be YYYY-MM-DD." });
    }
  }
  if (opts?.dryRun != null && typeof opts.dryRun !== "boolean") {
    issues.push({ path: "dryRun", code: "invalid_boolean", message: "dryRun must be boolean." });
  }

  if (issues.length) return fail(issues);
  return ok({
    set: opts.set,
    tcgdex: opts.tcgdex,
    since: opts.since ?? null,
    dryRun: !!opts.dryRun,
  });
}

/**
 * Validate collectBoth job options.
 * { sets: string|string[], refreshSet?:boolean, since?:string, prewarmFx?:boolean, backfillFxDays?:number, dryRun?:boolean, pauseMs?:number }
 */
export function validateCollectBothOptions(opts) {
  const issues = [];
  const rawSets = Array.isArray(opts?.sets) ? opts.sets : [opts?.sets].filter(Boolean);
  if (!rawSets.length) {
    issues.push({ path: "sets", code: "required", message: "At least one set selector is required." });
    return fail(issues);
  }

  /** @type {Array<{ input:string, tcgdex:string, abbr:string|null, ptcg:string|null }>} */
  const sets = [];
  rawSets.forEach((s, idx) => {
    const r = validateSetSelector(s, { path: `sets[${idx}]` });
    if (!r.ok) issues.push(...r.issues);
    else sets.push(r.value);
  });

  if (opts?.since != null && !isDateISO(opts.since)) {
    issues.push({ path: "since", code: "invalid_date", message: "since must be YYYY-MM-DD." });
  }
  if (opts?.refreshSet != null && typeof opts.refreshSet !== "boolean") {
    issues.push({ path: "refreshSet", code: "invalid_boolean", message: "refreshSet must be boolean." });
  }
  if (opts?.prewarmFx != null && typeof opts.prewarmFx !== "boolean") {
    issues.push({ path: "prewarmFx", code: "invalid_boolean", message: "prewarmFx must be boolean." });
  }
  if (opts?.backfillFxDays != null) {
    const { n } = clampInt(opts.backfillFxDays, 1, 365);
    if (!n) issues.push({ path: "backfillFxDays", code: "invalid_integer", message: "backfillFxDays must be an integer >= 1." });
  }
  if (opts?.dryRun != null && typeof opts.dryRun !== "boolean") {
    issues.push({ path: "dryRun", code: "invalid_boolean", message: "dryRun must be boolean." });
  }
  if (opts?.pauseMs != null) {
    const { n } = clampInt(opts.pauseMs, 0, 60_000);
    if (n == null) issues.push({ path: "pauseMs", code: "invalid_integer", message: "pauseMs must be an integer >= 0." });
  }

  if (issues.length) return fail(issues);
  return ok({
    sets,
    since: opts?.since ?? null,
    refreshSet: !!opts?.refreshSet,
    prewarmFx: opts?.prewarmFx !== false,
    backfillFxDays: Number.isInteger(opts?.backfillFxDays) ? opts.backfillFxDays : null,
    dryRun: !!opts?.dryRun,
    pauseMs: Number.isInteger(opts?.pauseMs) ? opts.pauseMs : 400,
  });
}

// ---- Throwing "assert*" wrappers -------------------------------------------

export function assertSetSelector(input, opts) {
  const res = validateSetSelector(input, opts);
  if (!res.ok) throw new ValidationError("Invalid set selector", res.issues);
  return res.value;
}

export function assertCardId(cardId, opts) {
  const res = validateCardId(cardId, opts);
  if (!res.ok) throw new ValidationError("Invalid cardId", res.issues);
  return res.value;
}

export function assertCardNumber(number, opts) {
  const res = validateCardNumber(number, opts);
  if (!res.ok) throw new ValidationError("Invalid card number", res.issues);
  return res.value;
}

export function assertVariant(variant, opts) {
  const res = validateVariant(variant, opts);
  if (!res.ok) throw new ValidationError("Invalid variant", res.issues);
  return res.value;
}

export function assertCurrency(ccy, opts) {
  const res = validateCurrency(ccy, opts);
  if (!res.ok) throw new ValidationError("Invalid currency", res.issues);
  return res.value;
}

export async function assertCurrencySupported(ccy, opts) {
  const res = await validateCurrencySupported(ccy, opts);
  if (!res.ok) throw new ValidationError("Unsupported currency", res.issues);
  return res.value;
}

export function assertPagination(p, opts) {
  const res = validatePagination(p, opts);
  if (!res.ok) throw new ValidationError("Invalid pagination", res.issues);
  return res.value;
}

export function assertOrderBy(orderBy, opts) {
  const res = validateOrderBy(orderBy, opts);
  if (!res.ok) throw new ValidationError("Invalid orderBy", res.issues);
  return res.value;
}

export function assertDateISO(dateStr, opts) {
  const res = validateDateISO(dateStr, opts);
  if (!res.ok) throw new ValidationError("Invalid date", res.issues);
  return res.value;
}

export function assertDateRange(r, opts) {
  const res = validateDateRange(r, opts);
  if (!res.ok) throw new ValidationError("Invalid date range", res.issues);
  return res.value;
}

export function assertSearchCardsInput(input) {
  const res = validateSearchCardsInput(input);
  if (!res.ok) throw new ValidationError("Invalid search input", res.issues);
  return res.value;
}

export function assertIngestSetOptions(opts) {
  const res = validateIngestSetOptions(opts);
  if (!res.ok) throw new ValidationError("Invalid ingest options", res.issues);
  return res.value;
}

export function assertCollectPricesOptions(opts) {
  const res = validateCollectPricesOptions(opts);
  if (!res.ok) throw new ValidationError("Invalid collect options", res.issues);
  return res.value;
}

export function assertCollectBothOptions(opts) {
  const res = validateCollectBothOptions(opts);
  if (!res.ok) throw new ValidationError("Invalid collectBoth options", res.issues);
  return res.value;
}

// ---- Default export ---------------------------------------------------------

export default {
  // result helpers
  ValidationError,
  ok,
  fail,

  // validators (non-throwing)
  validateSetSelector,
  validateCardId,
  validateCardNumber,
  validateVariant,
  validateCurrency,
  validateCurrencySupported,
  validatePagination,
  validateOrderBy,
  validateDateISO,
  validateDateRange,
  validateSearchCardsInput,
  validateIngestSetOptions,
  validateCollectPricesOptions,
  validateCollectBothOptions,

  // throwing assertors
  assertSetSelector,
  assertCardId,
  assertCardNumber,
  assertVariant,
  assertCurrency,
  assertCurrencySupported,
  assertPagination,
  assertOrderBy,
  assertDateISO,
  assertDateRange,
  assertSearchCardsInput,
  assertIngestSetOptions,
  assertCollectPricesOptions,
  assertCollectBothOptions,
};
