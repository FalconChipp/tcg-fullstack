// frontend/src/components/Marketplace/SizeSelector.js
// Size selector UI (plain JS, no JSX)
// - options: [{ id, label, subtitle? }]
// - Props: { options, selectedId, onSelect, label }
// - Renders pills / chips, scrollable on small screens.

"use client";

import React from "react";

export default function SizeSelector(props) {
  var options = (props && props.options) || [];
  var selectedId = props && props.selectedId;
  var onSelect = (props && props.onSelect) || function () {};
  var label = (props && props.label) || "Size";

  if (!options || options.length === 0) return null;

  var labelCls =
    "text-xs font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted mb-2";

  var rowCls =
    "flex flex-wrap gap-2 overflow-x-auto pb-1";

  var pillBaseCls =
    "inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs sm:text-sm " +
    "transition-colors whitespace-nowrap";

  return React.createElement(
    "div",
    null,
    React.createElement("div", { className: labelCls }, label),
    React.createElement(
      "div",
      { className: rowCls },
      options.map(function (opt) {
        var isSelected = selectedId === opt.id;
        var pillCls =
          pillBaseCls +
          (isSelected
            ? " border-light-accent bg-light-accent text-white " +
              "dark:border-dark-accent dark:bg-dark-accent dark:text-white"
            : " border-light-border bg-light-surface text-light-text " +
              "dark:border-dark-border dark:bg-dark-surface dark:text-dark-text hover:bg-light-alt dark:hover:bg-dark-alt");

        return React.createElement(
          "button",
          {
            key: opt.id,
            type: "button",
            className: pillCls,
            onClick: function () {
              onSelect(opt);
            },
          },
          React.createElement("span", null, opt.label || opt.id)
        );
      })
    )
  );
}
