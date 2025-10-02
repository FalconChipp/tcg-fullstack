// src/modules/cardsearch/services/queryBuilder.service.js
// Query builder helpers for Card Search.
// - Centralizes predicates for the six query modes: Name, Name+Set, Name+Number, Number+Set, Number, Set
// - Handles pagination + ordering
// - Resolves set inputs via setMapping + DB fallback
// - Dialect-aware case-insensitive matching (Postgres uses iLike; others emulate via LOWER(...))
// - Pure build functions returning { where, order, limit, offset, include } for Sequelize calls.
//
// Usage:
//   import qb from "./queryBuilder.service.js";
//   const { where, order, limit, offset, include } = await qb.buildCardQuery(input);
//   const total = await m_Card.count({ where });
//   const rows  = await m_Card.findAll({ where, order, limit, offset, include });
//
// No TODOs, no temp code.

import { Op, fn, col, where as sqlWhere, literal } from "sequelize";
import { sequelize, m_Set } from "../../../models/index.js";
import { resolveSet, resolveToTcgdex } from "./setMapping.service.js";
import { norm, tokenizeName } from "./normalizers.service.js";

/* -----------------------------------------------------------------------------
 * Public API
 * -------------------------------------------------------------------------- */

/**
 * Normalize & clamp pagination.
 * @param {any} input
 * @param {{ maxLimit?: number, defaultLimit?: number }} [opts]
 */
export function normalizePagination(input, opts = {}) {
  const maxLimit = Number.isFinite(opts.maxLimit) ? opts.maxLimit : 200;
  const defaultLimit = Number.isFinite(opts.defaultLimit) ? opts.defaultLimit : 50;

  let limit = Number(input?.limit);
  if (!Number.isFinite(limit) || limit <= 0) limit = defaultLimit;
  limit = Math.max(1, Math.min(maxLimit, limit));

  let offset = Number(input?.offset);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  return { limit, offset };
}

/**
 * Build ORDER BY for cards.
 * @param {"RELEVANCE"|"NAME_ASC"|"NAME_DESC"|"NUMBER_ASC"|"NUMBER_DESC"|"SET_ASC"|"SET_DESC"} orderBy
 */
export function buildOrder(orderBy) {
  switch (String(orderBy || "RELEVANCE").toUpperCase()) {
    case "NAME_ASC":
      return [["name", "ASC"]];
    case "NAME_DESC":
      return [["name", "DESC"]];
    case "NUMBER_ASC":
      return [["number", "ASC"]];
    case "NUMBER_DESC":
      return [["number", "DESC"]];
    case "SET_ASC":
      return [[col("set.code"), "ASC"], ["number", "ASC"]];
    case "SET_DESC":
      return [[col("set.code"), "DESC"], ["number", "DESC"]];
    case "RELEVANCE":
    default:
      // Deterministic fallback
      return [["name", "ASC"], ["number", "ASC"]];
  }
}

/**
 * Build include for joining Set (used for SET_* ordering or resolving fields downstream).
 */
export function buildSetJoinInclude() {
  return [
    {
      model: m_Set,
      as: "set",
      required: false,
      attributes: ["code", "abbr", "name", "series", "released_at", "total", "lang"],
    },
  ];
}

/**
 * Build WHERE for m_Card given name/number/set inputs (fuzzy AND tokenized name).
 * - set: resolved to canonical tcgdex code (via setMapping + DB fallback)
 * - number: exact match (keep suffixes, leading zeros)
 * - name: if fuzzy=true, tokenized AND of LIKE/iLike; else exact match
 * @param {{ name?:string, number?:string, set?:string, fuzzy?:boolean }} input
 */
export async function buildCardWhere(input) {
  const name = norm(input?.name, { collapse: true });
  const number = norm(input?.number);
  const setInput = norm(input?.set);
  const fuzzy = input?.fuzzy !== false; // default true

  const predicates = [];

  // SET filtering (resolve via mapping + DB)
  if (setInput) {
    const setCode = await resolveSetCode(setInput);
    if (setCode) predicates.push({ set_code: setCode });
  }

  // NUMBER filtering (exact)
  if (number) {
    predicates.push({ number });
  }

  // NAME filtering
  if (name) {
    if (fuzzy) {
      // AND across tokens
      const toks = tokenizeName(name);
      for (const t of toks) {
        const like = `%${t}%`;
        predicates.push(ciLikePredicate("name", like));
      }
    } else {
      predicates.push(ciEqualPredicate("name", name));
    }
  }

  return predicates.length ? { [Op.and]: predicates } : {};
}

/**
 * Build the complete, ready-to-use query parts for card search.
 * @param {{ name?:string, number?:string, set?:string, fuzzy?:boolean, orderBy?:string, limit?:number, offset?:number }} input
 * @returns {Promise<{ where:any, order:any, limit:number, offset:number, include:any[] }>}
 */
export async function buildCardQuery(input) {
  const where = await buildCardWhere(input);
  const order = buildOrder(input?.orderBy);
  const { limit, offset } = normalizePagination(input);
  const include = buildSetJoinInclude();
  return { where, order, limit, offset, include };
}

/**
 * WHERE builder for m_Set listing with simple name/abbr/code contains.
 * @param {{ query?: string }} input
 */
export function buildSetWhere(input) {
  const q = norm(input?.query, { collapse: true });
  if (!q) return {};
  const like = `%${q}%`;

  const ors = [
    ciLikePredicate("name", like),
    ciLikePredicate("abbr", like),
    ciLikePredicate("code", like),
  ];

  // Compact ORs that may be sqlWhere objects or simple {field:{[Op.like]}} forms:
  return { [Op.or]: ors };
}

/* -----------------------------------------------------------------------------
 * Internals
 * -------------------------------------------------------------------------- */

/**
 * Resolve a user-provided set input (abbr | tcgdex | ptcg | name fragment) to canonical tcgdex code.
 * Strategy:
 *   1) setMapping.resolveSet(input) → mapping.tcgdex (fast path)
 *   2) direct code match in DB (case-insensitive)
 *   3) name/abbr contains in DB (case-insensitive)
 */
async function resolveSetCode(input) {
  const mapping = resolveSet(input);
  if (mapping?.tcgdex) return mapping.tcgdex;

  const raw = norm(input);
  if (!raw) return null;

  // 2) Try exact code match in DB (case-insensitive)
  const codeCi = await m_Set.findOne({
    where: ciEqualPredicate("code", raw),
    attributes: ["code"],
  }).catch(() => null);
  if (codeCi) return codeCi.get("code");

  // 3) Fallback: name/abbr contains
  const like = `%${raw}%`;
  const byMeta = await m_Set.findOne({
    where: {
      [Op.or]: [
        ciLikePredicate("name", like),
        ciLikePredicate("abbr", like),
      ],
    },
    attributes: ["code"],
  }).catch(() => null);
  if (byMeta) return byMeta.get("code");

  // As-is (user already supplied a tcgdex code)
  const tcgdex = resolveToTcgdex(input) || raw;
  return tcgdex;
}

/**
 * Case-insensitive "LIKE" predicate, dialect-aware.
 * - Postgres: { field: { [Op.iLike]: like } }
 * - Others  : where(LOWER(col(field)), LIKE, lower(like))
 */
function ciLikePredicate(field, likePattern) {
  const dialect = tryGetDialect();
  if (dialect === "postgres" || dialect === "postgresql") {
    return { [field]: { [Op.iLike]: likePattern } };
  }
  // Emulate case-insensitive LIKE: LOWER(field) LIKE LOWER(pattern)
  return sqlWhere(fn("LOWER", col(field)), { [Op.like]: String(likePattern).toLowerCase() });
}

/**
 * Case-insensitive equality predicate (exact match).
 * - Postgres: LOWER(field) = LOWER(value)  (iLike doesn't support equality efficiently)
 * - Others  : LOWER(field) = LOWER(value)
 */
function ciEqualPredicate(field, value) {
  const v = String(value).toLowerCase();
  return sqlWhere(fn("LOWER", col(field)), v);
}

function tryGetDialect() {
  try {
    return sequelize?.getDialect?.() || null;
  } catch {
    return null;
  }
}

/* -----------------------------------------------------------------------------
 * Default export
 * -------------------------------------------------------------------------- */

export default {
  // cards
  buildCardWhere,
  buildCardQuery,
  buildSetJoinInclude,
  buildOrder,
  normalizePagination,

  // sets
  buildSetWhere,
};
