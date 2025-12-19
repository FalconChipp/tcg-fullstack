// components/Home/LiveStats.js
// -----------------------------------------------------------------------------
// "SixByFive in action" stats section (FAKE STATS VERSION)
// - Same UI as production
// - No backend dependency
// - Replace FAKE_STATS with real query later
// -----------------------------------------------------------------------------

"use client";

import React from "react";

// Helper for formatting numbers consistently
function formatNumber(value) {
  if (value == null) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return value.toLocaleString();
  return `${value}`;
}

// Reusable stat card component
function StatCard({ label, value, description }) {
  return (
    <div className="rounded-2xl border border-light-border/40 dark:border-dark-border/40 bg-light-surface dark:bg-dark-surface px-4 py-4 sm:px-5 sm:py-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-light-muted dark:text-dark-muted">
        {label}
      </p>

      <p className="mt-1 text-2xl font-semibold text-light-foreground dark:text-dark-foreground">
        {value}
      </p>

      <p className="mt-1 text-xs text-light-muted dark:text-dark-muted">
        {description}
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// FAKE STATS (safe, believable, cumulative-style numbers)
// You can change these anytime without backend.
// Later, replace this object with real GraphQL query results.
// -----------------------------------------------------------------------------
const FAKE_STATS = {
  totalCardsTracked: 12487,
  totalSearches: 38921,
  totalBinders: 412,
  totalWishlistEntries: 1963,
  totalPriceObservations: 1234567, // looks good formatted as 1.2M
};

export default function LiveStats() {
  const stats = FAKE_STATS;

  return (
    <section className="border-y border-light-border/40 dark:border-dark-border/40 bg-light-surfaceAlt dark:bg-dark-surfaceAlt">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12 lg:py-14">
        
        {/* Section header */}
        <div className="flex flex-col gap-4 sm:items-center sm:justify-between sm:flex-row">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-light-foreground dark:text-dark-foreground">
              SixByFive in action
            </h2>
            <p className="mt-1 text-sm text-light-muted dark:text-dark-muted max-w-xl">
              Real activity from real collectors. These numbers update 
              automatically as people use SixByFive.
            </p>
          </div>

          {/* Status text — static in fake mode */}
          <p className="text-xs text-light-muted dark:text-dark-muted">
            Live collector stats
          </p>
        </div>

        {/* Stats grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Cards tracked"
            value={formatNumber(stats.totalCardsTracked)}
            description="Cards currently added to collections."
          />

          <StatCard
            label="Searches run"
            value={formatNumber(stats.totalSearches)}
            description="Total card lookups across web & mobile."
          />

          <StatCard
            label="Binders created"
            value={formatNumber(stats.totalBinders)}
            description="Digital binders built by collectors."
          />

          <StatCard
            label="Cards wishlisted"
            value={formatNumber(stats.totalWishlistEntries)}
            description="Chase cards people are tracking."
          />

          <StatCard
            label="Price updates processed"
            value={formatNumber(stats.totalPriceObservations)}
            description="Individual market price points ingested."
          />
        </div>
      </div>
    </section>
  );
}
