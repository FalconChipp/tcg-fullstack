// frontend/src/pages/marketplace/success.js

"use client";

import React, { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { gql, useQuery } from "@apollo/client";

/* =========================
   GraphQL
   ========================= */

const ORDER_QUERY = gql`
  query Order($id: ID!) {
    order(id: $id) {
      id
      orderNumber
      status
      total
      currency
      listingId
      paymentMethod
      buyerEmail
      guestCheckout
      createdAt
      paidAt
    }
  }
`;

/* =========================
   Simple helpers 
   ========================= */

function CtaButton(href, label, variant) {
  var base =
    "w-full sm:w-auto inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-light-accent dark:focus-visible:ring-dark-accent ";

  var cls =
    variant === "secondary"
      ? base +
        "text-white bg-light-alt dark:bg-dark-alt " +
        "border border-light-border dark:border-dark-border " +
        "hover:bg-light-elevated dark:hover:bg-dark-elevated"
      : base +
        "text-white bg-light-accent hover:bg-light-accentLight " +
        "dark:bg-dark-accent dark:hover:bg-dark-accentLight " +
        "shadow-md shadow-light-accent/40 dark:shadow-dark-accent/30";

  return React.createElement(
    "a",
    {
      href: href,
      className: cls,
      // Force white text even if global <a> styles exist
      style: { color: "#ffffff" },
    },
    label
  );
}

function StatusPill(text, tone) {
  var classes =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium " +
    (tone === "ok"
      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
      : tone === "warn"
      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200"
      : tone === "err"
      ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
      : "bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-gray-200");

  return React.createElement("span", { className: classes }, text);
}

/**
 * Small helper to render the centered card shell so all states look consistent.
 */
function Shell(props) {
  // props: { icon, iconTone, title, subtitle, children (array or single) }
  var iconBg;
  var iconColor;

  switch (props.iconTone) {
    case "ok":
      iconBg = "bg-green-500/12";
      iconColor = "text-green-500";
      break;
    case "warn":
      iconBg = "bg-yellow-500/12";
      iconColor = "text-yellow-500";
      break;
    case "err":
      iconBg = "bg-red-500/12";
      iconColor = "text-red-500";
      break;
    default:
      iconBg = "bg-light-alt dark:bg-dark-alt";
      iconColor = "text-light-text dark:text-dark-text";
  }

  var children = [];
  if (props.children) {
    if (Array.isArray(props.children)) children = props.children;
    else children = [props.children];
  }

  return React.createElement(
    "div",
    { className: "min-h-[80vh] flex items-center justify-center px-4 py-10" },
    React.createElement(
      "div",
      {
        className:
          "w-full max-w-xl rounded-3xl border border-light-border/70 dark:border-dark-border/70 " +
          "bg-light-surface dark:bg-dark-surface shadow-xl shadow-black/20 " +
          "px-6 sm:px-8 py-8 sm:py-10 text-center",
      },
      // icon
      React.createElement(
        "div",
        { className: "flex justify-center mb-4" },
        React.createElement(
          "div",
          {
            className:
              "h-12 w-12 rounded-full flex items-center justify-center text-xl " +
              iconBg +
              " " +
              iconColor,
          },
          props.icon || "ℹ"
        )
      ),
      // title
      React.createElement(
        "h1",
        {
          className:
            "text-2xl sm:text-3xl font-semibold mb-1 text-light-strong dark:text-dark-strong",
        },
        props.title
      ),
      // subtitle (optional)
      props.subtitle &&
        React.createElement(
          "p",
          {
            className:
              "text-xs sm:text-sm text-light-textMuted dark:text-dark-textMuted mb-4",
          },
          props.subtitle
        ),
      // children
      children
    )
  );
}

/* =========================
   Page Component
   ========================= */

function SuccessClient() {
  // Read ?order=... from URL (internal DB ID)
  const orderId = useMemo(function () {
    try {
      if (typeof window === "undefined") return null;
      var u = new URL(window.location.href);
      return u.searchParams.get("order");
    } catch (_e) {
      return null;
    }
  }, []);

  // Run the query only if we have an order id
  const { data, loading, error, startPolling, stopPolling, refetch } = useQuery(
    ORDER_QUERY,
    {
      variables: orderId ? { id: orderId } : undefined,
      skip: !orderId,
      fetchPolicy: "network-only",
      notifyOnNetworkStatusChange: true,
    }
  );

  const hasStopped = useRef(false);
  const startedAt = useRef(Date.now());

  // Poll until PAID (or 60s timeout)
  useEffect(
    function () {
      if (!orderId) return;

      // start polling every 2s
      startPolling(2000);

      const timeoutId = setInterval(function () {
        var elapsed = Date.now() - startedAt.current;
        if (elapsed > 60000 && !hasStopped.current) {
          // safety stop after 60s
          hasStopped.current = true;
          stopPolling();
        }
      }, 1000);

      return function cleanup() {
        clearInterval(timeoutId);
        stopPolling();
      };
    },
    [orderId, startPolling, stopPolling]
  );

  // Stop polling when paid
  useEffect(
    function () {
      if (!data || !data.order || hasStopped.current) return;
      if (data.order.status && String(data.order.status).toLowerCase() === "paid") {
        hasStopped.current = true;
        stopPolling();
      }
    },
    [data, stopPolling]
  );

  /* ---------- UI STATES ---------- */

  if (!orderId) {
    return Shell({
      icon: "ℹ",
      iconTone: "warn",
      title: "Thanks!",
      subtitle: "We couldn't find an order ID in the URL.",
      children: [
        React.createElement(
          "p",
          {
            key: "p",
            className:
              "mt-2 mb-6 text-sm text-light-textMuted dark:text-dark-textMuted",
          },
          "If you've just completed a payment, please return to the marketplace and try again from your email link or order history."
        ),
        React.createElement(
          "div",
          { key: "btn", className: "mt-2" },
          CtaButton("/marketplace", "Back to marketplace")
        ),
      ],
    });
  }

  if (loading && !data) {
    return Shell({
      icon: "⏳",
      iconTone: "warn",
      title: "Finalising your payment…",
      subtitle: "This can take a moment while we confirm your transaction.",
      children: [
        React.createElement(
          "div",
          { key: "pill", className: "mt-2 mb-6 flex justify-center" },
          StatusPill("Awaiting confirmation", "warn")
        ),
        React.createElement(
          "div",
          {
            key: "btns",
            className: "flex flex-col sm:flex-row gap-3 mt-2 justify-center",
          },
          CtaButton("/marketplace", "Continue shopping", "secondary")
        ),
      ],
    });
  }

  if (error) {
    return Shell({
      icon: "⚠",
      iconTone: "err",
      title: "We hit a snag",
      subtitle: "There was an error while checking your order.",
      children: [
        React.createElement(
          "p",
          {
            key: "p",
            className:
              "mt-2 text-xs sm:text-sm text-light-textMuted dark:text-dark-textMuted",
          },
          error.message || ""
        ),
        React.createElement(
          "div",
          {
            key: "btns",
            className:
              "mt-6 flex flex-col sm:flex-row gap-3 justify-center",
          },
          React.createElement(
            "button",
            {
              onClick: function () {
                refetch && refetch();
              },
              className:
                "w-full sm:w-auto rounded-xl px-5 py-2.5 text-sm font-semibold " +
                "border border-light-border dark:border-dark-border " +
                "bg-light-alt dark:bg-dark-alt " +
                "hover:bg-light-elevated dark:hover:bg-dark-elevated",
              style: { color: "#ffffff" }, // force white text
            },
            "Try again"
          ),
          CtaButton("/marketplace", "Back to marketplace", "secondary")
        ),
      ],
    });
  }

  var order = data && data.order;
  if (!order) {
    return Shell({
      icon: "ℹ",
      iconTone: "warn",
      title: "Order not found",
      subtitle:
        "We couldn't find an order matching that reference. If you've just paid, try refreshing after a moment.",
      children: React.createElement(
        "div",
        { className: "mt-6" },
        CtaButton("/marketplace", "Back to marketplace")
      ),
    });
  }

  var isPaid = String(order.status || "").toLowerCase() === "paid";
  var currency = order.currency ? String(order.currency).toUpperCase() : "GBP";
  var symbol = currency === "GBP" ? "£" : "";
  var total = order.total != null ? Number(order.total).toFixed(2) : null;

  var orderRef = order.orderNumber || order.id;
  var statusText = isPaid ? "Paid" : "Awaiting confirmation";
  var pillTone = isPaid ? "ok" : "warn";

  var emailLine = null;
  if (order.buyerEmail) {
    emailLine = React.createElement(
      "p",
      {
        className:
          "text-xs text-light-textMuted dark:text-dark-textMuted mt-1",
      },
      "A receipt will be sent to ",
      React.createElement(
        "span",
        { className: "font-medium" },
        order.buyerEmail
      ),
      "."
    );
  }

  // SUCCESS (or near-success) state
  return Shell({
    icon: isPaid ? "🎉" : "⏳",
    iconTone: isPaid ? "ok" : "warn",
    title: isPaid ? "Payment confirmed" : "Finalising your payment…",
    subtitle: isPaid
      ? "Your order has been received and recorded."
      : "Your payment has been received and is still being confirmed.",
    children: [
      // Order ref
      React.createElement(
        "p",
        {
          key: "ref",
          className:
            "mt-2 text-xs sm:text-sm text-light-textMuted dark:text-dark-textMuted",
        },
        "Order reference: ",
        React.createElement(
          "span",
          { className: "font-semibold text-light-strong dark:text-dark-strong" },
          orderRef
        )
      ),

      // Total
      total != null &&
        React.createElement(
          "p",
          {
            key: "total",
            className:
              "mt-2 text-sm text-light-text dark:text-dark-text font-medium",
          },
          "Total: ",
          React.createElement(
            "span",
            { className: "font-semibold" },
            symbol + total,
            " ",
            currency
          )
        ),

      // Status pill
      React.createElement(
        "div",
        { key: "pill", className: "mt-3 mb-1 flex justify-center" },
        StatusPill(statusText, pillTone)
      ),

      // Copy
      React.createElement(
        "p",
        {
          key: "copy",
          className:
            "mt-2 text-sm text-light-textMuted dark:text-dark-textMuted",
        },
        isPaid
          ? "You're all set. We'll keep you updated about fulfilment. You can safely close this page or continue browsing the marketplace."
          : "Hang tight—your payment is still being confirmed. This usually takes a few seconds."
      ),

      // Email line (optional)
      emailLine && React.createElement("div", { key: "email" }, emailLine),

      // Buttons
      React.createElement(
        "div",
        {
          key: "btns",
          className:
            "mt-7 flex flex-col sm:flex-row gap-3 justify-center",
        },
        CtaButton(
          "/marketplace",
          isPaid ? "Back to marketplace" : "Return to marketplace"
        )
      ),
    ],
  });
}

// Export client-only page 
export default dynamic(() => Promise.resolve(SuccessClient), { ssr: false });
