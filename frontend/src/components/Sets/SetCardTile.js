"use client";

/**
 * FULL MATCH TO YOUR STYLE TOKENS
 * - Shell: bg-light-surface/dark:bg-dark-surface, border-light-border/dark:border-dark-border,
 *   rounded-2xl, shadow, hover:shadow-2xl (same feel as your search cards).
 * - Image: Next/Image with aspect [245/337], object-contain, alt surface fallback.
 * - Badge: compact accent pill, readable on dark/light.
 * - Text: uses your muted tokens; accent emphasis for the "Market" label/value like your example.
 */

import React from "react";
import Image from "next/image";

function formatPrice(p) {
  if (!p) return null;
  const { gbp, currency } = p;
  if (typeof gbp === "number") {
    const sym = currency || "£";
    return `${sym}${gbp.toFixed(2)}`;
  }
  return null;
}

export default function SetCardTile({ card, owned = false, price }) {
  const hasImg = Boolean(card?.imageUrl);
  const priceStr = formatPrice(price);

  return (
    <div
      className={[
        "bg-light-surface dark:bg-dark-surface",
        "rounded-2xl border border-light-border dark:border-dark-border",
        "shadow hover:shadow-2xl transition",
        "p-3 md:p-3.5",
        owned ? "ring-1 ring-emerald-500/40" : "",
      ].join(" ")}
      role="article"
      aria-label={card?.name || "Card"}
    >
      {/* Image block */}
      <div className="relative w-full aspect-[245/337] bg-light-alt dark:bg-dark-alt rounded-xl overflow-hidden">
        {hasImg ? (
          <Image
            src={card.imageUrl}
            alt={card.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-contain object-center"
            priority={false}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-light-textMuted dark:text-dark-textMuted text-sm">
            No Image
          </div>
        )}

        {owned && (
          <span className="absolute top-2 right-2 rounded-full bg-emerald-600 text-white text-[10px] font-semibold px-2 py-0.5 shadow">
            Owned
          </span>
        )}
      </div>

      {/* Content */}
      <div className="mt-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold truncate">{card.name}</p>
          <span className="text-xs text-light-textMuted dark:text-dark-textMuted whitespace-nowrap">
            #{card.number}
          </span>
        </div>

        <p className="text-xs text-light-textMuted dark:text-dark-textMuted mt-1 truncate">
          {card.rarity || "—"}
        </p>

        {/* {priceStr && (
          <div className="mt-1.5 text-sm">
            <span className="font-bold text-light-accent dark:text-dark-accent">Market</span>
            <span className="font-semibold ml-1 text-light-text dark:text-dark-text">{priceStr}</span>
          </div>
        )} */}
      </div>
    </div>
  );
}
