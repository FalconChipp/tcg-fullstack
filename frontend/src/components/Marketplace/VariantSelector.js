// frontend/src/components/Marketplace/VariantSelector.js
// Variant selector UI (plain JS, no JSX)
// - Accepts { variants, selectedId, onSelect }
// - Each variant: { id, name, imageUrl?, subtitle?, priceDeltaText? }
// - Uses SixByFive tokens (light/dark surfaces, borders, text)
// - Click sets selected; caller owns state.

"use client";

import React from "react";

export default function VariantSelector(props) {
  var variants = (props && props.variants) || [];
  var selectedId = props && props.selectedId;
  var onSelect = (props && props.onSelect) || function () {};

  if (!variants || variants.length === 0) return null;

  var labelCls =
    "text-xs font-semibold uppercase tracking-wide text-vault-textTertiary mb-2";

  var gridCls =
    "grid grid-cols-2 sm:grid-cols-3 gap-3";

  var cardBaseCls =
    "group relative flex flex-col rounded-[10px] border bg-vault-surface " +
    "transition-colors cursor-pointer overflow-hidden";

  var imageWrapperCls = "relative w-full pb-[70%] bg-vault-raised";
  var imageCls = "absolute inset-0 w-full h-full object-cover";

  var nameCls =
    "text-xs sm:text-sm font-medium text-vault-text truncate";

  var subtitleCls =
    "text-[11px] text-vault-textTertiary truncate";

  var chipBaseCls =
    "mt-1 inline-flex items-center rounded-[6px] px-2 py-0.5 text-[10px] font-medium";

  return React.createElement(
    "div",
    null,
    React.createElement("div", { className: labelCls }, "Select an option"),
    React.createElement(
      "div",
      { className: gridCls },
      variants.map(function (v) {
        var isSelected = selectedId === v.id;

        var cardCls =
          cardBaseCls +
          " border-vault-border " +
          (isSelected
            ? " ring-2 ring-vault-accent dark:ring-vault-accent"
            : " hover:bg-vault-raised dark:hover:bg-vault-raised");

        var chipCls =
          chipBaseCls +
          (isSelected
            ? " bg-vault-accent text-white dark:bg-vault-accent dark:text-white"
            : " bg-vault-raised text-vault-textTertiary dark:bg-vault-raised dark:text-vault-textTertiary");

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

          // Image / thumbnail
          React.createElement(
            "div",
            { className: imageWrapperCls },
            v.imageUrl
              ? React.createElement("img", {
                  src: v.imageUrl,
                  alt: v.name || "Variant",
                  className: imageCls,
                })
              : React.createElement(
                  "div",
                  {
                    className:
                      "absolute inset-0 flex items-center justify-center text-[11px] " +
                      "text-vault-textTertiary",
                  },
                  "No image"
                )
          ),

          // Text + chip
          React.createElement(
            "div",
            { className: "px-2.5 py-2 flex flex-col gap-0.5" },
            React.createElement("div", { className: nameCls }, v.name || "Variant"),
            v.subtitle &&
              React.createElement("div", { className: subtitleCls }, v.subtitle),
            React.createElement(
              "div",
              { className: "flex items-center justify-between mt-1" },
              React.createElement(
                "span",
                { className: chipCls },
                isSelected ? "Selected" : "Choose"
              ),
              v.priceDeltaText &&
                React.createElement(
                  "span",
                  {
                    className:
                      "text-[10px] font-medium text-vault-textTertiary",
                  },
                  v.priceDeltaText
                )
            )
          )
        );
      })
    )
  );
}
