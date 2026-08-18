// frontend/src/components/Marketplace/ListingGrid.js
// Listings query + grid (no JSX), styled with site tokens
//
// Changed:
// - Keeps mock/sample data fallback
// - Adds search support
// - Fixes missing sample/live listing render
// - Keeps Load more support
// - Keeps ProductListing image normalisation
// - Searches card name, set, number, rarity, cardId, title, description

"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useQuery } from "@apollo/client";
import { LISTINGS_QUERY } from '@/graphql/marketplace';
import ListingCard from "./ListingCard";
import { devError } from "@/utils/devLog";

/* ----------------- Helpers ----------------- */

// Accepts either an array or a JSON-encoded string and returns a safe array.
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

function normaliseSearch(value) {
  return String(value || "").trim().toLowerCase();
}

function listingMatchesSearch(listing, searchTerm) {
  var q = normaliseSearch(searchTerm);
  if (!q) return true;

  if (!listing) return false;

  var cardInfo = listing.cardInfo || {};

  var searchable = [
    listing.id,
    listing.cardId,
    listing.title,
    listing.description,
    listing.condition,
    listing.variation,
    cardInfo.id,
    cardInfo.name,
    cardInfo.number,
    cardInfo.rarity,
    cardInfo.setName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchable.indexOf(q) !== -1;
}

function normaliseListing(listing) {
  if (!listing) return listing;

  if (listing.__typename === "ProductListing") {
    var images = parseJsonList(listing.imagesJson);
    var primary = listing.imageUrl || images[0] || null;

    return Object.assign({}, listing, {
      imageUrl: primary,
      imagesJson: images,
    });
  }

  return listing;
}

/* ----------------- GraphQL ----------------- */


/* ----------------- Mock data ----------------- */

function mockSeller(username, avatar) {
  return {
    id: "mock-" + username,
    username: username,
    avatar: avatar || null,
  };
}

const MOCK_PRODUCTS = [
  {
    __typename: "ProductListing",
    id: "mock-product-001",
    type: "PRODUCT",
    price: 24.99,
    currency: "GBP",
    quantity: 8,
    allowOffers: false,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: "SixByFive TCG Hoodie",
    description: "Premium heavyweight hoodie — SixByFive logo embroidered on chest.",
    imageUrl: "https://placehold.co/600x800/1a1a2e/e2e8f0?text=Hoodie",
    imagesJson: ["https://placehold.co/600x800/1a1a2e/e2e8f0?text=Hoodie"],
    inventory: { id: "inv-001", onHand: 8, reserved: 1, sold: 12 },
    seller: mockSeller("sixbyfive"),
  },
  {
    __typename: "ProductListing",
    id: "mock-product-002",
    type: "PRODUCT",
    price: 14.99,
    currency: "GBP",
    quantity: 20,
    allowOffers: false,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: "SixByFive TCG T-Shirt",
    description: "Classic unisex tee. Available in S–2XL.",
    imageUrl: "https://placehold.co/600x800/16213e/e2e8f0?text=T-Shirt",
    imagesJson: ["https://placehold.co/600x800/16213e/e2e8f0?text=T-Shirt"],
    inventory: { id: "inv-002", onHand: 20, reserved: 2, sold: 34 },
    seller: mockSeller("sixbyfive"),
  },
  {
    __typename: "ProductListing",
    id: "mock-product-003",
    type: "PRODUCT",
    price: 8.99,
    currency: "GBP",
    quantity: 50,
    allowOffers: false,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: "Deck Box — Brushed Black",
    description: "Sturdy 3D-printed deck box holds a full 100-card EDH/Pokémon deck.",
    imageUrl: "https://placehold.co/600x600/0f3460/e2e8f0?text=Deck+Box",
    imagesJson: ["https://placehold.co/600x600/0f3460/e2e8f0?text=Deck+Box"],
    inventory: { id: "inv-003", onHand: 50, reserved: 5, sold: 89 },
    seller: mockSeller("sixbyfive"),
  },
  {
    __typename: "ProductListing",
    id: "mock-product-004",
    type: "PRODUCT",
    price: 4.99,
    currency: "GBP",
    quantity: 100,
    allowOffers: false,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: "Card Dividers — Pack of 10",
    description: "Laser-cut acrylic dividers — fits standard binder pages perfectly.",
    imageUrl: "https://placehold.co/600x600/533483/e2e8f0?text=Dividers",
    imagesJson: ["https://placehold.co/600x600/533483/e2e8f0?text=Dividers"],
    inventory: { id: "inv-004", onHand: 100, reserved: 3, sold: 210 },
    seller: mockSeller("sixbyfive"),
  },
];

const MOCK_CARD_LISTINGS = [
  {
    __typename: "CardListing",
    id: "mock-card-001",
    type: "CARD",
    price: 89.99,
    currency: "GBP",
    quantity: 1,
    allowOffers: true,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cardId: "base1-4",
    condition: "NM",
    variation: "Holo",
    willTrade: true,
    seller: mockSeller("charizardfan99"),
    cardInfo: {
      id: "base1-4",
      name: "Charizard",
      number: "4",
      rarity: "Holo Rare",
      setName: "Base Set",
      imageSmall: "https://images.pokemontcg.io/base1/4_hires.png",
      imageLarge: "https://images.pokemontcg.io/base1/4_hires.png",
    },
  },
  {
    __typename: "CardListing",
    id: "mock-card-002",
    type: "CARD",
    price: 12.5,
    currency: "GBP",
    quantity: 1,
    allowOffers: false,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cardId: "base1-58",
    condition: "LP",
    variation: "Standard",
    willTrade: false,
    seller: mockSeller("pokecollector_uk"),
    cardInfo: {
      id: "base1-58",
      name: "Pikachu",
      number: "58",
      rarity: "Common",
      setName: "Base Set",
      imageSmall: "https://images.pokemontcg.io/base1/58_hires.png",
      imageLarge: "https://images.pokemontcg.io/base1/58_hires.png",
    },
  },
  {
    __typename: "CardListing",
    id: "mock-card-003",
    type: "CARD",
    price: 34.0,
    currency: "GBP",
    quantity: 1,
    allowOffers: true,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cardId: "sv3pt5-191",
    condition: "NM",
    variation: "Special Illustration Rare",
    willTrade: true,
    seller: mockSeller("rarecardsonly"),
    cardInfo: {
      id: "sv3pt5-191",
      name: "Gardevoir ex",
      number: "191",
      rarity: "Special Illustration Rare",
      setName: "Scarlet & Violet — 151",
      imageSmall: "https://images.pokemontcg.io/sv3pt5/191_hires.png",
      imageLarge: "https://images.pokemontcg.io/sv3pt5/191_hires.png",
    },
  },
  {
    __typename: "CardListing",
    id: "mock-card-004",
    type: "CARD",
    price: 7.99,
    currency: "GBP",
    quantity: 2,
    allowOffers: false,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cardId: "swsh1-25",
    condition: "MP",
    variation: "Reverse Holo",
    willTrade: false,
    seller: mockSeller("tradingpost_tcg"),
    cardInfo: {
      id: "swsh1-25",
      name: "Cinderace",
      number: "25",
      rarity: "Uncommon",
      setName: "Sword & Shield",
      imageSmall: "https://images.pokemontcg.io/swsh1/25_hires.png",
      imageLarge: "https://images.pokemontcg.io/swsh1/25_hires.png",
    },
  },
  {
    __typename: "CardListing",
    id: "mock-card-005",
    type: "CARD",
    price: 149.99,
    currency: "GBP",
    quantity: 1,
    allowOffers: true,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cardId: "base1-2",
    condition: "NM",
    variation: "Holo",
    willTrade: false,
    seller: mockSeller("vintageVault"),
    cardInfo: {
      id: "base1-2",
      name: "Blastoise",
      number: "2",
      rarity: "Holo Rare",
      setName: "Base Set",
      imageSmall: "https://images.pokemontcg.io/base1/2_hires.png",
      imageLarge: "https://images.pokemontcg.io/base1/2_hires.png",
    },
  },
  {
    __typename: "CardListing",
    id: "mock-card-006",
    type: "CARD",
    price: 22.0,
    currency: "GBP",
    quantity: 1,
    allowOffers: false,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cardId: "sv1-198",
    condition: "NM",
    variation: "Full Art",
    willTrade: false,
    seller: mockSeller("scarletvioletguru"),
    cardInfo: {
      id: "sv1-198",
      name: "Miraidon ex",
      number: "198",
      rarity: "Special Illustration Rare",
      setName: "Scarlet & Violet Base Set",
      imageSmall: "https://images.pokemontcg.io/sv1/198_hires.png",
      imageLarge: "https://images.pokemontcg.io/sv1/198_hires.png",
    },
  },
];

/* ----------------- Component ----------------- */

export default function ListingGrid(props) {
  const {
    type,
    status,
    pageSize,
    onListingClick,
    condition,
    variation,
    sort,
    minPrice,
    maxPrice,
    search,
  } = props;

  const limit = pageSize || 24;

  const [page, setPage] = useState(0);
  const offset = page * limit;

  // Reset to page 0 whenever any filter changes
  useEffect(() => {
    setPage(0);
  }, [type, status, condition, variation, sort, minPrice, maxPrice, search]);

  const { data, loading, error } = useQuery(LISTINGS_QUERY, {
    variables: {
      type: type || undefined,
      status: status || "ACTIVE",
      condition: condition || undefined,
      variation: variation || undefined,
      sort: sort || undefined,
      minPrice: minPrice != null ? minPrice : undefined,
      maxPrice: maxPrice != null ? maxPrice : undefined,
      limit: limit,
      offset: offset,
    },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
  });

  const result = useMemo(
    function () {
      const isCardType = (type || "").toUpperCase() === "CARD";
      const mockFallback = isCardType ? MOCK_CARD_LISTINGS : MOCK_PRODUCTS;

      // If the query errored, fall back to sample data.
      if (error) {
        devError("[ListingGrid] GraphQL error:", error);

        return {
          listings: mockFallback
            .map(normaliseListing)
            .filter(function (listing) {
              return listingMatchesSearch(listing, search);
            }),
          isMock: true,
        };
      }

      const raw = (data && data.listings) || [];

      // If there are no live listings, show sample data.
      if (raw.length === 0) {
        return {
          listings: mockFallback
            .map(normaliseListing)
            .filter(function (listing) {
              return listingMatchesSearch(listing, search);
            }),
          isMock: true,
        };
      }

      return {
        listings: raw
          .map(normaliseListing)
          .filter(function (listing) {
            return listingMatchesSearch(listing, search);
          }),
        isMock: false,
      };
    },
    [data, error, search, type]
  );

  const listings = result.listings || [];
  const isMock = result.isMock;
  const hasSearch = !!normaliseSearch(search);

  if (loading && !data && !error) {
    return React.createElement(
      "div",
      {
        className:
          "py-10 text-sm text-center text-vault-textTertiary",
      },
      "Loading marketplace listings…"
    );
  }

  const countLabel = isMock
    ? listings.length === 1
      ? "1 sample listing"
      : listings.length + " sample listings"
    : listings.length === 1
    ? "1 listing"
    : listings.length + " listings";

  return React.createElement(
    "div",
    { className: "space-y-3" },

    /* Header strip */
    React.createElement(
      "div",
      {
        className:
          "flex items-center justify-between gap-3 text-xs text-vault-textTertiary",
      },
      React.createElement("span", null, "Marketplace listings"),
      React.createElement("span", null, countLabel)
    ),

    /* Sample data warning */
    isMock &&
      listings.length > 0 &&
      React.createElement(
        "div",
        {
          className:
            "py-3 text-xs text-center rounded-[10px] border border-dashed " +
            "border-vault-border " +
            "bg-vault-surface/40 dark:bg-vault-surface/40 " +
            "text-vault-textTertiary",
        },
        error
          ? "Live listings unavailable — showing sample data."
          : "No live listings yet — showing sample data."
      ),

    /* Empty search state */
    hasSearch &&
      listings.length === 0 &&
      React.createElement(
        "div",
        {
          className:
            "py-8 text-sm text-center rounded-[10px] border border-dashed " +
            "border-vault-border " +
            "bg-vault-surface/40 dark:bg-vault-surface/40 " +
            "text-vault-textTertiary",
        },
        "No cards found for “",
        search,
        "”."
      ),

    /* Empty live state */
    !hasSearch &&
      listings.length === 0 &&
      React.createElement(
        "div",
        {
          className:
            "py-8 text-sm text-center rounded-[10px] border border-dashed " +
            "border-vault-border " +
            "bg-vault-surface/40 dark:bg-vault-surface/40 " +
            "text-vault-textTertiary",
        },
        "No marketplace listings found."
      ),

    /* Listing grid — this was the missing part */
    listings.length > 0 &&
      React.createElement(
        "div",
        {
          className:
            "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-4",
        },
        listings.map(function (listing) {
          return React.createElement(ListingCard, {
            key: listing.id,
            listing: listing,
            onClick: onListingClick
              ? function () {
                  onListingClick(listing);
                }
              : undefined,
          });
        })
      ),

    /* Pagination controls */
    !isMock &&
      React.createElement(
        "div",
        {
          className:
            "flex items-center justify-between gap-3 pt-5 border-t border-vault-border",
        },
        /* Previous */
        React.createElement(
          "button",
          {
            type: "button",
            disabled: page === 0 || loading,
            onClick: function () { setPage(function (p) { return p - 1; }); },
            className:
              "inline-flex items-center gap-1.5 rounded-[6px] px-4 py-2 text-sm font-medium " +
              "border border-vault-border " +
              "bg-vault-surface " +
              "text-vault-text " +
              "hover:bg-vault-raised dark:hover:bg-vault-raised " +
              "disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
          },
          "← Previous"
        ),
        /* Page indicator */
        React.createElement(
          "span",
          {
            className:
              "text-sm text-vault-textTertiary tabular-nums",
          },
          loading ? "Loading…" : "Page " + (page + 1)
        ),
        /* Next */
        React.createElement(
          "button",
          {
            type: "button",
            disabled: listings.length < limit || loading,
            onClick: function () { setPage(function (p) { return p + 1; }); },
            className:
              "inline-flex items-center gap-1.5 rounded-[6px] px-4 py-2 text-sm font-medium " +
              "border border-vault-border " +
              "bg-vault-surface " +
              "text-vault-text " +
              "hover:bg-vault-raised dark:hover:bg-vault-raised " +
              "disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
          },
          "Next →"
        )
      )
  );
}