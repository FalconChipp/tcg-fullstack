// src/modules/cardsearch/jobs/verifyDataHealth.job.js
// Verify data health for Card Search:
// - Coverage: sets → cards → variants
// - Price presence: latest & observations
// - Rollup coverage: 1/7/30/90
// - Staleness: latest price age by provider / variant
// - Optional safe fixes: rebuild rollups, seed "normal" variant when obviously missing
//
// Usage (programmatic):
//   const res = await verifyDataHealth({ scope: 'set', target: 'sv08', warnStaleDays: 3, fixMissingVariants: true });
//   const res = await verifyDataHealth({ scope: 'all' });
//
// Returns:
// {
//   ok:true,
//   ranAt:'2025-10-02T13:00:00.000Z',
//   scope:'set',
//   target:'sv08',
//   totals: { sets: 1, cards: 197, variants: 220, latestRows: 440, observations: 14652, rollups: 660 },
//   issues: {
//     setsWithoutCards:[{ code:'svp' }],
//     cardsMissingVariants:[{ cardId:'sv08-123', name:'Pikachu' }, ...],
//     latestMissing:[{ cardId, variant } ...],
//     latestStale:[{ cardId, variant, days, provider } ...],
//     observationsMissing:[{ cardId, variant } ...],
//     rollupsMissing:[{ cardId, variant, missing:['1','7'] } ...],
//   },
//   fixes: {
//     seededVariants: 3,
//     rebuiltRollups: 220
//   },
//   ms: 412
// }

import { Op, fn, col, literal } from "sequelize";
import {
  sequelize,
  m_Set,
  m_Card,
  m_CardVariant,
  m_PriceLatest,
  m_PriceObservation,
  m_PriceRollup,
} from "../../../models/index.js";
import { getLogger } from "../services/logging.service.js";

/**
 * @typedef {Object} VerifyOpts
 * @property {'all'|'set'|'card'} [scope='all']  - audit everything, one set, or one card
 * @property {string} [target]                   - set code (sv08) if scope='set', or cardId (sv08-123) if scope='card'
 * @property {number} [warnStaleDays=2]          - latest price older than this is considered stale
 * @property {boolean} [fixMissingVariants=false]- seed "normal" variant if card has none (safe guard)
 * @property {boolean} [rebuildRollups=false]    - rebuild rollups where missing for audited scope
 * @property {Console | {info:Function,warn:Function,error:Function}} [logger=console]
 * @property {boolean} [dryRun=false]            - show issues, do not modify DB
 */

/**
 * Verify data health for the requested scope.
 * @param {VerifyOpts} opts
 */
export async function verifyDataHealth(opts = {}) {
  const started = Date.now();
  const log = getLogger("verifyDataHealth");
  const scope = opts.scope || "all";
  const target = opts.target || null;
  const warnStaleDays = Number.isFinite(opts.warnStaleDays) ? Math.max(0, opts.warnStaleDays | 0) : 2;
  const fixMissingVariants = !!opts.fixMissingVariants;
  const rebuildRollups = !!opts.rebuildRollups;
  const dryRun = !!opts.dryRun;
  const logger = opts.logger || console;

  // Resolve scope to list of sets & cards we will audit
  let setCodes = [];
  let cardWhere = {};

  if (scope === "card") {
    if (!target || !target.includes("-")) throw new Error("verifyDataHealth(scope='card'): target must be like 'sv08-123'");
    const [set_code, ...n] = target.split("-");
    const number = n.join("-");
    setCodes = [set_code];
    cardWhere = { set_code, number };
  } else if (scope === "set") {
    if (!target) throw new Error("verifyDataHealth(scope='set'): target set code required (e.g., 'sv08')");
    setCodes = [String(target)];
    cardWhere = { set_code: setCodes[0] };
  } else {
    // global
    setCodes = await m_Set.findAll({ attributes: ["code"], order: [["release_date", "DESC"]] })
      .then((rows) => rows.map((r) => r.get("code")));
    cardWhere = {}; // all cards
  }

  // Load cards in-scope
  const cards = await m_Card.findAll({
    where: cardWhere,
    attributes: ["id", "set_code", "number", "name", "rarity", "supertype", "subtype"],
    order: [["set_code", "ASC"], ["number", "ASC"]],
  });

  // Preload variants for those cards
  const cardIds = cards.map((c) => c.get("id"));
  const variants = cardIds.length
    ? await m_CardVariant.findAll({
        where: { card_id: { [Op.in]: cardIds } },
        attributes: ["card_id", "variant", "display_name"],
      })
    : [];

  // Build lookup maps
  const variantsByCard = new Map();
  for (const v of variants) {
    const cid = v.get("card_id");
    const list = variantsByCard.get(cid) || [];
    list.push({ cardId: cid, variant: v.get("variant"), displayName: v.get("display_name") || v.get("variant") });
    variantsByCard.set(cid, list);
  }

  // Coverage: sets -> cards
  const setsWithAnyCards = new Set(cards.map((c) => c.get("set_code")));
  const setsWithoutCards = setCodes
    .filter((code) => !setsWithAnyCards.has(code))
    .map((code) => ({ code }));

  // Cards missing variants
  /** @type {Array<{cardId:string,name:string}>} */
  const cardsMissingVariants = [];
  for (const c of cards) {
    const id = c.get("id");
    if (!variantsByCard.has(id) || variantsByCard.get(id).length === 0) {
      cardsMissingVariants.push({ cardId: id, name: c.get("name") || null });
    }
  }

  // Latest coverage & staleness
  /** @type {Array<{cardId:string,variant:string}>} */
  const latestMissing = [];
  /** @type {Array<{cardId:string,variant:string,days:number,provider:string|null}>} */
  const latestStale = [];

  // Observations coverage
  /** @type {Array<{cardId:string,variant:string}>} */
  const observationsMissing = [];

  // Rollups coverage (expect 1/7/30/90 for each (card,variant))
  /** @type {Array<{cardId:string,variant:string,missing:string[]}>} */
  const rollupsMissing = [];

  // Load Latest & Observations & Rollups in one pass per card/variant
  const staleCutoff = new Date(Date.now() - warnStaleDays * 24 * 3600 * 1000);

  // For performance with large datasets, do it in batches
  const BATCH = 1500;
  for (let i = 0; i < cardIds.length; i += BATCH) {
    const slice = cardIds.slice(i, i + BATCH);
    const vSlice = slice.flatMap((cid) => (variantsByCard.get(cid) || []).map((v) => ({ card_id: cid, variant: v.variant })));

    // Latest
    const latestRows = vSlice.length
      ? await m_PriceLatest.findAll({
          where: {
            [Op.or]: vSlice,
          },
          attributes: ["card_id", "variant", "updated_at", "provider"],
        })
      : [];

    const latestMap = new Map(); // key: cardId::variant -> { updated_at, provider }
    for (const r of latestRows) {
      const k = `${r.get("card_id")}::${r.get("variant")}`;
      const prev = latestMap.get(k);
      // Keep the most recent updated_at per provider entry
      if (!prev || (prev.updated_at || 0) < (r.get("updated_at") || 0)) {
        latestMap.set(k, { updated_at: r.get("updated_at"), provider: r.get("provider") || null });
      }
    }

    // Observations (existence only; detailed series not needed)
    const obsRows = vSlice.length
      ? await m_PriceObservation.findAll({
          where: { [Op.or]: vSlice },
          attributes: ["card_id", "variant"],
          limit: 1, // if any exist, we don't need more
        })
      : [];
    const obsKey = new Set(obsRows.map((r) => `${r.get("card_id")}::${r.get("variant")}`));

    // Rollups windows
    const rollRows = vSlice.length
      ? await m_PriceRollup.findAll({
          where: { [Op.or]: vSlice },
          attributes: ["card_id", "variant", "window"],
        })
      : [];
    const rollMap = new Map(); // key -> Set(windows)
    for (const r of rollRows) {
      const k = `${r.get("card_id")}::${r.get("variant")}`;
      const s = rollMap.get(k) || new Set();
      s.add(String(r.get("window")));
      rollMap.set(k, s);
    }

    // Evaluate
    for (const { card_id, variant } of vSlice) {
      const k = `${card_id}::${variant}`;
      // latest missing or stale
      const L = latestMap.get(k);
      if (!L) {
        latestMissing.push({ cardId: card_id, variant });
      } else {
        const ts = L.updated_at ? new Date(L.updated_at) : null;
        if (ts && ts < staleCutoff) {
          const days = Math.max(0, Math.round((Date.now() - ts.getTime()) / 86400000));
          latestStale.push({ cardId: card_id, variant, days, provider: L.provider || null });
        }
      }
      // observations present?
      if (!obsKey.has(k)) {
        observationsMissing.push({ cardId: card_id, variant });
      }
      // rollups coverage
      const windows = rollMap.get(k) || new Set();
      const need = ["1", "7", "30", "90"];
      const missing = need.filter((w) => !windows.has(w));
      if (missing.length) {
        rollupsMissing.push({ cardId: card_id, variant, missing });
      }
    }
  }

  // Totals snapshot (coarse)
  const totals = {
    sets: setCodes.length,
    cards: cards.length,
    variants: variants.length,
    latestRows: await m_PriceLatest.count({ where: cardIds.length ? { card_id: { [Op.in]: cardIds } } : {} }),
    observations: await m_PriceObservation.count({ where: cardIds.length ? { card_id: { [Op.in]: cardIds } } : {} }),
    rollups: await m_PriceRollup.count({ where: cardIds.length ? { card_id: { [Op.in]: cardIds } } : {} }),
  };

  // Optional fixes (guarded by dryRun)
  let seededVariants = 0;
  let rebuiltRollups = 0;

  if (!dryRun && fixMissingVariants && cardsMissingVariants.length) {
    // Safe heuristic: if a card has no variants at all, seed "normal"
    const toInsert = cardsMissingVariants.map((c) => ({ card_id: c.cardId, variant: "normal", display_name: "normal" }));
    if (toInsert.length) {
      await m_CardVariant.bulkCreate(toInsert, {
        ignoreDuplicates: true,
        updateOnDuplicate: ["display_name"],
      });
      seededVariants = toInsert.length;
    }
  }

  if (!dryRun && rebuildRollups) {
    // Rebuild rollups only for combos that report missing windows (dedup first)
    const missingTargets = new Map(); // cardId::variant -> true
    for (const r of rollupsMissing) missingTargets.set(`${r.cardId}::${r.variant}`, true);

    if (missingTargets.size) {
      const list = Array.from(missingTargets.keys()).map((k) => {
        const [cardId, variant] = k.split("::");
        return { cardId, variant };
      });

      const { rebuildPriceRollups } = await import("./priceRollup.job.js");
      // Process in small groups to avoid long transactions
      const CHUNK = 250;
      for (let i = 0; i < list.length; i += CHUNK) {
        const chunk = list.slice(i, i + CHUNK);
        // `rebuildPriceRollups` supports per-card targeting via options
        // We pass in an array of { cardId, variant } under 'targets'
        // and skip global scans.
        const out = await rebuildPriceRollups({
          scope: "targets",
          targets: chunk,
        });
        rebuiltRollups += out?.counts?.rowsWritten ?? 0;
      }
    }
  }

  const result = {
    ok: true,
    ranAt: new Date().toISOString(),
    scope,
    target,
    totals,
    issues: {
      setsWithoutCards,
      cardsMissingVariants,
      latestMissing,
      latestStale,
      observationsMissing,
      rollupsMissing,
    },
    fixes: {
      seededVariants,
      rebuiltRollups,
    },
    ms: Date.now() - started,
  };

  // log a concise summary
  log.info("health.summary", {
    scope,
    target,
    cards: totals.cards,
    variants: totals.variants,
    issues: {
      setsWithoutCards: setsWithoutCards.length,
      cardsMissingVariants: cardsMissingVariants.length,
      latestMissing: latestMissing.length,
      latestStale: latestStale.length,
      observationsMissing: observationsMissing.length,
      rollupsMissing: rollupsMissing.length,
    },
    fixes: { seededVariants, rebuiltRollups },
    ms: result.ms,
  });

  // friendly console for ad-hoc runs
  logger.info?.(
    `[health] scope=${scope}${target ? ` target=${target}` : ""} cards=${totals.cards} variants=${totals.variants} issues(latestMissing=${latestMissing.length}, stale=${latestStale.length}, obsMissing=${observationsMissing.length}, rollupsMissing=${rollupsMissing.length}) fixes(seeded=${seededVariants}, rebuilt=${rebuiltRollups})`
  );

  return result;
}

/* -------------------------------------------------------------------------- */
/* Optional CLI entrypoint                                                    */
/* -------------------------------------------------------------------------- */
// node src/modules/cardsearch/jobs/verifyDataHealth.job.js all
// node src/modules/cardsearch/jobs/verifyDataHealth.job.js set sv08 --stale=3 --fix-variants --rebuild
// node src/modules/cardsearch/jobs/verifyDataHealth.job.js card sv08-123
const isDirect = (() => {
  try {
    const modulePath = new URL(import.meta.url).pathname;
    return process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === modulePath;
  } catch {
    return false;
  }
})();

if (isDirect) {
  (async () => {
    const args = process.argv.slice(2);
    const scope = (args[0] || "all").toLowerCase();
    const target = args[1] && !args[1].startsWith("--") ? args[1] : undefined;
    const staleArg = args.find((a) => a.startsWith("--stale="));
    const warnStaleDays = staleArg ? Number(staleArg.split("=")[1]) : undefined;
    const fixMissingVariants = args.includes("--fix-variants");
    const rebuildRollups = args.includes("--rebuild");

    try {
      const out = await verifyDataHealth({
        scope: /** @type any */ (scope),
        target,
        warnStaleDays,
        fixMissingVariants,
        rebuildRollups,
      });
      console.log(JSON.stringify(out, null, 2));
      process.exit(0);
    } catch (err) {
      console.error(err?.stack || String(err));
      process.exit(2);
    }
  })();
}

export default { verifyDataHealth };
