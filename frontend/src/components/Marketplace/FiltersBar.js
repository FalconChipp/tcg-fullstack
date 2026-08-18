// frontend/src/components/Marketplace/FiltersBar.js
// Marketplace search/sort bar — plain JS, no JSX
//
// Changed:
// - Removed Cards / Products toggle
// - Removed condition / price / variation filters
// - Added search by card name
// - Kept sort dropdown
// - Added clear button
// - Keeps same value/onChange API

"use client";

import React from "react";

/* ---------------------------- Icons ---------------------------- */

function SearchIcon(props) {
  return React.createElement(
    "svg",
    {
      width: props.size || 18,
      height: props.size || 18,
      viewBox: "0 0 24 24",
      fill: "none",
      className: props.className || "",
      "aria-hidden": "true",
    },
    React.createElement("path", {
      d: "M10.8 18.1a7.3 7.3 0 1 1 0-14.6 7.3 7.3 0 0 1 0 14.6z",
      stroke: "currentColor",
      strokeWidth: 1.7,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
    React.createElement("path", {
      d: "M16.2 16.2 21 21",
      stroke: "currentColor",
      strokeWidth: 1.7,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    })
  );
}

function ChevronIcon(props) {
  return React.createElement(
    "svg",
    {
      width: props.size || 16,
      height: props.size || 16,
      viewBox: "0 0 24 24",
      fill: "none",
      className: props.className || "",
      "aria-hidden": "true",
    },
    React.createElement("path", {
      d: "M6 9l6 6 6-6",
      stroke: "currentColor",
      strokeWidth: 1.8,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    })
  );
}

/* ---------------------------- Component ---------------------------- */

export default function FiltersBar(props) {
  var value = props.value || {};
  var onChange = props.onChange || function () {};

  var searchValue = value.search || "";
  var sortValue = value.sort || "";

  function updateField(field, newValue) {
    var next = Object.assign({}, value);
    next[field] = newValue;
    onChange(next);
  }

  function clearFilters() {
    var next = Object.assign({}, value);

    // Only clear the fields this component now controls.
    next.search = "";
    next.sort = "";

    // Remove legacy filter values if they are still in parent state.
    next.condition = "";
    next.variation = "";
    next.priceRange = "";

    onChange(next);
  }

  var hasFilters = !!searchValue || !!sortValue;

  return React.createElement(
    "section",
    {
      className:
        "mb-6 w-full rounded-[10px] border p-3 " +
        "border-vault-border " +
        "bg-vault-surface",
      "aria-label": "Marketplace search and sort",
    },

    React.createElement(
      "div",
      {
        className:
          "grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto] md:items-center",
      },

      /* Search input */
      React.createElement(
        "div",
        {
          className: "relative",
        },

        React.createElement(SearchIcon, {
          className:
            "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 " +
            "text-vault-textTertiary",
        }),

        React.createElement("input", {
          type: "search",
          value: searchValue,
          placeholder: "Search by card name, set, number…",
          onChange: function (e) {
            updateField("search", e.target.value || "");
          },
          className:
            "h-11 w-full rounded-[10px] border pl-10 pr-3 text-sm font-medium " +
            "border-vault-border " +
            "bg-vault-raised " +
            "text-vault-text " +
            "placeholder:text-vault-textTertiary dark:placeholder:text-vault-textTertiary " +
            "hover:border-vault-borderStrong " +
            "focus:outline-none focus:ring-2 focus:ring-vault-accent/30 dark:focus:ring-vault-accent/30",
        })
      ),

      /* Sort dropdown */
      React.createElement(
        "div",
        {
          className: "relative",
        },

        React.createElement(
          "select",
          {
            value: sortValue,
            onChange: function (e) {
              updateField("sort", e.target.value || "");
            },
            className:
              "h-11 w-full appearance-none rounded-[10px] border px-3 pr-9 text-sm font-bold " +
              "border-vault-border " +
              "bg-vault-raised " +
              "text-vault-text " +
              "hover:border-vault-borderStrong " +
              "focus:outline-none focus:ring-2 focus:ring-vault-accent/30 dark:focus:ring-vault-accent/30",
          },
          React.createElement("option", { value: "" }, "Newest first"),
          React.createElement("option", { value: "PRICE_ASC" }, "Price: low to high"),
          React.createElement("option", { value: "PRICE_DESC" }, "Price: high to low")
        ),

        React.createElement(ChevronIcon, {
          className:
            "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 " +
            "text-vault-textTertiary",
        })
      ),

      /* Clear button */
      React.createElement(
        "button",
        {
          type: "button",
          disabled: !hasFilters,
          onClick: clearFilters,
          className:
            "h-11 rounded-[10px] border px-4 text-sm font-bold transition " +
            "border-vault-border " +
            "bg-vault-raised " +
            "text-vault-textTertiary " +
            "hover:border-vault-accent hover:text-vault-text " +
            "dark:hover:border-vault-accent dark:hover:text-vault-text " +
            "disabled:cursor-not-allowed disabled:opacity-40",
        },
        "Clear"
      )
    )
  );
}