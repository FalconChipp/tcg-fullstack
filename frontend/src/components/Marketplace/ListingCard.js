// frontend/src/components/Marketplace/ListingCard.js
// Single listing card for marketplace grid
// - Card listings: portrait ratio, overlaid badges, hover scale
// - Product listings: landscape ratio, title/description layout

"use client";

import React from "react";
import Link from "next/link";
import CardImage from "@/components/Cards/CardImage";

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
  const isTradeOnly = listing.willTrade && (listing.price == null || listing.price === 0);
  const price = Number(listing.price) || 0;
  const currency = listing.currency || "GBP";
  const imageUrl = info.imageSmall || info.imageLarge || null;

  const condCls = COND_CLS[condition] || "bg-gray-500 text-white";

  return (
    <article
      className="
        group relative flex flex-col rounded-[10px] overflow-hidden cursor-pointer
        border border-vault-border
        bg-vault-surface
        transition-colors duration-200 hover:border-vault-borderStrong
      "
      onClick={onClick}
    >
      {/* ── Image (portrait 2:3) */}
      <div className="relative aspect-[5/7] w-full overflow-hidden bg-black">
        <CardImage
          src={imageUrl}
          name={info.name}
          cardId={listing.cardId || info.id}
          className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
          fallbackClassName="text-vault-text"
        />

        {/* Condition badge — top left only */}
        {condition && (
          <span
            className={`absolute top-2 left-2 rounded-[6px] px-2 py-0.5 text-[10px] font-bold tracking-wide ${condCls}`}
          >
            {condition}
          </span>
        )}

        {/* Top-right badges — stacked vertically */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {listing.moderationResult === "approved" && (
            <span className="rounded-[6px] bg-vault-success/90 text-vault-text px-2 py-0.5 text-[10px] font-semibold flex items-center gap-0.5">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              Verified
            </span>
          )}
          {listing.willTrade && (
            <span className="rounded-[6px] bg-vault-accent text-vault-text px-2 py-0.5 text-[10px] font-semibold">
              Will Trade
            </span>
          )}
        </div>
      </div>

      {/* ── Info row */}
      <div className="flex flex-col gap-1 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-vault-text truncate leading-tight">
              {info.name || listing.cardId || "Card"}
            </h3>
            {(info.setName || info.number || (variation && variation !== "Standard")) && (
              <p className="text-[11px] text-vault-textTertiary truncate mt-0.5">
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
          <span className="flex-shrink-0 text-sm font-bold text-vault-text">
            {isTradeOnly
              ? <span className="text-violet-400 font-semibold text-xs">Trade only</span>
              : fmt(price, currency)
            }
          </span>
        </div>

        {/* Seller + view details */}
        <div className="flex items-center justify-between gap-2 mt-0.5">
          {seller.username ? (
            <span className="text-[11px] text-vault-textTertiary truncate">
              {seller.avatar ? (
                <img
                  src={seller.avatar}
                  alt={seller.username}
                  className="inline w-3.5 h-3.5 rounded-[6px] mr-1 align-middle"
                />
              ) : null}
              {seller.username}
            </span>
          ) : (
            <span />
          )}
          <span className="flex-shrink-0 text-[11px] font-semibold text-vault-accent group-hover:underline">
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
        group flex flex-col rounded-[10px] overflow-hidden
        border border-vault-border
        bg-vault-surface
        transition-colors duration-200 hover:border-vault-borderStrong
      "
    >
      <Link href={href} className="flex flex-col h-full">
        {/* Image */}
        <div className="aspect-[4/3] w-full overflow-hidden bg-vault-raised">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={listing.title || "Product"}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-vault-textTertiary">
              No image
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-1.5 px-3 py-3 flex-1">
          <h3 className="text-sm font-semibold text-vault-text line-clamp-2 leading-snug">
            {listing.title || "Product"}
          </h3>
          {listing.description && (
            <p className="text-xs text-vault-textTertiary line-clamp-2">
              {listing.description}
            </p>
          )}
          <div className="mt-auto flex items-center justify-between pt-1">
            <span className="text-sm font-bold text-vault-text">
              {fmt(price, currency)}
            </span>
            <span className="text-[11px] font-semibold text-vault-accent group-hover:underline">
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
