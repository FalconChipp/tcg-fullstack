// Rebuilds price rollups by delegating to rollup.service helpers (computed on demand).

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

function mergeWindowCounts(target, source) {
  if (!source) return;
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] || 0) + (value || 0);
  }
}

/**
 * Rebuild rollups.
 * @param {Object} opts
 * @param {'all'|'set'|'card'|'targets'} [opts.scope='all']
 * @param {string} [opts.set]
 * @param {string} [opts.cardId]
 * @param {Array<{cardId:string,variant?:string}>} [opts.targets]
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
  } else if (scope === "targets") {
    const targets = Array.isArray(opts.targets) ? opts.targets : [];
    const aggregated = { ok: true, results: [], byWindow: {} };
    for (const target of targets) {
      const cardId = target.cardId || target.card_id;
      const targetVariant = normalizeVariant(target.variant || target.variant_id) || "normal";
      if (!cardId) continue;
      const res = await rebuildRollupsForVariant(cardId, targetVariant, { asOf: effectiveAsOf });
      aggregated.results.push(res);
      mergeWindowCounts(aggregated.byWindow, res.byWindow);
    }
    result = aggregated;
  } else {
    const callOpts = { asOf: effectiveAsOf };
    if (batchSize) callOpts.batchSize = batchSize;
    result = await rebuildRollupsAll(callOpts);
  }

  const totalWindows = result?.byWindow
    ? Object.values(result.byWindow).reduce((acc, n) => acc + (n || 0), 0)
    : 0;

  logger?.log?.(
    `[rollups] scope=${scope} asOf=${effectiveAsOf} windows=${totalWindows}` +
      (scope === "set" ? ` set=${opts.set}` : "") +
      (scope === "card" ? ` cardId=${opts.cardId}${variant ? ` variant=${variant}` : ""}` : "") +
      (scope === "targets" ? ` targets=${Array.isArray(opts.targets) ? opts.targets.length : 0}` : "")
  );

  return { scope, asOf: effectiveAsOf, variant: variant ?? null, ...result };
}

export default { rebuildPriceRollups };
