"use client";
import React from "react";

/**
 * Props:
 * - plansData: [{ id, name }]
 * - rows: [{ feature, free, plus, pro }]
 *
 * NOTE: This table compares Free / Collector / Elite Collector.
 *       Vendor is seller-focused and omitted here.
 */
export default function SubscriptionComparisonTable({ plansData = [], rows = [] }) {
  // CHANGED: map our ids to the table’s “free / plus / pro” columns logically
  const columnOrder = ["free", "collector", "elite"]; // NEW
  const plans = columnOrder
    .map((id) => plansData.find((p) => p.id === id))
    .filter(Boolean);

  const cellClass =
    "px-3 py-3 text-sm text-light-textSecondary dark:text-dark-textSecondary border-t border-light-border dark:border-dark-border";

  return (
    <section className="max-w-6xl mx-auto px-4 py-12">
      <h2 className="text-center text-2xl md:text-3xl font-bold mb-6 text-light-primary dark:text-dark-primary">
        Compare Plans
      </h2>
      <div className="overflow-x-auto rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shadow-lg ring-1 ring-black/5 dark:ring-black/20">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-light-alt dark:bg-dark-alt">
              <th className="text-left px-3 py-3 text-sm font-semibold text-light-text dark:text-dark-text border-b border-light-border dark:border-dark-border">
                Features
              </th>
              {plans.map((p) => (
                <th
                  key={p.id}
                  className="px-3 py-3 text-sm font-semibold text-light-text dark:text-dark-text text-left border-b border-light-border dark:border-dark-border"
                >
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="align-top">
                <td className={`${cellClass} font-medium text-light-text dark:text-dark-text`}>{r.feature}</td>
                {plans.map((p) => {
                  // CHANGED: map values by our logical column names
                  const val =
                    p.id === "free" ? r.free : p.id === "collector" ? r.plus : r.pro;
                  const isTick = val === "✓";
                  const isDash = val === "—";
                  return (
                    <td key={p.id} className={cellClass}>
                      {isTick ? (
                        <span aria-label="Included" title="Included">✓</span>
                      ) : isDash ? (
                        <span aria-label="Not included" title="Not included">—</span>
                      ) : (
                        <span>{val}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-center text-light-textMuted dark:text-dark-textMuted">
        Notes: “coming soon” items will roll out during the beta. Marketplace fee reductions apply when the marketplace launches.
      </p>
    </section>
  );
}
