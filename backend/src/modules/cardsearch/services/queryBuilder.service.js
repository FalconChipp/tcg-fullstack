// src/modules/cardsearch/services/queryBuilder.service.js
// Query builder helpers for Card Search.
//
// ✅ What’s in this version
// - Keeps your public API the same
// - Case-insensitive LIKE/equals helpers (dialect-aware)
// - Robust set matching by name/code/**abbreviation or abbr** (works if either column exists)
// - ❗ FIX: Abbreviation typed in the Name box now works by OR-ing the name-tokens group
//          with an abbr-derived set_code IN (...) group (instead of AND-ing).
// - Fully-qualified columns for joins to avoid ambiguity
//
// NOTE: Places marked with // CHANGED show exactly what I altered.

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
 * Use literals with fully-qualified names to avoid driver quoting issues.
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
 *
 * CHANGED (abbr-name OR fix):
 * - We now create a nameGroup (AND of tokens or exact) and, if the input looks
 *   like a short token, compute an abbrGroup (set_code IN ...). These are combined as
 *   a single top-level OR sibling that is itself AND-ed with other predicates.
 */
export async function buildCardWhere(input) {
  const name = norm(input?.name, { collapse: true });
  const number = norm(input?.number);
  const setInput = norm(input?.set);
  const fuzzy = input?.fuzzy !== false; // default true

  // We'll collect "AND-level" predicates here (set/number filters, etc.)
  const andPredicates = [];

  // SET filtering (resolve via mapping + DB)
  if (setInput) {
    const setCode = await resolveSetCode(setInput);
    if (setCode) andPredicates.push({ set_code: setCode }); // on m_Card
  }

  // NUMBER filtering (exact) with tolerant padding
  if (number) {
    const variants = buildNumberQueryVariants(number);
    const variantPredicates = variants.map((value) =>
      ciEqualPredicate("m_Card.number", value) // qualified
    );
    if (variantPredicates.length === 1) {
      andPredicates.push(variantPredicates[0]);
    } else if (variantPredicates.length > 1) {
      andPredicates.push({ [Op.or]: variantPredicates });
    }
  }

  // NAME filtering + OR with possible abbreviation-derived set filter
  if (name) {
    // Build the name AND-group first (existing behavior)
    let nameGroup = null;
    if (fuzzy) {
      const toks = tokenizeName(name);
      const andTok = [];
      for (const t of toks) {
        const like = `%${t}%`;
        andTok.push(ciLikePredicate("m_Card.name", like)); // qualified
      }
      if (andTok.length) nameGroup = { [Op.and]: andTok };
    } else {
      nameGroup = ciEqualPredicate("m_Card.name", name);   // qualified
    }

    // CHANGED: treat the free-text name as potential set abbreviation (EVS, SIT, etc.)
    // Only attempt for reasonably short tokens to avoid wide scans.
    let orGroup = null;
    const token = String(name).trim();
    if (token && token.length <= 6) {
      const abbrCodes = await findSetCodesByAbbreviationLike(token);
      if (abbrCodes.length) {
        const abbrGroup = { set_code: { [Op.in]: abbrCodes } };
        // CHANGED: put nameGroup and abbrGroup together under a single OR
        if (nameGroup) {
          orGroup = { [Op.or]: [nameGroup, abbrGroup] };
        } else {
          orGroup = abbrGroup;
        }
      }
    }

    // If we built an OR group, AND it at the top-level.
    // Otherwise, just AND the nameGroup like before.
    if (orGroup) {
      andPredicates.push(orGroup); // CHANGED
    } else if (nameGroup) {
      andPredicates.push(nameGroup);
    }
  }

  return andPredicates.length ? { [Op.and]: andPredicates } : {};
}

/**
 * Build the complete, ready-to-use query parts for card search.
 */
export async function buildCardQuery(input) {
  const where = await buildCardWhere(input);
  let order = buildOrder(input?.orderBy);
  const { limit, offset } = normalizePagination(input);
  const include = buildSetJoinInclude();

  // Preserve your helpful default: when we search only by set, order by number asc
  const orderBy = String(input?.orderBy || "").toUpperCase();
  const hasExplicitOrder = !!orderBy && orderBy !== "RELEVANCE";
  const hasName = !!norm(input?.name, { collapse: true });
  const hasSet = !!norm(input?.set);
  if (!hasExplicitOrder && hasSet && !hasName) {
    order = [[literal("`m_Card`.`number`"), "ASC"]];
  }

  return { where, order, limit, offset, include };
}

/**
 * WHERE builder for m_Set listing with simple name/abbreviation/code contains.
 * NOTE: used on m_Set lookups only, so no alias qualification needed here.
 *
 * CHANGED:
 * - Support BOTH 'abbreviation' and 'abbr' (whichever exists in the schema).
 */
export function buildSetWhere(input) {
  const q = norm(input?.query, { collapse: true });
  if (!q) return {};
  const like = `%${q}%`;

  const ors = [
    ciLikePredicate("name", like),
    ciLikePredicate("code", like),
    // CHANGED: support either column name transparently
    ciLikePredicate("abbreviation", like),
    ciLikePredicate("abbr", like),
  ];

  return { [Op.or]: ors };
}

/* -----------------------------------------------------------------------------
 * Internals
 * -------------------------------------------------------------------------- */

function buildNumberQueryVariants(value) {
  const raw = norm(value);
  if (!raw) return [];

  const variants = new Set([raw]);
  const match = raw.match(/^0*(\d+)(.*)$/i);

  if (match) {
    const [, digits, suffix = ""] = match;

    if (digits) {
      const numericValue = Number(digits);
      if (Number.isFinite(numericValue)) {
        const normalizedDigits = String(numericValue);
        variants.add(`${normalizedDigits}${suffix}`);

        const lengths = new Set([digits.length]);
        if (digits.length < 2) lengths.add(2);
        if (digits.length < 3) lengths.add(3);

        for (const len of lengths) {
          variants.add(`${digits.padStart(len, "0")}${suffix}`);
          variants.add(`${normalizedDigits.padStart(len, "0")}${suffix}`);
        }
      }
    }
  }

  return Array.from(variants).filter(Boolean);
}

/**
 * Resolve a user-provided set input (abbr | tcgdex | ptcg | name fragment) to canonical tcgdex code.
 *
 * Strategy:
 *   1) setMapping.resolveSet(input) → mapping.tcgdex (fast path)
 *   2) direct code match in DB (case-insensitive)
 *   3) name/**abbreviation or abbr** contains in DB (case-insensitive)
 *   4) fallback: resolveToTcgdex(input) or raw
 *
 * CHANGED: step 3 now checks BOTH 'abbreviation' and 'abbr'.
 */
async function resolveSetCode(input) {
  const mapping = resolveSet(input);
  if (mapping?.tcgdex) return mapping.tcgdex;

  const raw = norm(input);
  if (!raw) return null;

  // 2) Try exact code match in DB (case-insensitive)
  const codeCi = await m_Set
    .findOne({
      where: ciEqualPredicate("code", raw),
      attributes: ["code"],
    })
    .catch(() => null);
  if (codeCi) return codeCi.get("code");

  // 3) Fallback: name/abbreviation(or abbr) contains
  const like = `%${raw}%`;
  const byMeta = await m_Set
    .findOne({
      where: {
        [Op.or]: [
          ciLikePredicate("name", like),
          ciLikePredicate("abbreviation", like), // CHANGED
          ciLikePredicate("abbr", like),         // CHANGED
        ],
      },
      attributes: ["code"],
    })
    .catch(() => null);
  if (byMeta) return byMeta.get("code");

  // 4) As-is (user already supplied a tcgdex code or alias)
  const tcgdex = resolveToTcgdex(input) || raw;
  return tcgdex;
}

/**
 * Helper: return set codes whose abbreviation/abbr LIKE token (case-insensitive).
 * Used to make card queries discoverable by typing set abbreviations.
 */
async function findSetCodesByAbbreviationLike(token) {
  const like = `%${norm(token)}%`;
  const rows = await m_Set.findAll({
    where: {
      [Op.or]: [
        ciLikePredicate("abbreviation", like),
        ciLikePredicate("abbr", like),
      ],
    },
    attributes: ["code"],
    raw: true,
  }).catch(() => []);
  return rows.map((r) => String(r.code).toLowerCase());
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
  return sqlWhere(fn("LOWER", col(field)), {
    [Op.like]: String(likePattern).toLowerCase(),
  });
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
