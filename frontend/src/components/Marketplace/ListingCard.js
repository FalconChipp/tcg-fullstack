// frontend/src/components/Marketplace/ListingCard.js
// Single listing card for marketplace grid (plain JS, no JSX)
// - Works for both CardListing and ProductListing
// - Builds a human-readable slug / uses backend slug for the detail URL
// - Safely parses imagesJson when it is a JSON string
//
// CHANGES (this version):
// - Removed inline BuyButton (no add-to-cart from grid).
// - Replaced with a simple "View details" visual CTA that just navigates
//   to the listing page via the existing Link wrapper.

"use client";

import React from "react";
import Link from "next/link";
// REMOVED: inline add-to-cart button
// import BuyButton from "./BuyButton";

// Helper: parse JSON string or array into array
function parseJsonList(maybeJson) {
  if (!maybeJson) return [];
  if (Array.isArray(maybeJson)) return maybeJson;
  if (typeof maybeJson === "string") {
    try {
      var parsed = JSON.parse(maybeJson);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch (_e) {
      return [];
    }
  }
  return [];
}

/**
 * Build a base slug from listing.title, e.g. "Test product" -> "test-product".
 */
function makeListingSlugFromTitle(listing) {
  var base =
    listing &&
    typeof listing.title === "string" &&
    listing.title.trim().length > 0
      ? listing.title.trim()
      : String(listing.id || "");

  var slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics -> "-"
    .replace(/^-+|-+$/g, ""); // trim leading/trailing "-"

  return slug || String(listing.id || "");
}

/**
 * Prefer the backend-provided slug field, with a safe fallback.
 */
function getListingSlug(listing) {
  if (
    listing &&
    typeof listing.slug === "string" &&
    listing.slug.trim().length > 0
  ) {
    return listing.slug.trim();
  }
  return makeListingSlugFromTitle(listing);
}

export default function ListingCard(props) {
  var listing = props.listing;

  if (!listing) return null;

  var isProduct = listing.__typename === "ProductListing";

  var title;
  var subtitle = "";

  if (isProduct) {
    title =
      listing.title && listing.title.trim().length > 0
        ? listing.title.trim()
        : String(listing.id || "Product");
    subtitle = listing.description || "";
  } else {
    // Card listing – simple label based on cardId / variation / condition
    var parts = [];
    if (listing.cardId) parts.push(listing.cardId);
    if (listing.variation) parts.push(listing.variation);
    title = parts.length ? parts.join(" • ") : "Card listing";
    if (listing.condition) subtitle = listing.condition;
  }

  // Parse images
  var images = parseJsonList(listing.imagesJson);
  var imageUrl = null;
  if (images && images.length > 0) {
    imageUrl = images[0];
  } else if (listing.imageUrl) {
    imageUrl = listing.imageUrl;
  }

  // HUMAN-READABLE URL
  var slug = getListingSlug(listing);
  var href = slug
    ? "/marketplace/" + slug
    : "/marketplace/" + String(listing.id || "");

  var priceText = "";
  try {
    var currency = listing.currency || "GBP";
    priceText = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency,
    }).format(Number(listing.price) || 0);
  } catch (_e) {
    priceText = (listing.currency || "GBP") + " " + listing.price;
  }

  var badgeText = isProduct ? "Product" : "Card";

  var outerCls =
    "relative flex flex-col rounded-2xl border border-light-border " +
    "dark:border-dark-border bg-light-surface dark:bg-dark-surface overflow-hidden " +
    "shadow-sm hover:shadow-md transition-shadow";

  var imgWrapperCls =
    "aspect-[4/3] w-full overflow-hidden bg-light-muted dark:bg-dark-muted " +
    "flex items-center justify-center";

  var imgCls = "h-full w-full object-contain";

  var bodyCls = "flex flex-col flex-1 p-3 gap-2";

  var titleCls =
    "text-sm font-semibold text-light-textPrimary dark:text-dark-textPrimary line-clamp-2";

  var subtitleCls =
    "text-xs text-light-textMuted dark:text-dark-textMuted line-clamp-2";

  var footerCls = "mt-auto flex items-center justify-between gap-2 pt-1";

  var priceCls =
    "text-sm font-semibold text-light-textPrimary dark:text-dark-textPrimary";

  var badgeCls =
    "inline-flex items-center rounded-full bg-light-muted dark:bg-dark-muted " +
    "px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
    "text-light-textMuted dark:text-dark-textMuted";

  // NEW: simple view-only CTA, no add-to-cart behaviour
  var viewBtnCls =
    "inline-flex items-center justify-center rounded-lg px-3 py-1.5 " +
    "text-[11px] font-semibold text-white bg-light-accent hover:bg-light-accentLight " +
    "dark:bg-dark-accent dark:hover:bg-dark-accentLight " +
    "transition-colors";

  return React.createElement(
    "article",
    { className: outerCls },
    React.createElement(
      Link,
      { href: href, className: "flex flex-col h-full" },
      // Image
      React.createElement(
        "div",
        { className: imgWrapperCls },
        imageUrl
          ? React.createElement("img", {
              src: imageUrl,
              alt: title || "Listing image",
              className: imgCls,
            })
          : React.createElement(
              "div",
              {
                className:
                  "text-xs text-light-textMuted dark:text-dark-textMuted",
              },
              "No image"
            )
      ),
      // Body
      React.createElement(
        "div",
        { className: bodyCls },
        // Title + subtitle
        React.createElement(
          "div",
          null,
          React.createElement("h3", { className: titleCls }, title),
          subtitle
            ? React.createElement(
                "p",
                { className: subtitleCls },
                subtitle
              )
            : null
        ),
        // Footer: price + badge
        React.createElement(
          "div",
          { className: footerCls },
          React.createElement("span", { className: priceCls }, priceText),
          badgeText
            ? React.createElement("span", { className: badgeCls }, badgeText)
            : null
        ),
        // VIEW-ONLY BUTTON (no add-to-cart, just a visual CTA)
        React.createElement(
          "div",
          { className: "mt-2" },
          React.createElement("span", { className: viewBtnCls }, "View details")
        )
      )
    )
  );
}
