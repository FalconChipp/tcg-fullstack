// frontend/src/components/Marketplace/ColorSelector.js
// Colour selector UI (plain JS, no JSX)
// - options: [{ id, name, imageUrl?, subtitle? }]
// - Props: { options, selectedId, onSelect, label, maxVisible }
// - Collapsible when there are more than maxVisible options
// - More compact card layout, no price additions

"use client";

import React, { useState, useMemo } from "react";

export default function ColorSelector(props) {
  var options = (props && props.options) || [];
  var selectedId = props && props.selectedId;
  var onSelect = (props && props.onSelect) || function () {};
  var label = (props && props.label) || "Colour";
  var maxVisible = typeof props.maxVisible === "number" ? props.maxVisible : 4;

  var _useState = useState(false);
  var expanded = _useState[0];
  var setExpanded = _useState[1];

  if (!options || options.length === 0) return null;

  var showCollapseToggle = options.length > maxVisible;

  var visibleOptions = useMemo(
    function () {
      if (!showCollapseToggle) return options;
      return expanded ? options : options.slice(0, maxVisible);
    },
    [options, showCollapseToggle, expanded, maxVisible]
  );

  var labelCls =
    "text-xs font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted mb-1";

  // Slightly tighter grid spacing
  var gridCls = "grid grid-cols-3 sm:grid-cols-4 gap-2";

  // Smaller, tighter cards
  var cardBaseCls =
    "group relative flex flex-col rounded-lg border bg-light-surface dark:bg-dark-surface " +
    "transition-colors cursor-pointer overflow-hidden";

  // Smaller image area
  var imageWrapperCls = "relative w-full pb-[60%] bg-light-alt dark:bg-dark-alt";
  var imageCls = "absolute inset-0 w-full h-full object-cover";

  // Smaller text
  var nameCls =
    "text-[11px] font-medium text-light-strong dark:text-dark-strong truncate";

  var subtitleCls =
    "text-[10px] text-light-textMuted dark:text-dark-textMuted truncate";

  // Smaller "Selected / Choose" chip
  var chipBaseCls =
    "mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium";

  var toggleCls =
    "mt-1 text-[11px] font-medium text-light-accent dark:text-dark-accent " +
    "hover:text-light-accentLight dark:hover:text-dark-accentLight cursor-pointer";

  // --- NEW: map simple colour names -> hex swatch colours (frontend only) ---
  var SWATCH_MAP = {
    black: "#000000",
    white: "#ffffff",
    grey: "#9ca3af",
    gray: "#9ca3af",
    silver: "#e5e7eb",
    navy: "#1e3a8a",
    blue: "#3b82f6",
    royal: "#2563eb",
    green: "#22c55e",
    lime: "#84cc16",
    red: "#ef4444",
    burgundy: "#7f1d1d",
    maroon: "#7f1d1d",
    orange: "#f97316",
    yellow: "#eab308",
    gold: "#facc15",
    purple: "#a855f7",
    violet: "#8b5cf6",
    pink: "#ec4899",
    brown: "#92400e",
    sand: "#e5ddc5",
    cream: "#fef3c7",
  };

  function getSwatchColorFromName(name) {
    if (!name) return null;
    var key = String(name).toLowerCase().trim();
    // Simple direct match (e.g. "black", "dark navy" -> tries "dark navy" then "navy")
    if (SWATCH_MAP[key]) return SWATCH_MAP[key];

    // Try to match last word (e.g. "dark green" -> "green")
    var parts = key.split(/\s+/);
    if (parts.length > 1) {
      var last = parts[parts.length - 1];
      if (SWATCH_MAP[last]) return SWATCH_MAP[last];
    }

    // Fallback: no swatch colour
    return null;
  }

  return React.createElement(
    "div",
    null,
    React.createElement("div", { className: labelCls }, label),
    React.createElement(
      "div",
      { className: gridCls },
      visibleOptions.map(function (v) {
        var isSelected = selectedId === v.id;

        var cardCls =
          cardBaseCls +
          " border-light-border dark:border-dark-border " +
          (isSelected
            ? " ring-1 ring-light-accent dark:ring-dark-accent"
            : " hover:bg-light-elevated dark:hover:bg-dark-elevated");

        var chipCls =
          chipBaseCls +
          (isSelected
            ? " bg-light-accent text-white dark:bg-dark-accent dark:text-white"
            : " bg-light-alt text-light-textMuted dark:bg-dark-alt dark:text-dark-textMuted");

        // NEW: derive a swatch colour if there is no imageUrl
        var swatchColor = !v.imageUrl ? getSwatchColorFromName(v.name) : null;

        return React.createElement(
          "button",
          {
            key: v.id,
            type: "button",
            className: cardCls,
            onClick: function () {
              onSelect(v);
            },
          },

          // Image / swatch
          React.createElement(
            "div",
            { className: imageWrapperCls },
            v.imageUrl
              ? React.createElement("img", {
                  src: v.imageUrl,
                  alt: v.name || "Colour",
                  className: imageCls,
                })
              : swatchColor
              ? // NEW: solid colour swatch based on the colour name
                React.createElement("div", {
                  className: "absolute inset-0",
                  style: { backgroundColor: swatchColor },
                })
              : // Fallback text if we really have nothing
                React.createElement(
                  "div",
                  {
                    className:
                      "absolute inset-0 flex items-center justify-center text-[10px] " +
                      "text-light-textMuted dark:text-dark-textMuted",
                  },
                  "No image"
                )
          ),

          // Text + chip
          React.createElement(
            "div",
            { className: "px-2 py-1.5 flex flex-col gap-0.5" },
            React.createElement("div", { className: nameCls }, v.name || "Colour"),
            v.subtitle &&
              React.createElement("div", { className: subtitleCls }, v.subtitle),
            React.createElement(
              "div",
              { className: "flex items-center justify-between mt-0.5" },
              React.createElement(
                "span",
                { className: chipCls },
                isSelected ? "Selected" : "Choose"
              )
            )
          )
        );
      })
    ),
    showCollapseToggle &&
      React.createElement(
        "button",
        {
          type: "button",
          className: toggleCls,
          onClick: function () {
            setExpanded(function (prev) {
              return !prev;
            });
          },
        },
        expanded
          ? "Show fewer colours"
          : "Show all " + String(options.length) + " colours"
      )
  );
}
