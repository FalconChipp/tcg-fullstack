// frontend/src/pages/marketplace.js
// Marketplace page (Pages Router) — plain JS, no JSX
// - Layout wrapper
// - SecondaryHeader with cart modal
// - Toggle between Official products / Card listings
// - FiltersBar + ListingGrid
// - CHANGES:
//   - Filters state tracks `status` (GraphQL enum) with default "ACTIVE".
//   - When switching segment (PRODUCT/CARD), filters.type is kept in sync.
//   - ListingGrid gets `type` and `status` from filters with safe fallbacks.
//   - NEW: Card listings button visually disabled + non-interactive.

"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";

import Layout from "@/components/Layout/Layout";
import SecondaryHeader from "@/components/Marketplace/SecondaryHeader";
import FiltersBar from "@/components/Marketplace/FiltersBar";
import ListingGrid from "@/components/Marketplace/ListingGrid";
import CartModal from "@/components/Marketplace/CartModal";

export default dynamic(
  function () {
    return Promise.resolve(function MarketplaceClient() {
      // "PRODUCT" | "CARD"
      var _useStateMode = useState("PRODUCT");
      var activeType = _useStateMode[0];
      var setActiveType = _useStateMode[1];

      // Filters state:
      // - type: "PRODUCT" | "CARD"
      // - status: "active" by default (GraphQL ListingStatus enum)
      // - sort / condition / priceRange / variation: optional, used by FiltersBar
      var _useStateFilters = useState({
        type: "PRODUCT",
        status: "active",
        sort: "",
      });
      var filters = _useStateFilters[0];
      var setFilters = _useStateFilters[1];

      // Cart modal
      var _useStateCart = useState(false);
      var isCartOpen = _useStateCart[0];
      var setIsCartOpen = _useStateCart[1];

      // When the segmented control is clicked
      function handleSegmentClick(nextType) {
        setActiveType(nextType);
        setFilters(function (prev) {
          return {
            // lock filters type to the segment
            type: nextType,
            // keep status if set, otherwise default to active
            status: prev.status || "active",
            sort: prev.sort || "",
            condition: prev.condition || "",
            priceRange: prev.priceRange || "",
            variation: prev.variation || "",
          };
        });
      }

      // When FiltersBar changes filters
      function handleFiltersChange(next) {
        // ensure we always have a type & status
        var nextType = (next && next.type) || activeType || "PRODUCT";
        var nextStatus = (next && next.status) || "active";

        setActiveType(nextType);
        setFilters(
          Object.assign(
            {
              type: nextType,
              status: nextStatus,
            },
            next
          )
        );
      }

      var subtitle =
        activeType === "CARD"
          ? "Browse user-listed Pokémon cards."
          : "Shop official products and SixByFive merch.";

      // Segmented control classes
      var segmentWrapCls =
        "inline-flex rounded-full border border-light-border dark:border-dark-border " +
        "bg-light-surface dark:bg-dark-surface p-1 text-xs sm:text-sm";
      var segBtnBase =
        "px-3 py-1.5 rounded-full font-medium transition-colors " +
        "text-light-text dark:text-dark-text";
      var segBtnActive =
        "bg-light-accent text-white dark:bg-dark-accent dark:text-white shadow-sm";
      var segBtnInactive =
        "bg-transparent hover:bg-light-alt dark:hover:bg-dark-alt";

      // Derive props for ListingGrid from filters with safe defaults
      var gridType = filters.type || activeType || "PRODUCT";
      var gridStatus = filters.status || "active";

      return React.createElement(
        Layout,
        null,
        React.createElement(
          "div",
          { className: "mx-auto max-w-7xl px-4 py-8" },

          // Heading + toggle
          React.createElement(
            "div",
            {
              className:
                "mb-4 flex flex-wrap items-center justify-between gap-3",
            },
            React.createElement(
              "div",
              null,
              React.createElement(
                "h1",
                {
                  className:
                    "text-2xl font-bold text-light-strong dark:text-dark-strong",
                },
                "Marketplace"
              ),
              React.createElement(
                "p",
                { className: "text-sm text-light-muted dark:text-dark-muted" },
                subtitle
              )
            ),
            React.createElement(
              "div",
              {
                className: segmentWrapCls,
                role: "tablist",
                "aria-label": "Marketplace view",
              },
              // Official products — unchanged
              React.createElement(
                "button",
                {
                  type: "button",
                  role: "tab",
                  "aria-selected": activeType === "PRODUCT" ? "true" : "false",
                  className:
                    segBtnBase +
                    " " +
                    (activeType === "PRODUCT" ? segBtnActive : segBtnInactive),
                  onClick: function () {
                    handleSegmentClick("PRODUCT");
                  },
                },
                "Official products"
              ),
              // Card listings — DISABLED
              React.createElement(
                "button",
                {
                  type: "button",
                  role: "tab",
                  // we keep aria-selected false and mark as disabled
                  "aria-selected": "false",
                  "aria-disabled": "true",
                  disabled: true, // 🔒 actually disable the element
                  className:
                    segBtnBase +
                    " " +
                    // use inactive styling + muted/disabled visuals
                    segBtnInactive +
                    " opacity-50 cursor-not-allowed",
                  // NOTE: no onClick, so it can't switch to CARD
                  title: "Card listings coming soon",
                },
                "Card listings"
              )
            )
          ),

          // Secondary header with cart button
          React.createElement(
            "div",
            { className: "mb-6" },
            React.createElement(SecondaryHeader, {
              onCartClick: function () {
                setIsCartOpen(true);
              },
            })
          ),

          // Filters + grid
          React.createElement(FiltersBar, {
            value: filters,
            onChange: function (next) {
              handleFiltersChange(next);
            },
          }),
          React.createElement(ListingGrid, {
            // These are what ListingGrid uses to query the backend:
            type: gridType,
            status: gridStatus,
            pageSize: 24,
          }),

          // Cart modal
          React.createElement(CartModal, {
            isOpen: isCartOpen,
            onClose: function () {
              setIsCartOpen(false);
            },
          })
        )
      );
    });
  },
  { ssr: false }
);
