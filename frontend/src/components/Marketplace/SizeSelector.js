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
    "text-xs font-semibold uppercase tracking-wide text-vault-textTertiary mb-2";

  var rowCls =
    "flex flex-wrap gap-2 overflow-x-auto pb-1";

  var pillBaseCls =
    "inline-flex items-center justify-center rounded-[6px] border px-3 py-1.5 text-xs sm:text-sm " +
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
            ? " border-vault-accent bg-vault-accent text-white " +
              "dark:border-vault-accent dark:bg-vault-accent dark:text-white"
            : " border-vault-border bg-vault-surface text-vault-text " +
              "dark:border-vault-border dark:bg-vault-surface dark:text-vault-text hover:bg-vault-raised dark:hover:bg-vault-raised");

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
