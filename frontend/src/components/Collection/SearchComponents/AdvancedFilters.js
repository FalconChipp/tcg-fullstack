"use client";

import React, { useState, useMemo } from "react";

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
 * Generic filter panel for the CardSearch page.
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
    sortBy,
    onlyHasPrices,
    onlyHasReverse,
  } = filters || {};

  // Closed by default
  const [isOpen, setIsOpen] = useState(false);

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

  const sortOptions = [
    { value: "relevance", label: "Relevance (default)" },
    { value: "price-asc", label: "Price: Low → High" },
    { value: "price-desc", label: "Price: High → Low" },
    { value: "rarity-asc", label: "Rarity: Low → High" },
    { value: "rarity-desc", label: "Rarity: High → Low" },
    { value: "number-asc", label: "Card No: Ascending" },
    { value: "number-desc", label: "Card No: Descending" },
    { value: "name-asc", label: "Name: A → Z" },
    { value: "name-desc", label: "Name: Z → A" },
  ];

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
    <section className="mt-3 mb-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold tracking-tight">
            Advanced Filters
          </h2>

          {/* Collapse / expand toggle */}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm px-3 py-1.5 rounded-full bg-light-alt/70 dark:bg-dark-alt/70 text-light-textMuted dark:text-dark-textMuted hover:bg-light-alt dark:hover:bg-dark-alt transition"
          >
            <span>{isOpen ? "Hide" : "Show"}</span>
            <span
              className={`inline-block transform transition-transform duration-200 ${
                isOpen ? "rotate-0" : "-rotate-90"
              }`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="text-light-textMuted dark:text-dark-textMuted"
              >
                <path
                  d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"
                  fill="currentColor"
                />
              </svg>
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Sort dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs sm:text-sm text-light-textMuted dark:text-dark-textMuted">
              Sort by
            </label>
            <select
              value={sortBy || "relevance"}
              onChange={(e) => updateField("sortBy", e.target.value)}
              className="border border-light-border/60 dark:border-dark-border/60 rounded-lg px-3 py-1.5 text-xs sm:text-sm bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent focus:outline-none"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear filters */}
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs sm:text-sm px-3 py-1.5 rounded-lg border border-light-border/60 dark:border-dark-border/60 text-light-textMuted dark:text-dark-textMuted hover:bg-light-alt dark:hover:bg-dark-alt transition"
          >
            Clear filters
          </button>
        </div>
      </div>

      {/* Collapsible filter grid */}
      {isOpen && (
        <div className="mt-4 bg-light-surface/60 dark:bg-dark-surface/60 rounded-2xl px-4 py-4 sm:px-5 sm:py-5 border border-light-border/40 dark:border-dark-border/40">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
            {/* Price filters */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Price (GBP)</h3>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={minPrice}
                  onChange={(e) => updateField("minPrice", e.target.value)}
                  placeholder="Min"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-light-alt dark:bg-dark-alt border-light-border dark:border-dark-border text-light-text dark:text-dark-text placeholder-light-textMuted dark:placeholder-dark-textMuted focus:border-light-accent dark:focus:border-dark-accent focus:outline-none"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={maxPrice}
                  onChange={(e) => updateField("maxPrice", e.target.value)}
                  placeholder="Max"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-light-alt dark:bg-dark-alt border-light-border dark:border-dark-border text-light-text dark:text-dark-text placeholder-light-textMuted dark:placeholder-dark-textMuted focus:border-light-accent dark:focus:border-dark-accent focus:outline-none"
                />
              </div>

              <div className="mt-3 flex flex-col gap-1.5 text-xs text-light-textMuted dark:text-dark-textMuted">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-light-border dark:border-dark-border"
                    checked={onlyHasPrices}
                    onChange={(e) =>
                      updateField("onlyHasPrices", e.target.checked)
                    }
                  />
                  <span>Only show cards with price data</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-light-border dark:border-dark-border"
                    checked={onlyHasReverse}
                    onChange={(e) =>
                      updateField("onlyHasReverse", e.target.checked)
                    }
                  />
                  <span>Only cards with a reverse variant</span>
                </label>
              </div>
            </div>

            {/* Rarity filters */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Rarity</h3>

              <div className="flex flex-wrap gap-2">
                {/* Canonical rarity chips – always shown, dim if no cards of that rarity */}
                {RARITY_CONFIG.map((group) => {
                  const active = isGroupActive(group);
                  const present = groupPresence.get(group.id) ?? false;

                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => toggleRarityGroup(group)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                        active
                          ? "bg-light-accent dark:bg-dark-accent text-light-surface dark:text-dark-surface border-light-accent dark:border-dark-accent"
                          : "bg-light-alt dark:bg-dark-alt text-light-textMuted dark:text-dark-textMuted border-light-border dark:border-dark-border hover:border-light-accent/60 dark:hover:border-dark-accent/60"
                      } ${present ? "" : "opacity-60"}`}
                    >
                      {group.label}
                    </button>
                  );
                })}

                {/* Any unknown rarities from the API (e.g. ACE SPEC Rare) */}
                {extraRarities.map((rarity) => {
                  const isActive = currentRarities.has(rarity);
                  return (
                    <button
                      key={rarity}
                      type="button"
                      onClick={() => toggleArrayFilter("rarities", rarity)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                        isActive
                          ? "bg-light-accent dark:bg-dark-accent text-light-surface dark:text-dark-surface border-light-accent dark:border-dark-accent"
                          : "bg-light-alt dark:bg-dark-alt text-light-textMuted dark:text-dark-textMuted border-light-border dark:border-dark-border hover:border-light-accent/60 dark:hover:border-dark-accent/60"
                      }`}
                    >
                      {rarity}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Variant filters */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Variants</h3>
              {availableVariations && availableVariations.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {availableVariations.map((variation) => {
                    const isActive = variations?.includes(variation);
                    return (
                      <button
                        key={variation}
                        type="button"
                        onClick={() =>
                          toggleArrayFilter("variations", variation)
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                          isActive
                            ? "bg-light-accent dark:bg-dark-accent text-light-surface dark:text-dark-surface border-light-accent dark:border-dark-accent"
                            : "bg-light-alt dark:bg-dark-alt text-light-textMuted dark:text-dark-textMuted border-light-border dark:border-dark-border hover:border-light-accent/60 dark:hover-border-dark-accent/60"
                        }`}
                      >
                        {variation}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-light-textMuted dark:text-dark-textMuted">
                  Variant filters will appear after you search.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
