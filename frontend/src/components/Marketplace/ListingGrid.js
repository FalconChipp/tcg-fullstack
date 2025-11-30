// frontend/src/components/Marketplace/ListingGrid.js
// Listings query + grid (no JSX), styled with site tokens
// - Purely responsible for fetching and displaying listings
// - "Add to cart" behaviour lives in ListingCard/BuyButton now
//
// CHANGES:
// - Query now fetches ProductListing.imagesJson.
// - Added parseJsonList helper to safely normalise imagesJson.
// - For ProductListing, we derive a primary image:
//     primaryImage = listing.imageUrl || first(imagesJson)
//   and pass that as listing.imageUrl into ListingCard.
// - Slightly nicer wrapper: small header with listing count,
//   improved loading/empty messaging.

"use client";

import React, { useMemo } from "react";
import { useQuery, gql } from "@apollo/client";
import ListingCard from "./ListingCard";

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

/* ----------------- GraphQL ----------------- */

const LISTINGS_QUERY = gql`
  query Listings($type: ListingType, $status: ListingStatus, $limit: Int, $offset: Int) {
    listings(type: $type, status: $status, limit: $limit, offset: $offset) {
      __typename
      id
      type
      price
      currency
      quantity
      allowOffers
      status
      createdAt
      updatedAt

      ... on CardListing {
        cardId
        condition
        variation
        notes
        seller {
          id
          username
        }
      }

      ... on ProductListing {
        title
        description
        imageUrl
        imagesJson        # NEW: used to derive first image for the card
        inventory {
          id
          onHand
          reserved
          sold
        }
        seller {
          id
          username
        }
      }
    }
  }
`;

/* ----------------- Mock product ----------------- */

// Default mock product so you can see a card even if backend 400s / is empty
const MOCK_PRODUCT = {
  __typename: "ProductListing",
  id: "mock-product-001",
  type: "PRODUCT",
  price: 24.99,
  currency: "GBP",
  quantity: 1,
  allowOffers: false,
  status: "active",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),

  title: "SixByFive Sample Hoodie",
  description: "Mock product used to preview the marketplace layout.",
  imageUrl: "https://placehold.co/600x600?text=Sample+Product",
  imagesJson: [
    "https://placehold.co/600x600?text=Sample+Product",
    "https://placehold.co/600x600?text=Back",
  ],
  inventory: {
    id: "mock-inv",
    onHand: 10,
    reserved: 0,
    sold: 2,
  },
  seller: {
    id: "mock-user",
    username: "sixbyfive",
  },
};

/* ----------------- Component ----------------- */

export default function ListingGrid(props) {
  const { type, status, pageSize } = props;

  const { data, loading, error, fetchMore } = useQuery(LISTINGS_QUERY, {
    variables: {
      type: type || undefined,
      status: status || "active",
      limit: pageSize || 24,
      offset: 0,
    },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
  });

  const result = useMemo(
    function () {
      // If the query errored, fall back to a single mock product
      if (error) {
        // eslint-disable-next-line no-console
        console.error("[ListingGrid] GraphQL error:", error);
        return { listings: [MOCK_PRODUCT], isMock: true };
      }

      const raw = (data && data.listings) || [];

      if (raw.length === 0) {
        return { listings: [MOCK_PRODUCT], isMock: true };
      }

      // ENHANCED: normalise product listings so ListingCard
      // always has a sensible imageUrl and imagesJson is an array.
      const enhanced = raw.map(function (l) {
        if (l && l.__typename === "ProductListing") {
          const images = parseJsonList(l.imagesJson);
          const primary = l.imageUrl || (images[0] || null);

          return Object.assign({}, l, {
            imageUrl: primary,
            imagesJson: images,
          });
        }

        return l;
      });

      return { listings: enhanced, isMock: false };
    },
    [data, error]
  );

  const listings = result.listings;
  const isMock = result.isMock;

  // Simple, nicer loading state
  if (loading && !data && !error) {
    return React.createElement(
      "div",
      {
        className:
          "py-10 text-sm text-center text-light-textMuted dark:text-dark-textMuted",
      },
      "Loading marketplace listings…"
    );
  }

  const countLabel = isMock
    ? "Preview listing"
    : listings.length === 1
    ? "1 listing"
    : listings.length + " listings";

  return React.createElement(
    "div",
    { className: "space-y-3" },

    // Small header strip with count
    React.createElement(
      "div",
      {
        className:
          "flex items-center justify-between text-xs text-light-textMuted dark:text-dark-textMuted",
      },
      React.createElement(
        "span",
        null,
        "Marketplace listings"
      ),
      React.createElement(
        "span",
        null,
        countLabel
      )
    ),

    isMock &&
      React.createElement(
        "div",
        {
          className:
            "py-3 text-xs text-center rounded-xl border border-dashed " +
            "border-light-border dark:border-dark-border " +
            "bg-light-surface/40 dark:bg-dark-surface/40 " +
            "text-light-textMuted dark:text-dark-textMuted",
        },
        error
          ? "Showing a mock product because the listings query returned an error."
          : "Showing a mock product because there are no listings yet."
      ),

    React.createElement(
      "div",
      {
        className:
          "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4",
      },
      listings.map(function (l) {
        return React.createElement(ListingCard, {
          key: l.id,
          listing: l,
        });
      })
    ),

    !isMock &&
      listings.length >= (pageSize || 24) &&
      React.createElement(
        "div",
        { className: "flex justify-center pt-4" },
        React.createElement(
          "button",
          {
            className:
              "rounded-lg px-4 py-2 text-sm border border-light-border dark:border-dark-border " +
              "bg-light-surface hover:bg-light-elevated " +
              "dark:bg-dark-surface dark:hover:bg-dark-elevated " +
              "text-light-strong dark:text-dark-strong",
            onClick: function () {
              fetchMore({
                variables: {
                  offset: listings.length,
                  limit: pageSize || 24,
                  type: type || undefined,
                  status: status || "active",
                },
                updateQuery: function (prev, opts) {
                  var next = opts && opts.fetchMoreResult;
                  if (!next) return prev;
                  return Object.assign({}, prev, {
                    listings: prev.listings.concat(next.listings),
                  });
                },
              });
            },
          },
          "Load more"
        )
      )
  );
}
