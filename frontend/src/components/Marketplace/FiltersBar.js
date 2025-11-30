// frontend/src/components/Marketplace/FiltersBar.js
// Redesigned filter bar with conditional chip filters (shown only for CARD type)
// - Plain JS, no JSX
// - Matches SixByFive TCG styling

"use client";

import React from "react";

export default function FiltersBar(props) {
  var value = props.value || {};
  var onChange = props.onChange || function () {};

  function updateField(field, newValue) {
    var next = Object.assign({}, value);
    next[field] = newValue;
    onChange(next);
  }

  function onType(e) {
    updateField("type", e.target.value || "");
  }

  function onSort(e) {
    updateField("sort", e.target.value || "");
  }

  // Chip toggler
  function onChip(field, chipValue) {
    var current = value[field] || "";
    var next = current === chipValue ? "" : chipValue;
    updateField(field, next);
  }

  var activeType = value.type || "";            // "" | "PRODUCT" | "CARD"
  var showCardFilters = activeType === "CARD";  // Only show extra filters for card listings

  // Shell container
  var shellCls =
    "w-full rounded-xl border border-light-border dark:border-dark-border " +
    "bg-light-surface dark:bg-dark-surface px-4 py-3 mb-6 shadow-sm";

  // Labels
  var labelCls =
    "text-xs font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted";

  // Select styling
  var selectCls =
    "rounded-lg px-3 py-2 text-sm font-medium " +
    "border border-light-border dark:border-dark-border " +
    "bg-light-alt dark:bg-dark-alt " +
    "text-light-text dark:text-dark-text " +
    "hover:border-light-accent dark:hover:border-dark-accent " +
    "focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent " +
    "focus:ring-offset-2 focus:ring-offset-light-surface dark:focus:ring-offset-dark-surface";

  // Chip styles
  var chipBase =
    "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium border select-none cursor-pointer transition";

  function chipClass(isActive) {
    if (isActive) {
      return (
        chipBase +
        " bg-light-accent text-white border-light-accent " +
        "dark:bg-dark-accent dark:border-dark-accent shadow-sm"
      );
    }
    return (
      chipBase +
      " bg-light-alt dark:bg-dark-alt " +
      "text-light-text dark:text-dark-text " +
      "border-light-border dark:border-dark-border " +
      "hover:border-light-accent dark:hover:border-dark-accent"
    );
  }

  return React.createElement(
    "div",
    { className: shellCls },

    /* ---------------------------
       TYPE + SORT ROW
    --------------------------- */
    React.createElement(
      "div",
      { className: "flex flex-wrap items-center justify-between gap-4 mb-3" },

      // TYPE SELECT
      React.createElement(
        "div",
        { className: "flex items-center gap-3" },
        React.createElement("span", { className: labelCls }, "Type"),
        React.createElement(
          "select",
          {
            className: selectCls,
            value: activeType,
            onChange: onType
          },
          React.createElement("option", { value: "" }, "All"),
          React.createElement("option", { value: "PRODUCT" }, "Products"),
          // React.createElement("option", { value: "CARD" }, "Cards")
        )
      ),

      // SORT SELECT
      React.createElement(
        "div",
        { className: "flex items-center gap-3" },
        React.createElement("span", { className: labelCls }, "Sort"),
        React.createElement(
          "select",
          {
            className: selectCls,
            value: value.sort || "",
            onChange: onSort
          },
          React.createElement("option", { value: "" }, "Newest"),
          React.createElement("option", { value: "PRICE_ASC" }, "Price ↑"),
          React.createElement("option", { value: "PRICE_DESC" }, "Price ↓")
        )
      )
    ),

    /* ---------------------------
       CARD-ONLY CHIP FILTERS
    --------------------------- */
    showCardFilters
      ? React.createElement(
          "div",
          { className: "flex flex-wrap gap-6" },

          /* CONDITION */
          React.createElement(
            "div",
            { className: "flex flex-col gap-1" },
            React.createElement("span", { className: labelCls }, "Condition"),
            React.createElement(
              "div",
              { className: "flex flex-wrap gap-2" },
              React.createElement(
                "button",
                {
                  className: chipClass((value.condition || "") === ""),
                  onClick: function () { onChip("condition", ""); }
                },
                "Any"
              ),
              React.createElement(
                "button",
                {
                  className: chipClass(value.condition === "NM"),
                  onClick: function () { onChip("condition", "NM"); }
                },
                "NM"
              ),
              React.createElement(
                "button",
                {
                  className: chipClass(value.condition === "LP"),
                  onClick: function () { onChip("condition", "LP"); }
                },
                "LP"
              ),
              React.createElement(
                "button",
                {
                  className: chipClass(value.condition === "MP"),
                  onClick: function () { onChip("condition", "MP"); }
                },
                "MP"
              )
            )
          ),

          /* PRICE */
          React.createElement(
            "div",
            { className: "flex flex-col gap-1" },
            React.createElement("span", { className: labelCls }, "Price"),
            React.createElement(
              "div",
              { className: "flex flex-wrap gap-2" },
              React.createElement(
                "button",
                {
                  className: chipClass((value.priceRange || "") === ""),
                  onClick: function () { onChip("priceRange", ""); }
                },
                "Any"
              ),
              React.createElement(
                "button",
                {
                  className: chipClass(value.priceRange === "UNDER_10"),
                  onClick: function () { onChip("priceRange", "UNDER_10"); }
                },
                "< £10"
              ),
              React.createElement(
                "button",
                {
                  className: chipClass(value.priceRange === "10_TO_50"),
                  onClick: function () { onChip("priceRange", "10_TO_50"); }
                },
                "£10–£50"
              ),
              React.createElement(
                "button",
                {
                  className: chipClass(value.priceRange === "50_PLUS"),
                  onClick: function () { onChip("priceRange", "50_PLUS"); }
                },
                "£50+"
              )
            )
          ),

          /* VARIATION */
          React.createElement(
            "div",
            { className: "flex flex-col gap-1" },
            React.createElement("span", { className: labelCls }, "Variation"),
            React.createElement(
              "div",
              { className: "flex flex-wrap gap-2" },
              React.createElement(
                "button",
                {
                  className: chipClass((value.variation || "") === ""),
                  onClick: function () { onChip("variation", ""); }
                },
                "Any"
              ),
              React.createElement(
                "button",
                {
                  className: chipClass(value.variation === "STANDARD"),
                  onClick: function () { onChip("variation", "STANDARD"); }
                },
                "Standard"
              ),
              React.createElement(
                "button",
                {
                  className: chipClass(value.variation === "REVERSE"),
                  onClick: function () { onChip("variation", "REVERSE"); }
                },
                "Reverse"
              ),
              React.createElement(
                "button",
                {
                  className: chipClass(value.variation === "FULL_ART"),
                  onClick: function () { onChip("variation", "FULL_ART"); }
                },
                "Full Art"
              )
            )
          )
        )
      : null
  );
}
