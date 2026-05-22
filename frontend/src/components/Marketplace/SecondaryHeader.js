// frontend/src/components/Marketplace/SecondaryHeader.js
// Marketplace secondary header — plain JS (no JSX)
//
// Complete redesign:
// - More modern marketplace dashboard layout
// - Stronger visual hierarchy
// - Cart shown as a proper checkout summary block
// - Wallet shown as a compact account balance tile
// - Better mobile stacking
// - Same behaviour kept:
//   - Reads localStorage("sbf_cart")
//   - Supports props.onCartClick
//   - Fetches wallet when logged in
//   - Falls back to /checkout link when no onCartClick is provided

"use client";

import React, { useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { AuthContext } from "@/components/Auth/AuthProvider";
import { getGraphqlUrl } from "@/utils/apiClient";

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

    return {
      items: arr,
      count: count,
      subtotal: Number(subtotal.toFixed(2)),
    };
  } catch (_e) {
    return { items: [], count: 0, subtotal: 0 };
  }
}

function formatMoney(symbol, value) {
  return symbol + Number(value || 0).toFixed(2);
}

function getItemLabel(count) {
  return String(count || 0) + " item" + (count === 1 ? "" : "s");
}

/* ---------------------------- Icons ---------------------------- */

function CartIcon(props) {
  return React.createElement(
    "svg",
    {
      width: props.size || 20,
      height: props.size || 20,
      viewBox: "0 0 24 24",
      fill: "none",
      className: props.className || "",
      "aria-hidden": "true",
    },
    React.createElement("path", {
      d: "M6 6h15l-1.5 8.5a2 2 0 0 1-2 1.5H9.5a2 2 0 0 1-2-1.5L5 3H2",
      stroke: "currentColor",
      strokeWidth: 1.6,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
    React.createElement("circle", {
      cx: 9.5,
      cy: 20,
      r: 1.4,
      fill: "currentColor",
    }),
    React.createElement("circle", {
      cx: 17.5,
      cy: 20,
      r: 1.4,
      fill: "currentColor",
    })
  );
}

function ShieldIcon(props) {
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
      d: "M12 3l7 3v5c0 4.5-2.8 8.5-7 10-4.2-1.5-7-5.5-7-10V6l7-3z",
      stroke: "currentColor",
      strokeWidth: 1.6,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
    React.createElement("path", {
      d: "M9 12l2 2 4-4",
      stroke: "currentColor",
      strokeWidth: 1.8,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    })
  );
}

function WalletIcon(props) {
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
      d: "M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v2.5",
      stroke: "currentColor",
      strokeWidth: 1.6,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
    React.createElement("path", {
      d: "M4 7.5A2.5 2.5 0 0 0 6.5 10H20v7a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5v-9z",
      stroke: "currentColor",
      strokeWidth: 1.6,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
    React.createElement("path", {
      d: "M17 14h.01",
      stroke: "currentColor",
      strokeWidth: 3,
      strokeLinecap: "round",
    })
  );
}

/* ---------------------------- Wallet fetch ---------------------------- */

async function fetchWalletBalance(token) {
  if (!token) return null;

  try {
    const res = await fetch(getGraphqlUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `query { myWallet(limit: 1) { balance held currency } }`,
      }),
    });

    const json = await res.json();
    return json?.data?.myWallet ?? null;
  } catch {
    return null;
  }
}

/* ---------------------------- Component ---------------------------- */

export default function SecondaryHeader(props) {
  var currency = (props && props.currency) || "GBP";
  var symbol = String(currency).toUpperCase() === "GBP" ? "£" : "";
  var onCartClick = (props && props.onCartClick) || null;

  var auth = useContext(AuthContext) || {};
  var token = auth.accessToken || auth.token || null;
  var isLoggedIn = !!(auth.isAuthenticated || token);

  var _cartState = useState(readCartSnapshot);
  var snap = _cartState[0];
  var setSnap = _cartState[1];

  var _walletState = useState(null);
  var wallet = _walletState[0];
  var setWallet = _walletState[1];

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

  useEffect(
    function () {
      if (!isLoggedIn) {
        setWallet(null);
        return;
      }

      fetchWalletBalance(token).then(function (w) {
        setWallet(w);
      });
    },
    [token, isLoggedIn]
  );

  var ActionComponent = onCartClick ? "button" : Link;

  var actionProps = onCartClick
    ? {
        type: "button",
        onClick: onCartClick,
      }
    : {
        href: "/checkout",
      };

  var CartSummaryComponent = onCartClick ? "button" : "div";

  var cartSummaryProps = onCartClick
    ? {
        type: "button",
        onClick: onCartClick,
        "aria-label": "Open cart",
      }
    : {};

  var cartCount = snap.count || 0;
  var subtotal = snap.subtotal || 0;
  var walletBalance = wallet ? formatMoney(symbol, wallet.balance || 0) : "—";

  return React.createElement(
    "section",
    {
      className:
        "relative mb-6 overflow-hidden rounded-3xl border p-4 shadow-sm " +
        "border-light-border dark:border-dark-border " +
        "bg-light-surface dark:bg-dark-surface",
      "aria-label": "Marketplace toolbar",
    },

    React.createElement("div", {
      className:
        "pointer-events-none absolute inset-x-0 top-0 h-1 " +
        "bg-gradient-to-r from-light-accent via-light-accentLight to-light-accent " +
        "dark:from-dark-accent dark:via-dark-accentLight dark:to-dark-accent",
    }),

    React.createElement(
      "div",
      {
        className:
          "grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-center",
      },

      /* LEFT SIDE */
      React.createElement(
        "div",
        {
          className: "min-w-0",
        },

        React.createElement(
          "div",
          {
            className: "flex flex-wrap items-center gap-2",
          },

          React.createElement(
            "span",
            {
              className:
                "rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide " +
                "border-light-border dark:border-dark-border " +
                "bg-light-alt dark:bg-dark-alt " +
                "text-light-textMuted dark:text-dark-textMuted",
            },
            "Marketplace"
          ),

          React.createElement(
            "span",
            {
              className:
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                "bg-light-accent/10 text-light-accent " +
                "dark:bg-dark-accent/15 dark:text-dark-accentLight",
            },
            React.createElement(ShieldIcon, { size: 14 }),
            "Protected checkout"
          )
        ),

        React.createElement(
          "div",
          {
            className: "mt-3",
          },

          React.createElement(
            "h2",
            {
              className:
                "text-lg font-black tracking-tight text-light-strong dark:text-dark-strong sm:text-xl",
            },
            "Buy, review, and checkout securely"
          ),

          React.createElement(
            "p",
            {
              className:
                "mt-1 max-w-2xl text-sm leading-6 text-light-textMuted dark:text-dark-textMuted",
            },
            "Review your basket, check your available wallet balance, and continue when everything looks right."
          )
        )
      ),

      /* RIGHT SIDE */
      React.createElement(
        "div",
        {
          className:
            "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[520px] lg:grid-cols-[160px_1fr]",
        },

        /* Wallet tile */
        isLoggedIn
          ? React.createElement(
              "div",
              {
                className:
                  "rounded-2xl border p-3 " +
                  "border-light-border dark:border-dark-border " +
                  "bg-light-alt/70 dark:bg-dark-alt/70",
              },

              React.createElement(
                "div",
                {
                  className: "flex items-center justify-between gap-3",
                },

                React.createElement(
                  "span",
                  {
                    className:
                      "inline-flex h-9 w-9 items-center justify-center rounded-xl " +
                      "bg-light-surface text-light-accent " +
                      "dark:bg-dark-surface dark:text-dark-accentLight",
                  },
                  React.createElement(WalletIcon, { size: 18 })
                ),

                React.createElement(
                  "div",
                  {
                    className: "min-w-0 text-right",
                  },
                  React.createElement(
                    "div",
                    {
                      className:
                        "text-[11px] font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted",
                    },
                    "Wallet"
                  ),
                  React.createElement(
                    "div",
                    {
                      className:
                        "truncate text-base font-black text-light-strong dark:text-dark-strong",
                    },
                    walletBalance
                  )
                )
              )
            )
          : null,

        /* Cart + checkout block */
        React.createElement(
          "div",
          {
            className:
              isLoggedIn
                ? "sm:col-span-1"
                : "sm:col-span-2 lg:col-span-2",
          },

          React.createElement(
            "div",
            {
              className:
                "grid grid-cols-1 gap-2 rounded-2xl border p-2 " +
                "border-light-border dark:border-dark-border " +
                "bg-light-alt dark:bg-dark-alt sm:grid-cols-[1fr_auto]",
            },

            React.createElement(
              CartSummaryComponent,
              Object.assign(
                {
                  className:
                    "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition " +
                    "hover:bg-light-surface dark:hover:bg-dark-surface",
                },
                cartSummaryProps
              ),

              React.createElement(
                "span",
                {
                  className: "flex min-w-0 items-center gap-3",
                },

                React.createElement(
                  "span",
                  {
                    className:
                      "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " +
                      "bg-light-surface text-light-accent " +
                      "dark:bg-dark-surface dark:text-dark-accentLight",
                  },
                  React.createElement(CartIcon, { size: 19 })
                ),

                React.createElement(
                  "span",
                  {
                    className: "min-w-0",
                  },
                  React.createElement(
                    "span",
                    {
                      className:
                        "block truncate text-sm font-bold text-light-strong dark:text-dark-strong",
                    },
                    getItemLabel(cartCount)
                  ),
                  React.createElement(
                    "span",
                    {
                      className:
                        "block text-xs text-light-textMuted dark:text-dark-textMuted",
                    },
                    "Basket subtotal"
                  )
                )
              ),

              React.createElement(
                "span",
                {
                  className:
                    "shrink-0 text-base font-black text-light-strong dark:text-dark-strong",
                },
                formatMoney(symbol, subtotal)
              )
            ),

            React.createElement(
              ActionComponent,
              Object.assign(
                {
                  className:
                    "inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-black " +
                    "shadow-sm transition " +
                    "bg-light-accent hover:bg-light-accentLight !text-white " +
                    "dark:bg-dark-accent dark:hover:bg-dark-accentLight dark:text-white",
                  "aria-label": "View cart and checkout",
                },
                actionProps
              ),
              "Checkout"
            )
          )
        )
      )
    )
  );
}