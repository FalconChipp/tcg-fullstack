// src/modules/cardsearch/jobs/priceRollup.job.js
// Rebuilds precomputed price rollups by delegating to rollup.service helpers.

import {
  rebuildRollupsAll,
  rebuildRollupsForSet,
  rebuildRollupsForCard,
  rebuildRollupsForVariant,
} from "../services/rollup.service.js";

function toDateInput(value) {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function normalizeVariant(value) {
  return value ? String(value).trim().toLowerCase() : null;
}

/**
 * Rebuild rollups.
 * @param {Object} opts
 * @param {'all'|'set'|'card'} [opts.scope='all']
 * @param {string} [opts.set]
 * @param {string} [opts.cardId]
 * @param {string} [opts.variant]
 * @param {string} [opts.asOf]
 * @param {number} [opts.batchSize]
 * @param {{log?:Function,warn?:Function,error?:Function}} [opts.logger=console]
 */
export async function rebuildPriceRollups(opts = {}) {
  const logger = opts.logger ?? console;
  const scope = opts.scope ?? "all";
  const variant = normalizeVariant(opts.variant);
  const explicitAsOf = toDateInput(opts.asOf);
  const defaultAsOf = toDateInput(new Date().toISOString());
  const effectiveAsOf = explicitAsOf ?? defaultAsOf;
  const batchSize = Number.isFinite(opts.batchSize) ? Number(opts.batchSize) : undefined;

  let result;

  if (scope === "card") {
    if (!opts.cardId) throw new Error("rebuildPriceRollups: 'cardId' is required when scope='card'");
    if (variant) {
      result = await rebuildRollupsForVariant(opts.cardId, variant, { asOf: effectiveAsOf });
    } else {
      result = await rebuildRollupsForCard(opts.cardId, { asOf: effectiveAsOf });
    }
  } else if (scope === "set") {
    if (!opts.set) throw new Error("rebuildPriceRollups: 'set' is required when scope='set'");
    const callOpts = { asOf: effectiveAsOf };
    if (batchSize) callOpts.batchSize = batchSize;
    result = await rebuildRollupsForSet(opts.set, callOpts);
  } else {
    const callOpts = { asOf: effectiveAsOf };
    if (batchSize) callOpts.batchSize = batchSize;
    result = await rebuildRollupsAll(callOpts);
  }

  const summary = { scope, asOf: effectiveAsOf, variant: variant ?? null, ...result };

  logger?.log?.(
    `[rollups] scope=${scope} asOf=${summary.asOf} upserted=${summary.upserted ?? 0}` +
      (scope === "set" ? ` set=${opts.set}` : "") +
      (scope === "card" ? ` cardId=${opts.cardId}${variant ? ` variant=${variant}` : ""}` : "")
  );

  return summary;
}

export default { rebuildPriceRollups };
