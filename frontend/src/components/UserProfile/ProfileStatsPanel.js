import React from "react";
import { Sparkles, Book, Star, BadgeDollarSign, Gem } from "lucide-react";

// All color classes updated to use Tailwind palette

export default function ProfileStatsPanel({
  stats = {},
  dark = false,
}) {
  // Helper to format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  // Card & typography palette classes
  const cardClass = `
    rounded-2xl px-6 py-4 flex items-center gap-3 mb-3 
    bg-light-surface dark:bg-dark-surface 
    shadow border border-light-border dark:border-dark-border
  `;
  const labelClass = `
    text-xs font-semibold uppercase tracking-wide mb-1 
    text-light-textMuted dark:text-dark-textMuted
  `;
  const valueClass = `
    text-xl font-bold text-light-primary dark:text-white
  `;
  const descClass = `
    text-xs text-light-textSecondary dark:text-dark-textSecondary
  `;

  return (
    <aside className="w-full max-w-xs mx-auto md:mx-0 mt-6 md:mt-0">
      <div className="flex flex-col gap-3">
        {/* Collection Value */}
        <div className={cardClass}>
          <BadgeDollarSign className="w-6 h-6 text-light-accent dark:text-dark-accent" />
          <div>
            <div className={labelClass}>Collection Value</div>
            <div className={valueClass}>{formatCurrency(stats.collectionValue)}</div>
            <div className={descClass}>Total estimated value</div>
          </div>
        </div>
        {/* Cards Collected */}
        <div className={cardClass}>
          <Book className="w-6 h-6 text-light-secondary dark:text-dark-secondary" />
          <div>
            <div className={labelClass}>Cards Collected</div>
            <div className={valueClass}>{stats.cardsCollected ?? "—"}</div>
            <div className={descClass}>Across all binders</div>
          </div>
        </div>
        {/* Unique Sets */}
        <div className={cardClass}>
          <Gem className="w-6 h-6 text-light-warning dark:text-dark-warning" />
          <div>
            <div className={labelClass}>Unique Sets</div>
            <div className={valueClass}>{stats.uniqueSets ?? "—"}</div>
            <div className={descClass}>Sets represented in collection</div>
          </div>
        </div>
        {/* Completion Rate */}
        <div className={cardClass}>
          <Sparkles className="w-6 h-6 text-light-success dark:text-dark-success" />
          <div>
            <div className={labelClass}>Completion Rate</div>
            <div className={valueClass}>
              {typeof stats.completionRate === "number"
                ? `${stats.completionRate.toFixed(1)}%`
                : "—"}
            </div>
            <div className={descClass}>Percent complete</div>
            {/* Progress bar (uses accent color for progress) */}
            {typeof stats.completionRate === "number" && (
              <div className="h-2 w-full bg-light-alt dark:bg-dark-alt rounded mt-1">
                <div
                  className="h-2 bg-light-accent dark:bg-dark-accent rounded"
                  style={{ width: `${stats.completionRate}%` }}
                />
              </div>
            )}
          </div>
        </div>
        {/* Most Valuable Card */}
        {stats.highestValueCard && (
          <div className={cardClass}>
            <Star className="w-6 h-6 text-light-warning dark:text-dark-warning" />
            <div>
              <div className={labelClass}>Most Valuable Card</div>
              <div className={valueClass}>
                {stats.highestValueCard.name ?? "—"}
              </div>
              <div className={descClass}>
                {stats.highestValueCard.value
                  ? formatCurrency(stats.highestValueCard.value)
                  : ""}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
