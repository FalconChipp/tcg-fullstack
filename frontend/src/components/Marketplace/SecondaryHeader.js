// frontend/src/components/Marketplace/SecondaryHeader.js
// Marketplace secondary header — plain JS (no JSX)
// - Uses site tokens
// - Reads localStorage("sbf_cart")
// - If props.onCartClick is provided, uses it for the cart pill + main "Cart & checkout" button

"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/* ---------------------------- Utilities ---------------------------- */

function readCartSnapshot() {
  try {
    var raw = localStorage.getItem("sbf_cart");
    if (!raw) return { items: [], count: 0, subtotal: 0 };
    var arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return { items: [], count: 0, subtotal: 0 };

    var count = 0;
    var subtotal = 0;
    for (var i = 0; i < arr.length; i++) {
      var it = arr[i] || {};
      var q = Number(it.qty) || 0;
      var p = Number(it.price) || 0;
      count += q;
      subtotal += q * p;
    }
    return { items: arr, count: count, subtotal: Number(subtotal.toFixed(2)) };
  } catch (_e) {
    return { items: [], count: 0, subtotal: 0 };
  }
}

/** Minimal cart icon */
function CartIcon(props) {
  return React.createElement(
    "svg",
    {
      width: 18,
      height: 18,
      viewBox: "0 0 24 24",
      fill: "none",
      className: props.className || "",
      "aria-hidden": "true",
    },
    React.createElement("path", {
      d: "M6 6h15l-1.5 8.5a2 2 0 0 1-2 1.5H9.5a2 2 0 0 1-2-1.5L5 3H2",
      stroke: "currentColor",
      strokeWidth: 1.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
    React.createElement("circle", { cx: 9.5, cy: 20, r: 1.4, fill: "currentColor" }),
    React.createElement("circle", { cx: 17.5, cy: 20, r: 1.4, fill: "currentColor" })
  );
}

/* ---------------------------- Component ---------------------------- */

export default function SecondaryHeader(props) {
  var currency = (props && props.currency) || "GBP";
  var symbol = String(currency).toUpperCase() === "GBP" ? "£" : "";
  var onCartClick = (props && props.onCartClick) || null;

  var _useState = useState(readCartSnapshot);
  var snap = _useState[0];
  var setSnap = _useState[1];

  var refresh = useCallback(function () {
    setSnap(readCartSnapshot());
  }, []);

  useEffect(
    function () {
      function onFocus() {
        refresh();
      }
      function onStorage(e) {
        if (e && e.key === "sbf_cart") refresh();
      }
      window.addEventListener("focus", onFocus);
      window.addEventListener("storage", onStorage);
      return function cleanup() {
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("storage", onStorage);
      };
    },
    [refresh]
  );

  // Shell
  var shellCls =
    "w-full rounded-xl border transition-colors " +
    "border-light-border dark:border-dark-border " +
    "bg-light-surface dark:bg-dark-surface px-3 py-2 shadow-sm";

  var leftWrapCls = "flex items-center gap-3";
  var labelCls =
    "text-xs font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted";
  var dotCls = "hidden sm:inline text-light-textMuted dark:text-dark-textMuted";
  var sublabelCls =
    "hidden sm:inline text-xs text-light-textMuted dark:text-dark-textMuted";

  var pillCls =
    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 " +
    "border-light-border dark:border-dark-border " +
    "bg-light-alt dark:bg-dark-alt transition";

  var pillIconCls = "text-light-text dark:text-dark-text";
  var pillCountCls =
    "text-sm font-medium text-light-text dark:text-dark-text";
  var pillSepCls =
    "text-xs text-light-textMuted dark:text-dark-textMuted";

  // Single primary action button (Cart + checkout)
  var btnPrimaryCls =
    "px-3 py-1.5 rounded-lg text-sm font-medium transition " +
    "bg-light-accent hover:bg-light-accentLight !text-white " +
    "dark:bg-dark-accent dark:hover:bg-dark-accentLight dark:text-white";

  // Decide element type for main action (combined View cart + Checkout)
  // - If onCartClick is provided -> button that opens the modal
  // - Otherwise -> Link to /checkout as a fallback
  var ActionComponent = onCartClick ? "button" : Link;
  var actionProps = onCartClick
    ? {
        type: "button",
        onClick: onCartClick,
      }
    : {
        href: "/checkout",
      };

  // Same for pill: clickable if handler provided
  var PillComponent = onCartClick ? "button" : "div";
  var pillProps = onCartClick
    ? {
        type: "button",
        onClick: onCartClick,
        "aria-label": "Open cart",
      }
    : {};

  return React.createElement(
    "div",
    { className: shellCls },
    React.createElement(
      "div",
      { className: "flex flex-wrap items-center justify-between gap-3" },

      // LEFT: label
      React.createElement(
        "div",
        { className: leftWrapCls },
        React.createElement("span", { className: labelCls }, "Marketplace"),
        React.createElement("span", { className: dotCls }, "•"),
        React.createElement(
          "span",
          { className: sublabelCls },
          "Secure checkout via Stripe"
        )
      ),

      // RIGHT: cart pill + combined action
      React.createElement(
        "div",
        { className: "flex items-center gap-2" },

        // Cart pill
        React.createElement(
          PillComponent,
          Object.assign(
            {
              className: pillCls,
            },
            pillProps
          ),
          React.createElement(CartIcon, { className: pillIconCls }),
          React.createElement(
            "span",
            { className: pillCountCls },
            String(snap.count || 0),
            " item",
            snap.count === 1 ? "" : "s"
          ),
          React.createElement(
            "span",
            { className: pillSepCls },
            "• ",
            symbol,
            (snap.subtotal || 0).toFixed(2)
          )
        ),

        // Single combined action: View cart + Checkout
        React.createElement(
          ActionComponent,
          Object.assign(
            {
              className: btnPrimaryCls,
              "aria-label": "View cart and checkout",
            },
            actionProps
          ),
          "Cart & checkout"
        )
      )
    )
  );
}
