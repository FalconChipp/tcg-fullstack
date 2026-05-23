// frontend/src/components/Marketplace/ListingCard.js
// Single listing card for marketplace grid
// - Card listings: portrait ratio, overlaid badges, hover scale
// - Product listings: landscape ratio, title/description layout

"use client";

import React from "react";
import Link from "next/link";

function parseJsonList(maybeJson) {
  if (!maybeJson) return [];
  if (Array.isArray(maybeJson)) return maybeJson;
  if (typeof maybeJson === "string") {
    try {
      const parsed = JSON.parse(maybeJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function fmt(amount, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
      Number(amount) || 0
    );
  } catch {
    return `£${Number(amount || 0).toFixed(2)}`;
  }
}

// ── Condition badge colours
const COND_CLS = {
  NM: "bg-emerald-500 text-white",
  LP: "bg-yellow-400 text-gray-900",
  MP: "bg-orange-500 text-white",
  PL: "bg-red-500 text-white",
};

// ── Card listing card (portrait, Pokémon-card style)
function CardListingCard({ listing, onClick }) {
  const info = listing.cardInfo || {};
  const condition = listing.condition || "";
  const variation = listing.variation || "";
  const seller = listing.seller || {};
  const price = Number(listing.price) || 0;
  const currency = listing.currency || "GBP";
  const imageUrl = info.imageSmall || info.imageLarge || null;

  const condCls = COND_CLS[condition] || "bg-gray-500 text-white";

  return (
    <article
      className="
        group relative flex flex-col rounded-2xl overflow-hidden cursor-pointer
        border border-light-border dark:border-dark-border
        bg-light-surface dark:bg-dark-surface
        shadow-sm hover:shadow-xl
        transition-all duration-200 hover:-translate-y-1
      "
      onClick={onClick}
    >
      {/* ── Image (portrait 2:3) */}
      <div className="relative aspect-[5/7] w-full overflow-hidden bg-black">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={info.name || "Card"}
            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-light-muted dark:text-dark-muted">
            No image
          </div>
        )}

        {/* Condition badge — top left only */}
        {condition && (
          <span
            className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide shadow ${condCls}`}
          >
            {condition}
          </span>
        )}

        {/* Top-right badges — stacked vertically */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {listing.moderationResult === "approved" && (
            <span className="rounded-full bg-emerald-600/90 text-white px-2 py-0.5 text-[10px] font-semibold shadow flex items-center gap-0.5">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              Verified
            </span>
          )}
          {listing.willTrade && (
            <span className="rounded-full bg-violet-600 text-white px-2 py-0.5 text-[10px] font-semibold shadow">
              Will Trade
            </span>
          )}
        </div>
      </div>

      {/* ── Info row */}
      <div className="flex flex-col gap-1 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-light-strong dark:text-dark-strong truncate leading-tight">
              {info.name || listing.cardId || "Card"}
            </h3>
            {(info.setName || info.number || (variation && variation !== "Standard")) && (
              <p className="text-[11px] text-light-muted dark:text-dark-muted truncate mt-0.5">
                {[
                  info.setName,
                  info.number ? `#${info.number}` : null,
                  variation && variation !== "Standard" ? variation : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          <span className="flex-shrink-0 text-sm font-bold text-light-strong dark:text-dark-strong">
            {fmt(price, currency)}
          </span>
        </div>

        {/* Seller + view details */}
        <div className="flex items-center justify-between gap-2 mt-0.5">
          {seller.username ? (
            <span className="text-[11px] text-light-muted dark:text-dark-muted truncate">
              {seller.avatar ? (
                <img
                  src={seller.avatar}
                  alt={seller.username}
                  className="inline w-3.5 h-3.5 rounded-full mr-1 align-middle"
                />
              ) : null}
              {seller.username}
            </span>
          ) : (
            <span />
          )}
          <span className="flex-shrink-0 text-[11px] font-semibold text-light-accent dark:text-dark-accent group-hover:underline">
            View details →
          </span>
        </div>
      </div>
    </article>
  );
}

// ── Product listing card (landscape, shop-style)
function ProductListingCard({ listing }) {
  const images = parseJsonList(listing.imagesJson);
  const imageUrl = listing.imageUrl || images[0] || null;
  const price = Number(listing.price) || 0;
  const currency = listing.currency || "GBP";

  const slug =
    listing.slug?.trim() ||
    (listing.title || String(listing.id))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/, "") ||
    String(listing.id);

  const href = `/marketplace/${slug}`;

  return (
    <article
      className="
        group flex flex-col rounded-2xl overflow-hidden
        border border-light-border dark:border-dark-border
        bg-light-surface dark:bg-dark-surface
        shadow-sm hover:shadow-lg
        transition-all duration-200 hover:-translate-y-0.5
      "
    >
      <Link href={href} className="flex flex-col h-full">
        {/* Image */}
        <div className="aspect-[4/3] w-full overflow-hidden bg-light-alt dark:bg-dark-alt">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={listing.title || "Product"}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-light-muted dark:text-dark-muted">
              No image
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-1.5 px-3 py-3 flex-1">
          <h3 className="text-sm font-semibold text-light-strong dark:text-dark-strong line-clamp-2 leading-snug">
            {listing.title || "Product"}
          </h3>
          {listing.description && (
            <p className="text-xs text-light-muted dark:text-dark-muted line-clamp-2">
              {listing.description}
            </p>
          )}
          <div className="mt-auto flex items-center justify-between pt-1">
            <span className="text-sm font-bold text-light-strong dark:text-dark-strong">
              {fmt(price, currency)}
            </span>
            <span className="text-[11px] font-semibold text-light-accent dark:text-dark-accent group-hover:underline">
              View →
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

// ── Main export
export default function ListingCard({ listing, onClick }) {
  if (!listing) return null;

  if (listing.__typename === "CardListing") {
    return <CardListingCard listing={listing} onClick={onClick} />;
  }

  return <ProductListingCard listing={listing} />;
}
