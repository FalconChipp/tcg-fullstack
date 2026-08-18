// frontend/src/components/Marketplace/SellerTierBadge.js
"use client";

import React from "react";
import { getSellerTier } from "@/utils/sellerTier";

/**
 * SellerTierBadge
 *
 * size="sm"  — compact chip: ● Gold · 32 sales          (listing modal, profile header)
 * size="lg"  — full card: tier name, progress bar,       (reviews drawer header)
 *              positive rate, next tier hint
 */
export default function SellerTierBadge({ reputation, size = "sm", onClick }) {
  if (!reputation) return null;

  const { tier, positiveRate, totalRatings, nextTier, progressPct } = getSellerTier(reputation);
  const sales = reputation.completedMarketplace ?? 0;

  /* ── Compact chip ─────────────────────────────────────────────────────────── */
  if (size === "sm") {
    return (
      <button
        type={onClick ? "button" : undefined}
        onClick={onClick}
        className={[
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] border text-xs font-semibold transition",
          tier.bg, tier.border, tier.text, tier.glow,
          onClick ? "cursor-pointer hover:opacity-80" : "cursor-default",
        ].join(" ")}
      >
        <span className={`w-2 h-2 rounded-[6px] flex-shrink-0 ${tier.dot}`} />
        {tier.label}
        <span className="opacity-60 font-normal">·</span>
        <span className="opacity-80 font-normal">{sales} sale{sales !== 1 ? "s" : ""}</span>
      </button>
    );
  }

  /* ── Profile badge (name row) ────────────────────────────────────────────── */
  if (size === "badge") {
    return (
      <button
        type={onClick ? "button" : undefined}
        onClick={onClick}
        title={`${tier.label} seller · ${sales} sales${totalRatings > 0 ? ` · ${positiveRate}% positive` : ""}. Click to view reviews.`}
        className={[
          "inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-[6px] border border-transparent outline-none transition-all",
          tier.bg, tier.border, tier.glow,
          onClick ? "cursor-pointer hover:opacity-90 active:scale-95" : "cursor-default",
        ].join(" ")}
      >
        {/* Tier dot */}
        <span className={`w-5 h-5 rounded-[6px] flex items-center justify-center flex-shrink-0 ${tier.dot}`}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
        </span>

        <span className="flex flex-col items-start leading-none gap-0.5">
          <span className={`text-[11px] font-bold tracking-wide ${tier.text}`}>
            {tier.label}
          </span>
          <span className={`text-[9px] font-semibold uppercase tracking-widest ${tier.text} opacity-50`}>
            Seller
          </span>
        </span>
      </button>
    );
  }

  /* ── Full card (used in SellerReviewsDrawer) ──────────────────────────────── */
  return (
    <div className={`rounded-[10px] border p-4 space-y-3 ${tier.bg} ${tier.border} ${tier.glow}`}>
      {/* Tier row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`w-3 h-3 rounded-[6px] flex-shrink-0 ${tier.dot}`} />
          <span className={`text-base font-extrabold tracking-tight ${tier.text}`}>
            {tier.label}
          </span>
        </div>
        <span className={`text-xs font-semibold ${tier.text} opacity-70`}>
          {sales} sale{sales !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Positive rate */}
      {totalRatings > 0 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-vault-textTertiary">
            Positive feedback
          </span>
          <span className={`font-bold ${positiveRate >= 90 ? "text-emerald-500" : positiveRate >= 75 ? "text-amber-500" : "text-red-500"}`}>
            {positiveRate}%
            <span className="font-normal text-vault-textTertiary ml-1">
              ({totalRatings} rating{totalRatings !== 1 ? "s" : ""})
            </span>
          </span>
        </div>
      )}

      {/* Progress to next tier */}
      {nextTier && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-vault-textTertiary">
            <span>Progress to <span className="font-semibold">{nextTier.label}</span></span>
            <span>{sales} / {nextTier.minSales} sales{nextTier.minRate > 0 ? ` · ${nextTier.minRate}% positive needed` : ""}</span>
          </div>
          <div className="h-1.5 rounded-[6px] bg-vault-border dark:bg-vault-border overflow-hidden">
            <div
              className={`h-full rounded-[6px] transition-all ${tier.dot}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Max tier */}
      {!nextTier && (
        <p className={`text-[10px] font-semibold ${tier.text} opacity-70`}>
          ✦ Highest tier achieved
        </p>
      )}
    </div>
  );
}
