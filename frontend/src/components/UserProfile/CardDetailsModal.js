'use client';

import React from "react";
import Image from "next/image";
import { getCardImageUrl } from "@/utils/imageUtils";
import { formatVariation } from "@/utils/formatVariation";
import { formatCondition, getConditionClass } from "@/utils/formatCondition";
import { formatDate, formatRelativeTime } from "@/utils/formatDate";

// Optional: only used if your project exposes it
let useThemeHook;
try {
  // Avoid hard crash if ThemeProvider path changes
  // eslint-disable-next-line global-require
  useThemeHook = require("@/hooks/ThemeProvider").useTheme;
} catch {}

const FALLBACK_CARD_IMAGE = "/images/card-placeholder.svg";

const GBP_SYMBOL = '\u00A3';

/* ---------- helpers ---------- */
const toNumber = (v) => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
};

const gbp = (v) =>
  v === null || v === undefined ? 'N/A' : `${GBP_SYMBOL}${Number(v).toFixed(2)}`;

const hasValidDate = (d) => {
  if (!d) return false;
  const t = new Date(d);
  return !isNaN(t.getTime());
};

// Prefer first available image and normalize with getCardImageUrl
const pickImage = (card) => {
  const candidates = [
    card?.image,
    card?.modalImage,
    card?.tcgImageUrl,
    card?.tcgImage,
    card?.images?.large,
    card?.images?.small,
    card?.tcgplayer?.images?.large,
    card?.tcgplayer?.images?.small,
    card?.cardmarket?.images?.large,
    card?.cardmarket?.images?.small,
  ].filter(Boolean);

  for (const c of candidates) {
    const src = getCardImageUrl(c);
    if (src) return src;
  }
  return FALLBACK_CARD_IMAGE;
};

// Pick a price row for a given variation; else any row that has a price
const hasPrice = (row) => {
  if (!row) return false;
  return [row.market, row.tcgplayer, row.cardmarket, row.gbp, row.mid, row.low, row.high]
    .some((val) => toNumber(val) != null);
};

const computeAveragePrice = (row) => {
  if (!hasPrice(row)) return null;
  const market = toNumber(row?.market);
  if (market != null) return market;

  const primary = [];
  const tp = toNumber(row?.tcgplayer);
  const cm = toNumber(row?.cardmarket);
  if (tp != null) primary.push(tp);
  if (cm != null) primary.push(cm);
  if (primary.length === 2) return (primary[0] + primary[1]) / 2;
  if (primary.length === 1) return primary[0];

  const fallback = toNumber(row?.gbp) ?? toNumber(row?.mid) ?? toNumber(row?.low) ?? toNumber(row?.high);
  if (fallback != null) return fallback;
  return primary.length ? primary[0] : null;
};

const findPriceRow = (rows, targetVar) => {
  if (!Array.isArray(rows)) return null;
  const exact = rows.find((p) => p?.variation === targetVar && hasPrice(p));
  if (exact) return exact;
  return rows.find((p) => hasPrice(p)) || null;
};

export default function CardDetailsModal({
  card,
  onClose,
  dark,            // optional hint from parent
  onEdit,
  onDelete,
}) {
  if (!card) return null;

  // ----- Dark mode detection -----
  const themeDark = (() => {
    try {
      return useThemeHook ? !!useThemeHook().dark : undefined;
    } catch {
      return undefined;
    }
  })();

  const htmlHasDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  // Final decision: prop > ThemeProvider > <html class="dark">
  const isDark = typeof dark === "boolean" ? dark : (themeDark ?? htmlHasDark);

  /* --------- Image ---------- */
  const [imgSrc, setImgSrc] = React.useState(pickImage(card));
  const [imgLoading, setImgLoading] = React.useState(true);

  /* --------- Prices / variations ---------- */
  const priceRows = React.useMemo(() => {
    const list = Array.isArray(card.prices) ? card.prices.filter(Boolean) : [];
    if (list.length) return list;
    const fallback = [];
    const tcg = toNumber(card.pricing?.tcgplayer?.market);
    const cm = toNumber(card.pricing?.cardmarket?.average_sell);
    const avg = toNumber(card.pricing?.average);
    if (tcg != null || cm != null || avg != null) {
      fallback.push({
        variation: 'normal',
        tcgplayer: tcg,
        cardmarket: cm,
        market: avg,
        updatedAt: card.pricing?.updated_at || card.pricing?.updatedAt || null,
      });
    }
    return fallback;
  }, [card.prices, card.pricing]);

  const variationSet = new Set(priceRows.map((p) => p?.variation).filter(Boolean));
  if (card.variation) variationSet.add(card.variation);
  if (variationSet.size === 0) variationSet.add("normal");
  const variations = Array.from(variationSet);

  const initialVar =
    card.variation && variationSet.has(card.variation)
      ? card.variation
      : variationSet.has("normal")
      ? "normal"
      : variations[0];

  const [selectedVar, setSelectedVar] = React.useState(initialVar);

  const selectedRow = findPriceRow(priceRows, selectedVar);
  const averagePrice = computeAveragePrice(selectedRow);
  const quantity = Number(card.quantity || 1);
  const totalValue = averagePrice == null ? null : averagePrice * quantity;
  const priceUpdated = selectedRow?.updatedAt;

  /* ---------- token classes ---------- */
  const bgPanel = isDark
    ? "bg-dark-surface border border-dark-border"
    : "bg-white border border-light-border";
  const bgHeader = isDark ? "bg-dark-background" : "bg-light-background";
  const border = isDark ? "border-dark-border" : "border-light-border";
  const textMuted = isDark ? "text-dark-textMuted" : "text-light-textMuted";
  const textMain = isDark ? "text-white" : "text-light-primary";
  const chipAlt = isDark
    ? "bg-dark-alt text-dark-textMuted"
    : "bg-light-alt text-light-textMuted";
  const chipRarity = isDark
    ? "bg-dark-primary text-dark-accentLight"
    : "bg-light-accent text-white";
  const chipEdition = isDark
    ? "bg-dark-border text-dark-accentLight"
    : "bg-light-border text-light-accent";
  const cardBg = isDark ? "bg-dark-background" : "bg-light-background";

  return (
    // Put a local `.dark` class so Tailwind dark: variants inside the modal always work
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 ${
        isDark ? "dark" : ""
      }`}
    >
      <div
        className={`w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden ${bgPanel} animate-fade-in`}
      >
        {/* Header */}
        <div className={`flex items-start gap-4 px-6 py-4 border-b ${bgHeader} ${border}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2
                className={`text-xl sm:text-2xl font-extrabold truncate ${textMain}`}
                title={card.name || card.tcgName}
              >
                {card.name || card.tcgName || `Card #${card.id || card.cardId}`}
              </h2>
              {card.number && (
                <span className={`text-2xs px-2 py-1 rounded-full font-semibold ${chipAlt}`}>
                  #{card.number}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {card.setName && <span className={textMuted}>{card.setName}</span>}
              {(card.rarity || card.tcgRarity) && (
                <span className={`px-2 py-0.5 rounded-full font-semibold ${chipRarity}`}>
                  {card.rarity || card.tcgRarity}
                </span>
              )}
              {(card.edition || card.tcgEdition) && (
                <span className={`px-2 py-0.5 rounded-full ${chipEdition}`}>
                  {card.edition || card.tcgEdition}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                  isDark
                    ? "bg-dark-alt hover:bg-dark-border text-white"
                    : "bg-light-alt hover:bg-light-border text-light-text"
                } transition`}
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="rounded-xl px-3 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition"
              >
                Remove
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className={`rounded-full p-2 transition ${
                isDark
                  ? "text-dark-textMuted hover:text-white hover:bg-dark-alt"
                  : "text-light-textMuted hover:text-light-primary hover:bg-light-alt"
              } focus:outline-none focus:ring-2 ${
                isDark ? "focus:ring-dark-accent" : "focus:ring-light-accent"
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" fill="none" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Image */}
          <div className="flex items-start justify-center">
            <div
              className={`relative w-full max-w-sm aspect-[2.5/3.5] rounded-xl overflow-hidden ${cardBg} shadow-lg`}
            >
              {imgLoading && (
                <div
                  className={`absolute inset-0 flex items-center justify-center ${
                    isDark ? "bg-dark-surface" : "bg-light-alt"
                  }`}
                >
                  <div className="w-16 h-24 rounded-lg animate-pulse border border-dashed border-current opacity-40" />
                </div>
              )}
              <Image
                src={imgSrc}
                alt={card.name || card.tcgName || "Card image"}
                fill
                className="object-contain"
                priority
                unoptimized
                onLoadingComplete={() => setImgLoading(false)}
                onError={() => {
                  if (imgSrc !== FALLBACK_CARD_IMAGE) setImgSrc(FALLBACK_CARD_IMAGE);
                  setImgLoading(false);
                }}
              />
            </div>
          </div>

          {/* Right: Details */}
          <div className="flex flex-col gap-5">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <div className={`text-2xs uppercase tracking-wide mb-1 ${textMuted}`}>Quantity</div>
                <div className={`text-xl font-extrabold ${textMain}`}>{quantity}</div>
              </div>

              <div>
                <div className={`text-2xs uppercase tracking-wide mb-1 ${textMuted}`}>Condition</div>
                <div className={`font-semibold ${getConditionClass(card.condition)} ${textMain}`}>
                  {formatCondition(card.condition) || "Unspecified"}
                </div>
              </div>

              {hasValidDate(card.createdAt || card.dateAdded) && (
                <div className="col-span-2 sm:col-span-1">
                  <div className={`text-2xs uppercase tracking-wide mb-1 ${textMuted}`}>Added</div>
                  <div className={textMain} title={formatDate(card.createdAt || card.dateAdded)}>
                    {formatDate(card.createdAt || card.dateAdded)}
                    <span className={`ml-2 text-2xs ${textMuted}`}>
                      {formatRelativeTime(card.createdAt || card.dateAdded)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Variation picker */}
            {variations.length > 1 && (
              <div>
                <div className={`text-2xs uppercase tracking-wide mb-2 ${textMuted}`}>Variation</div>
                <div className="flex flex-wrap gap-2">
                  {variations.map((v) => {
                    const active = v === selectedVar;
                    return (
                      <button
                        key={v}
                        onClick={() => setSelectedVar(v)}
                        className={[
                          "px-3 py-1 rounded-full text-xs font-semibold transition",
                          active
                            ? isDark
                              ? "bg-dark-accent text-black"
                              : "bg-light-accent text-white"
                            : isDark
                            ? "bg-dark-alt text-dark-text hover:bg-dark-border"
                            : "bg-light-alt text-light-text hover:bg-light-border",
                        ].join(" ")}
                      >
                        {formatVariation(v)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={`p-4 rounded-xl border ${cardBg} ${border}`}>
                <div className={`text-2xs uppercase tracking-wide mb-1 ${textMuted}`}>
                  Average Price <span className="opacity-70">({formatVariation(selectedVar)})</span>
                </div>
                <div className="text-lg font-extrabold text-emerald-500">{gbp(averagePrice)}</div>
                {hasValidDate(priceUpdated) && (
                  <div className={`text-2xs mt-1 ${textMuted}`} title={priceUpdated}>
                    Updated {formatRelativeTime(priceUpdated)}
                  </div>
                )}
              </div>

              <div className={`p-4 rounded-xl border ${cardBg} ${border}`}>
                <div className={`text-2xs uppercase tracking-wide mb-1 ${textMuted}`}>Portfolio Value</div>
                <div className={`text-lg font-extrabold ${textMain}`}>{totalValue == null ? 'N/A' : gbp(totalValue)}</div>
                <div className={`text-2xs mt-1 ${textMuted}`}>Quantity {quantity}</div>
              </div>
            </div>

            {/* All variation prices */}

            {variations.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`text-sm font-bold ${textMain}`}>All Variation Prices</h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[420px] w-full text-sm border-collapse">
                    <thead>
                      <tr className={textMuted}>
                        <th className="px-3 py-2 text-left font-semibold">Variation</th>
                        <th className="px-3 py-2 text-left font-semibold">Average Price</th>
                        <th className="px-3 py-2 text-left font-semibold">Last Updated</th>
                      </tr>
                    </thead>                    <tbody>
                      {variations.map((v) => {
                        const row = findPriceRow(priceRows, v);
                        const avg = computeAveragePrice(row);
                        const updated = row?.updatedAt;
                        const active = v === selectedVar;
                        return (
                          <tr
                            key={v}
                            className={active ? (isDark ? "bg-dark-background" : "bg-light-background") : ""}
                          >
                            <td className="px-3 py-2 font-semibold">{formatVariation(v)}</td>
                            <td className="px-3 py-2">{gbp(avg)}</td>
                            <td className="px-3 py-2">{hasValidDate(updated) ? formatRelativeTime(updated) : "--"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes */}
            {card.notes && (
              <div
                className={`rounded-lg p-3 ${
                  isDark
                    ? "bg-dark-surface border border-dark-border text-dark-text"
                    : "bg-light-surface border border-light-border text-light-text"
                }`}
              >
                <div className={`text-2xs uppercase tracking-wide mb-1 font-bold ${textMuted}`}>
                  Notes
                </div>
                <div className="whitespace-pre-line">{card.notes}</div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 flex justify-end border-t ${bgHeader} ${border}`}>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex justify-center rounded-xl px-6 py-2 text-base font-semibold shadow 
              bg-light-primary hover:bg-light-accent dark:bg-dark-primary dark:hover:bg-dark-accent text-white transition
              focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
