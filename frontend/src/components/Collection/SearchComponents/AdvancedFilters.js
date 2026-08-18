"use client";

import React, { useMemo } from "react";

/* -------------------------------------------------------------------------- */
/*  RARITY CONFIG: canonical order + all known raw API values                  */
/*  Ordered from MOST common → LEAST common                                   */
/* -------------------------------------------------------------------------- */

const RARITY_CONFIG = [
  {
    id: "common",
    label: "Common",
    raws: ["Common", "Common "],
  },
  {
    id: "uncommon",
    label: "Uncommon",
    raws: ["Uncommon"],
  },
  {
    id: "rare",
    label: "Rare",
    raws: ["Rare"],
  },
  {
    id: "double-rare",
    label: "Double Rare",
    raws: ["Double Rare", "Double rare"],
  },
  {
    id: "art-rare",
    label: "Art Rare",
    // some providers send “Illustration rare” instead
    raws: ["Art Rare", "Illustration rare"],
  },
  {
    id: "sir",
    label: "Special Illustration Rare",
    raws: ["Special Illustration Rare", "Secial Illustration Rare"],
  },
  {
    id: "ur",
    label: "Ultra Rare",
    raws: ["Ultra Rare", "Ultra rare"],
  },
  {
    id: "hr",
    label: "Hyper Rare",
    raws: ["Hyper Rare", "Hyper rare"],
  },
];

// normalise helper for defensive matching
const normalise = (val) => (val || "").toString().trim().toLowerCase();

// map: normalised raw → groupId
const NORMALISED_TO_GROUP = RARITY_CONFIG.reduce((acc, cfg) => {
  cfg.raws.forEach((raw) => {
    acc[normalise(raw)] = cfg.id;
  });
  return acc;
}, {});

// set of all known normalised raw strings (for “extra” rarities)
const KNOWN_NORMALISED_RARITIES = new Set(
  RARITY_CONFIG.flatMap((cfg) => cfg.raws.map(normalise))
);

/**
 * AdvancedFilters
 * ---------------
 * Persistent sidebar filter panel for the CardSearch page — rarity and
 * variant filters as checkbox rows, plus a price range, matching the
 * Stitch "Card Search Redesign" reference layout. Sort lives in the page's
 * results header, not in here.
 */
export default function AdvancedFilters({
  filters,
  onChange,
  availableRarities,
  availableVariations,
}) {
  const {
    minPrice,
    maxPrice,
    rarities,
    variations,
    onlyHasPrices,
    onlyHasReverse,
  } = filters || {};

  /* ------------------------------ Basic helpers ---------------------------- */

  const updateField = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key, value) => {
    const current = new Set(filters[key] || []);
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    onChange({ ...filters, [key]: Array.from(current) });
  };

  const handleClearFilters = () => {
    onChange({
      minPrice: "",
      maxPrice: "",
      rarities: [],
      variations: [],
      sortBy: "relevance",
      onlyHasPrices: false,
      onlyHasReverse: false,
    });
  };

  /* ------------------------ RARITY GROUPING / ORDER ------------------------ */

  const currentRarities = new Set(rarities || []);

  // Which canonical groups actually appear in the current results
  const groupPresence = useMemo(() => {
    const presence = new Map(); // groupId -> boolean
    RARITY_CONFIG.forEach((g) => presence.set(g.id, false));

    (availableRarities || []).forEach((raw) => {
      const gid = NORMALISED_TO_GROUP[normalise(raw)];
      if (gid) presence.set(gid, true);
    });

    return presence;
  }, [availableRarities]);

  // Unknown rarities (not in our config) – shown as individual chips at the end
  const extraRarities = useMemo(() => {
    const seen = new Set();
    const extras = [];
    (availableRarities || []).forEach((raw) => {
      const norm = normalise(raw);
      if (!KNOWN_NORMALISED_RARITIES.has(norm) && !seen.has(norm)) {
        seen.add(norm);
        extras.push(raw);
      }
    });
    return extras;
  }, [availableRarities]);

  // Toggle a whole canonical rarity group (adds/removes *all* its raw variants)
  const toggleRarityGroup = (group) => {
    const next = new Set(currentRarities);
    const anyIncluded = group.raws.some((r) => next.has(r));

    if (anyIncluded) {
      group.raws.forEach((r) => next.delete(r));
    } else {
      group.raws.forEach((r) => next.add(r));
    }

    onChange({ ...filters, rarities: Array.from(next) });
  };

  // A group is "active" if ANY of its raw values are currently selected
  const isGroupActive = (group) =>
    group.raws.some((r) => currentRarities.has(r));

  /* ------------------------------------------------------------------------ */

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-vault text-base font-semibold text-vault-text">
          Advanced Filters
        </h2>
        <button
          type="button"
          onClick={handleClearFilters}
          className="text-xs font-semibold text-vault-accent hover:text-vault-accentHover"
        >
          Clear All
        </button>
      </div>

      {/* Rarity */}
      <div>
        <h3 className="mb-3 font-vault-body text-[11px] font-semibold uppercase tracking-[0.06em] text-vault-textTertiary">
          Rarity
        </h3>

        <div className="space-y-2">
          {RARITY_CONFIG.map((group) => {
            const active = isGroupActive(group);
            const present = groupPresence.get(group.id) ?? false;

            return (
              <label
                key={group.id}
                className={`flex items-center gap-2.5 text-sm cursor-pointer ${
                  present ? "text-vault-textSecondary" : "text-vault-textTertiary opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleRarityGroup(group)}
                  className="rounded border-vault-border bg-vault-surface accent-vault-accent"
                />
                <span className={active ? "text-vault-text" : ""}>{group.label}</span>
              </label>
            );
          })}

          {/* Any unknown rarities from the API (e.g. ACE SPEC Rare) */}
          {extraRarities.map((rarity) => {
            const isActive = currentRarities.has(rarity);
            return (
              <label
                key={rarity}
                className="flex items-center gap-2.5 text-sm text-vault-textSecondary cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => toggleArrayFilter("rarities", rarity)}
                  className="rounded border-vault-border bg-vault-surface accent-vault-accent"
                />
                <span className={isActive ? "text-vault-text" : ""}>{rarity}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Variants */}
      <div>
        <h3 className="mb-3 font-vault-body text-[11px] font-semibold uppercase tracking-[0.06em] text-vault-textTertiary">
          Variants
        </h3>
        {availableVariations && availableVariations.length > 0 ? (
          <div className="space-y-2">
            {availableVariations.map((variation) => {
              const isActive = variations?.includes(variation);
              return (
                <label
                  key={variation}
                  className="flex items-center gap-2.5 text-sm text-vault-textSecondary cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => toggleArrayFilter("variations", variation)}
                    className="rounded border-vault-border bg-vault-surface accent-vault-accent"
                  />
                  <span className={isActive ? "text-vault-text" : ""}>{variation}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-vault-textTertiary">
            Variant filters will appear after you search.
          </p>
        )}
      </div>

      {/* Price range */}
      <div>
        <h3 className="mb-3 font-vault-body text-[11px] font-semibold uppercase tracking-[0.06em] text-vault-textTertiary">
          Price (GBP)
        </h3>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            value={minPrice}
            onChange={(e) => updateField("minPrice", e.target.value)}
            placeholder="Min"
            className="w-full rounded-[6px] border border-vault-border bg-vault-surface px-3 py-2 text-sm text-vault-text placeholder-vault-textTertiary outline-none focus:border-vault-accent"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={maxPrice}
            onChange={(e) => updateField("maxPrice", e.target.value)}
            placeholder="Max"
            className="w-full rounded-[6px] border border-vault-border bg-vault-surface px-3 py-2 text-sm text-vault-text placeholder-vault-textTertiary outline-none focus:border-vault-accent"
          />
        </div>

        <div className="mt-3 space-y-2 text-sm text-vault-textSecondary">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-vault-border bg-vault-surface accent-vault-accent"
              checked={onlyHasPrices}
              onChange={(e) => updateField("onlyHasPrices", e.target.checked)}
            />
            <span>Only show cards with price data</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-vault-border bg-vault-surface accent-vault-accent"
              checked={onlyHasReverse}
              onChange={(e) => updateField("onlyHasReverse", e.target.checked)}
            />
            <span>Only cards with a reverse variant</span>
          </label>
        </div>
      </div>
    </div>
  );
}
