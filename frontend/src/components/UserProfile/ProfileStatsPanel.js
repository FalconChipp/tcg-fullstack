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
    rounded-[10px] px-6 py-4 flex items-center gap-3 mb-3 
    bg-vault-surface 
     border border-vault-border
  `;
  const labelClass = `
    text-xs font-semibold uppercase tracking-wide mb-1 
    text-vault-textTertiary
  `;
  const valueClass = `
    text-xl font-bold text-vault-accent dark:text-white
  `;
  const descClass = `
    text-xs text-vault-textSecondary
  `;

  return (
    <aside className="w-full max-w-xs mx-auto md:mx-0 mt-6 md:mt-0">
      <div className="flex flex-col gap-3">
        {/* Collection Value */}
        <div className={cardClass}>
          <BadgeDollarSign className="w-6 h-6 text-vault-accent" />
          <div>
            <div className={labelClass}>Collection Value</div>
            <div className={valueClass}>{formatCurrency(stats.collectionValue)}</div>
            <div className={descClass}>Total estimated value</div>
          </div>
        </div>
        {/* Cards Collected */}
        <div className={cardClass}>
          <Book className="w-6 h-6 text-vault-textSecondary dark:text-vault-textSecondary" />
          <div>
            <div className={labelClass}>Cards Collected</div>
            <div className={valueClass}>{stats.cardsCollected ?? "—"}</div>
            <div className={descClass}>Across all binders</div>
          </div>
        </div>
        {/* Unique Sets */}
        <div className={cardClass}>
          <Gem className="w-6 h-6 text-vault-warning dark:text-vault-warning" />
          <div>
            <div className={labelClass}>Unique Sets</div>
            <div className={valueClass}>{stats.uniqueSets ?? "—"}</div>
            <div className={descClass}>Sets represented in collection</div>
          </div>
        </div>
        {/* Completion Rate */}
        <div className={cardClass}>
          <Sparkles className="w-6 h-6 text-vault-success dark:text-vault-success" />
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
              <div className="h-2 w-full bg-vault-raised rounded mt-1">
                <div
                  className="h-2 bg-vault-accent rounded"
                  style={{ width: `${stats.completionRate}%` }}
                />
              </div>
            )}
          </div>
        </div>
        {/* Most Valuable Card */}
        {stats.highestValueCard && (
          <div className={cardClass}>
            <Star className="w-6 h-6 text-vault-warning dark:text-vault-warning" />
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
