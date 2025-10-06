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

import { Op, fn, col, where as sqlWhere, literal } from "sequelize";
import { sequelize, m_Set } from "../../../models/index.js";
import { resolveSet, resolveToTcgdex } from "./setMapping.service.js";
import { norm, tokenizeName } from "./normalizers.service.js";

/* -----------------------------------------------------------------------------
 * Public API
 * -------------------------------------------------------------------------- */

/**
 * Normalize & clamp pagination.
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
 * NOTE: use literals with fully-qualified names to avoid driver quoting issues.
 */
export function buildOrder(orderBy) {
  const by = String(orderBy || "RELEVANCE").toUpperCase();

  // CHANGED: fully-qualified order columns via literal()
  const CARD_NAME_ASC   = [literal("`m_Card`.`name`"),   "ASC"];
  const CARD_NAME_DESC  = [literal("`m_Card`.`name`"),   "DESC"];
  const CARD_NUM_ASC    = [literal("`m_Card`.`number`"), "ASC"];
  const CARD_NUM_DESC   = [literal("`m_Card`.`number`"), "DESC"];
  const SET_CODE_ASC    = [literal("`set`.`code`"),      "ASC"];
  const SET_CODE_DESC   = [literal("`set`.`code`"),      "DESC"];

  switch (by) {
    case "NAME_ASC":   return [CARD_NAME_ASC];
    case "NAME_DESC":  return [CARD_NAME_DESC];
    case "NUMBER_ASC": return [CARD_NUM_ASC];
    case "NUMBER_DESC":return [CARD_NUM_DESC];
    case "SET_ASC":    return [SET_CODE_ASC, CARD_NUM_ASC];
    case "SET_DESC":   return [SET_CODE_DESC, CARD_NUM_DESC];
    case "RELEVANCE":
    default:           return [CARD_NAME_ASC, CARD_NUM_ASC];
  }
}

/**
 * Build include for joining Set (used for SET_* ordering or resolving fields downstream).
 * CHANGED: restrict attributes to only 'code' to avoid selecting columns that may not exist (e.g. enabled).
 */
export function buildSetJoinInclude() {
  return [
    {
      model: m_Set,
      as: "set",               // IMPORTANT: m_Card.belongsTo(m_Set, { as: "set", foreignKey: "set_code", targetKey: "code" })
      required: false,
      attributes: ["code"],    // CHANGED: minimal, portable; prevents 'set.enabled' errors
    },
  ];
}

/**
 * Build WHERE for m_Card given name/number/set inputs (fuzzy AND tokenized name).
 * Qualify card columns to avoid ambiguity with the m_Set join.
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
    if (setCode) predicates.push({ set_code: setCode }); // on m_Card
  }

  // NUMBER filtering (exact)
  if (number) {
    predicates.push(ciEqualPredicate("m_Card.number", number)); // CHANGED: qualified
  }

  // NAME filtering
  if (name) {
    if (fuzzy) {
      const toks = tokenizeName(name);
      for (const t of toks) {
        const like = `%${t}%`;
        predicates.push(ciLikePredicate("m_Card.name", like));   // CHANGED: qualified
      }
    } else {
      predicates.push(ciEqualPredicate("m_Card.name", name));    // CHANGED: qualified
    }
  }

  return predicates.length ? { [Op.and]: predicates } : {};
}

/**
 * Build the complete, ready-to-use query parts for card search.
 */
export async function buildCardQuery(input) {
  const where = await buildCardWhere(input);
  let order = buildOrder(input?.orderBy);
  const { limit, offset } = normalizePagination(input);
  const include = buildSetJoinInclude();

  const orderBy = String(input?.orderBy || '').toUpperCase();
  const hasExplicitOrder = !!orderBy && orderBy !== 'RELEVANCE';
  const hasName = !!norm(input?.name, { collapse: true });
  const hasSet = !!norm(input?.set);
  if (!hasExplicitOrder && hasSet && !hasName) {
    order = [[literal('`m_Card`.`number`'), 'ASC']];
  }

  return { where, order, limit, offset, include };
}

/**
 * WHERE builder for m_Set listing with simple name/abbreviation/code contains.
 * NOTE: used on m_Set lookups only, so no alias qualification needed here.
 */
export function buildSetWhere(input) {
  const q = norm(input?.query, { collapse: true });
  if (!q) return {};
  const like = `%${q}%`;

  const ors = [
    ciLikePredicate("name", like),
    ciLikePredicate("abbreviation", like), // CHANGED: model uses 'abbreviation'
    ciLikePredicate("code", like),
  ];

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
 *   3) name/abbreviation contains in DB (case-insensitive)
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

  // 3) Fallback: name/abbreviation contains
  const like = `%${raw}%`;
  const byMeta = await m_Set.findOne({
    where: {
      [Op.or]: [
        ciLikePredicate("name", like),
        ciLikePredicate("abbreviation", like),
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
 * Accepts a fully-qualified column path (e.g., "m_Card.name") when used with joins.
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
 * Accepts a fully-qualified column path (e.g., "m_Card.number").
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
