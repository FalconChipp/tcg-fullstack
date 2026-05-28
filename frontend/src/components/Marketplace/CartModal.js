// frontend/src/components/Marketplace/CartModal.js
// Cart & checkout modal (plain JS, no JSX)
// - Reads/writes localStorage "sbf_cart"
// - Shows line items, subtotal, clear cart
// - Inline checkout form (name/email/address/notes)
// - On submit:
//     -> POSTs to backend /checkout/create-stripe-session
//     -> Redirects user to Stripe Checkout URL
//
// Props:
//   - isOpen: boolean
//   - onClose: () => void
//
// CHANGES (this version):
//   - Added shipping estimation based on cart contents
//   - Shows:
//       * Items subtotal
//       * Estimated shipping (tracked)
//       * Estimated total
//   - Note if ordering both CLOTHING (POD) and 3D_PRINT items that
//     parcels will arrive separately.
//            backend as Authorization / X-Access-Token so
//            /checkout/create-stripe-session passes requireAuth.

"use client";

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AuthContext } from "@/components/Auth/AuthProvider";

/* ----------------- Cart helpers ----------------- */

function readCartFromStorage() {
  try {
    var raw = localStorage.getItem("sbf_cart");
    if (!raw) return [];
    var arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch (_e) {
    return [];
  }
}

function writeCartToStorage(items) {
  try {
    var json = JSON.stringify(items || []);
    localStorage.setItem("sbf_cart", json);

    // Fire a storage-like event so SecondaryHeader etc. can react
    try {
      var evt = new StorageEvent("storage", { key: "sbf_cart", newValue: json });
      window.dispatchEvent(evt);
    } catch (_e) {
      try {
        var fallback = new Event("storage");
        fallback.key = "sbf_cart";
        window.dispatchEvent(fallback);
      } catch (_e2) {
        // ignore
      }
    }
  } catch (_e3) {
    // ignore
  }
}

/* ----------------- API base (backend) ----------------- */

import { getApiBase } from "@/utils/apiClient";
import { devLog, devError } from "@/utils/devLog";

/* ----------------- Shipping helper ----------------- */
/**
 * Compute a simple tracked-shipping estimate based on cart contents.
 *
 * Rules (adjust as needed):
 *   - Any non-POD physical item -> treated as "3D_PRINT" bucket.
 *   - POD items (fulfilmentType === "POD") -> "CLOTHING" bucket.
 *
 *   3D_PRINT:
 *     - Base: £4.50 for the first item
 *     - +£1.50 for each additional 3D item
 *
 *   CLOTHING:
 *     - Base: £3.50 for the first clothing item
 *     - +£1.00 for each additional clothing item
 */
function computeShippingInfo(items) {
  if (!items || !items.length) {
    return {
      shipping: 0,
      has3d: false,
      hasClothing: false,
      totalPhysicalCount: 0,
    };
  }

  var has3d = false;
  var hasClothing = false;
  var count3d = 0;
  var countClothing = 0;

  items.forEach(function (item) {
    var qty = Number(item.qty) || 1;

    // Derive a coarse product type for shipping purposes
    var type = item.productType;
    if (!type) {
      if (item.fulfilmentType === "POD") type = "CLOTHING";
      else type = "3D_PRINT";
    }

    if (type === "CLOTHING") {
      hasClothing = true;
      countClothing += qty;
    } else {
      // includes 3D prints + any future tracked card types
      has3d = true;
      count3d += qty;
    }
  });

  var shipping = 0;

  // 3D prints / internal tracked items
  if (count3d > 0) {
    shipping += 2.49 + Math.max(0, count3d - 1) * 1.0;
  }

  // Clothing (POD) bucket
  if (countClothing > 0) {
    shipping += 3.5 + Math.max(0, countClothing - 1) * 1.0;
  }

  return {
    shipping: shipping,
    has3d: has3d,
    hasClothing: hasClothing,
    totalPhysicalCount: count3d + countClothing,
  };
}

/* ----------------- Modal component ----------------- */

export default function CartModal(props) {
  var isOpen = !!(props && props.isOpen);
  var onClose = (props && props.onClose) || function () {};

  var auth = useContext(AuthContext) || {};
  var accessToken = auth.token || null;
  var isAuthenticated = !!(auth.user || accessToken);

  var _useStateItems = useState([]);
  var items = _useStateItems[0];
  var setItems = _useStateItems[1];

  var _useStateBusy = useState(false);
  var busy = _useStateBusy[0];
  var setBusy = _useStateBusy[1];

  var _useStateError = useState("");
  var error = _useStateError[0];
  var setError = _useStateError[1];

  // Simple checkout form state
  var _useStateForm = useState({
    name: "",
    email: "",
    address1: "",
    address2: "",
    city: "",
    postcode: "",
    country: "United Kingdom",
    notes: "",
  });
  var form = _useStateForm[0];
  var setForm = _useStateForm[1];

  var _useStateFormErrors = useState({});
  var formErrors = _useStateFormErrors[0];
  var setFormErrors = _useStateFormErrors[1];

  // Load cart when modal opens, and subscribe to storage changes
  useEffect(
    function () {
      if (!isOpen) return;

      function syncCart() {
        setItems(readCartFromStorage());
      }

      syncCart();

      function handleStorage(e) {
        if (!e || e.key === "sbf_cart") {
          syncCart();
        }
      }

      window.addEventListener("storage", handleStorage);
      return function () {
        window.removeEventListener("storage", handleStorage);
      };
    },
    [isOpen]
  );

  var subtotal = useMemo(
    function () {
      if (!items || !items.length) return 0;
      return items.reduce(function (acc, item) {
        var qty = Number(item.qty) || 0;
        var price = Number(item.price) || 0;
        return acc + qty * price;
      }, 0);
    },
    [items]
  );

  var currency = (items[0] && items[0].currency) || "GBP";

  function formatMoney(value) {
    var v = Number(value) || 0;
    try {
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: currency,
      }).format(v);
    } catch (_e) {
      var sym = currency.toUpperCase() === "GBP" ? "£" : "";
      return sym + v.toFixed(2);
    }
  }

  var shippingInfo = useMemo(
    function () {
      return computeShippingInfo(items);
    },
    [items]
  );
  var shippingAmount = shippingInfo.shipping || 0;
  var grandTotal = subtotal + shippingAmount;

  /* ----------------- Cart actions ----------------- */

  var handleQtyChange = useCallback(
    function (itemId, nextQtyRaw) {
      var nextQty = parseInt(nextQtyRaw || "1", 10);
      if (!Number.isFinite(nextQty) || nextQty < 1) nextQty = 1;
      if (nextQty > 999) nextQty = 999;

      setItems(function (prev) {
        var updated = prev.map(function (it) {
          if (it.listingId === itemId || it.id === itemId) {
            return Object.assign({}, it, { qty: nextQty });
          }
          return it;
        });
        writeCartToStorage(updated);
        return updated;
      });
    },
    []
  );

  var handleRemoveItem = useCallback(function (itemId) {
    setItems(function (prev) {
      var updated = prev.filter(function (it) {
        return !(it.listingId === itemId || it.id === itemId);
      });
      writeCartToStorage(updated);
      return updated;
    });
  }, []);

  var handleClearCart = useCallback(function () {
    setItems([]);
    writeCartToStorage([]);
  }, []);

  /* ----------------- Checkout form logic ----------------- */

  function handleFormChange(field, value) {
    setForm(function (prev) {
      var copy = Object.assign({}, prev);
      copy[field] = value;
      return copy;
    });
  }

  function validateForm() {
    var errs = {};

    if (!form.name || !form.name.trim()) {
      errs.name = "Name is required";
    }
    if (!form.email || !form.email.trim()) {
      errs.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      errs.email = "Enter a valid email";
    }
    if (!form.address1 || !form.address1.trim()) {
      errs.address1 = "Address line 1 is required";
    }
    if (!form.city || !form.city.trim()) {
      errs.city = "City is required";
    }
    if (!form.postcode || !form.postcode.trim()) {
      errs.postcode = "Postcode is required";
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // call backend /checkout/create-stripe-session
  async function handleCheckoutSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!items.length) {
      setError("Your cart is empty.");
      return;
    }

    if (!isAuthenticated || !accessToken) {
      setError("Please sign in to checkout.");
      return;
    }

    setError("");

    var ok = validateForm();
    if (!ok) return;

    setBusy(true);

    try {
      var lineItems = items.map(function (i) {
        return {
          name: i.name || i.title || "Item",
          amount: Math.round((Number(i.price) || 0) * 100), // pence
          quantity: Number(i.qty) || 1,
        };
      });

      var payload = {
        items: lineItems,
        email: form.email,
        description: "SixByFive store purchase",
      };

      devLog("[CartModal] starting checkout with payload", payload);

      var headers = { "Content-Type": "application/json" };
      if (accessToken) headers.Authorization = "Bearer " + accessToken;

      var res = await fetch(getApiBase() + "/checkout", {
        method: "POST",
        headers: headers,
        // keep cookies in case you also use cookie-based auth anywhere
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        var text = "";
        try {
          text = await res.text();
        } catch (_e) {
          // ignore
        }

        // Try to parse JSON {ok:false,error} or fall back to raw text
        var msg = "Checkout failed";
        try {
          var json = JSON.parse(text);
          if (json && json.error) msg = json.error;
        } catch (_e2) {
          if (text) msg = text;
        }

        devError(
          "[CartModal] checkout failed (" + res.status + "):",
          msg
        );

        setError(
          "Checkout failed (" +
            res.status +
            "). " +
            (msg || "Please try again.")
        );
        return;
      }

      var data = {};
      try {
        data = await res.json();
      } catch (_e3) {
        data = {};
      }

      devLog("[CartModal] checkout response", data);

      if (!data.url) {
        setError(
          "Checkout API response was invalid. Please try again in a moment."
        );
        return;
      }

      // Clear cart locally before redirecting
      handleClearCart();
      setForm({
        name: "",
        email: "",
        address1: "",
        address2: "",
        city: "",
        postcode: "",
        country: "United Kingdom",
        notes: "",
      });
      setFormErrors({});

      // Redirect to Stripe Checkout
      if (typeof window !== "undefined") {
        window.location.href = data.url;
      }
    } catch (err) {
      devError("[CartModal] checkout error", err);
      setError(
        (err && err.message) ||
          "Something went wrong starting checkout. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  /* ----------------- Render helpers ----------------- */

  if (!isOpen) return null;

  // higher z-index + align from top with padding
  var overlayCls =
    "fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 " +
    "bg-black/40 backdrop-blur-sm";

  var modalCls =
    "relative z-50 w-full max-w-3xl rounded-3xl border border-light-border " +
    "dark:border-dark-border bg-light-surface dark:bg-dark-surface " +
    "shadow-xl max-h-[90vh] overflow-hidden flex flex-col";

  var headerCls =
    "px-4 sm:px-6 py-3 border-b border-light-border dark:border-dark-border " +
    "flex items-center justify-between gap-3";
  var titleCls =
    "text-base sm:text-lg font-semibold text-light-strong dark:text-dark-strong";
  var closeBtnCls =
    "text-xs font-medium text-light-textMuted dark:text-dark-textMuted " +
    "hover:text-light-strong dark:hover:text-dark-strong";

  var bodyCls =
    "flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-4 sm:gap-5";

  var footerCls =
    "px-4 sm:px-6 py-3 border-t border-light-border dark:border-dark-border " +
    "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3";

  var lineItemCls =
    "flex items-start gap-3 rounded-2xl border border-light-border dark:border-dark-border " +
    "bg-light-elevated dark:bg-dark-elevated p-3";

  var thumbnailCls =
    "h-14 w-14 flex-shrink-0 rounded-xl overflow-hidden bg-light-alt dark:bg-dark-alt border " +
    "border-light-border dark:border-dark-border";

  var qtyInputCls =
    "w-16 rounded-md border border-light-border dark:border-dark-border " +
    "bg-light-surface dark:bg-dark-surface px-2 py-1 text-xs sm:text-sm " +
    "text-light-strong dark:text-dark-strong";

  var removeBtnCls =
    "text-[11px] text-light-textMuted dark:text-dark-textMuted hover:text-light-error " +
    "dark:hover:text-dark-error";

  var subtotalLabelCls =
    "text-xs font-medium uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted";
  var subtotalValueCls =
    "text-base sm:text-lg font-semibold text-light-strong dark:text-dark-strong";

  var btnPrimaryCls =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold " +
    "text-white bg-light-accent hover:bg-light-accentLight " +
    "dark:bg-dark-accent dark:hover:bg-dark-accentLight " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  var btnSecondaryCls =
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium " +
    "text-light-text dark:text-dark-text bg-light-alt dark:bg-dark-alt " +
    "hover:bg-light-elevated dark:hover:bg-dark-elevated";

  var formLabelCls =
    "text-xs font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted";
  var formInputCls =
    "mt-1 w-full rounded-md border border-light-border dark:border-dark-border " +
    "bg-light-surface dark:bg-dark-surface px-3 py-1.5 text-sm " +
    "text-light-strong dark:text-dark-strong";
  var formTextareaCls =
    "mt-1 w-full rounded-md border border-light-border dark:border-dark-border " +
    "bg-light-surface dark:bg-dark-surface px-3 py-1.5 text-sm " +
    "text-light-strong dark:text-dark-strong resize-none min-h-[70px]";
  var formErrorCls = "mt-0.5 text-[11px] text-light-error dark:text-dark-error";

  // Note when clothing + 3D are mixed
  var shippingNote = null;
  if (shippingInfo.has3d && shippingInfo.hasClothing) {
    shippingNote =
      "Because you're ordering both clothing and 3D printed items, your order will arrive in separate tracked parcels.";
  }

  return React.createElement(
    "div",
    { className: overlayCls, role: "dialog", "aria-modal": "true" },
    React.createElement(
      "div",
      { className: modalCls },

      // Header
      React.createElement(
        "div",
        { className: headerCls },
        React.createElement("div", { className: titleCls }, "Your cart"),
        React.createElement(
          "button",
          {
            type: "button",
            onClick: onClose,
            className: closeBtnCls,
          },
          "Close"
        )
      ),

      // Body: items + checkout form
      React.createElement(
        "div",
        { className: bodyCls },

        // Line items
        items.length === 0
          ? React.createElement(
              "p",
              {
                className:
                  "text-sm text-light-textMuted dark:text-dark-textMuted",
              },
              "Your cart is empty."
            )
          : items.map(function (item) {
              var id = item.listingId || item.id;
              var title = item.title || "Item";
              var description = item.subtitle || "";
              var qty = Number(item.qty) || 1;
              var lineTotal = (Number(item.price) || 0) * qty;

              // derive display type from fulfilmentType / productType
              var metaParts = [];
              var displayType = item.productType;
              if (!displayType) {
                if (item.fulfilmentType === "POD") displayType = "CLOTHING";
                else displayType = "3D_PRINT";
              }

              if (displayType) metaParts.push(displayType);
              if (item.colourName) metaParts.push(item.colourName);
              if (item.sizeLabel) metaParts.push("Size " + item.sizeLabel);

              var metaLine = metaParts.length ? metaParts.join(" • ") : "";

              return React.createElement(
                "div",
                { key: id, className: lineItemCls },
                React.createElement(
                  "div",
                  { className: thumbnailCls },
                  item.imageUrl
                    ? React.createElement("img", {
                        src: item.imageUrl,
                        alt: title,
                        className: "h-full w-full object-cover",
                      })
                    : React.createElement(
                        "div",
                        {
                          className:
                            "h-full w-full flex items-center justify-center text-[10px] " +
                            "text-light-textMuted dark:text-dark-textMuted",
                        },
                        "No image"
                      )
                ),
                React.createElement(
                  "div",
                  { className: "flex-1 min-w-0" },
                  React.createElement(
                    "div",
                    {
                      className:
                        "flex items-start justify-between gap-2 mb-1",
                    },
                    React.createElement(
                      "div",
                      { className: "min-w-0" },
                      React.createElement(
                        "p",
                        {
                          className:
                            "text-sm font-medium text-light-strong dark:text-dark-strong truncate",
                        },
                        title
                      ),
                      metaLine &&
                        React.createElement(
                          "p",
                          {
                            className:
                              "text-xs text-light-textMuted dark:text-dark-textMuted truncate",
                          },
                          metaLine
                        ),
                      description &&
                        React.createElement(
                          "p",
                          {
                            className:
                              "text-xs text-light-textMuted dark:text-dark-textMuted truncate",
                          },
                          description
                        )
                    ),
                    React.createElement(
                      "div",
                      {
                        className:
                          "text-sm font-semibold text-light-strong dark:text-dark-strong",
                      },
                      formatMoney(lineTotal)
                    )
                  ),
                  React.createElement(
                    "div",
                    { className: "flex items-center gap-3 mt-1" },
                    React.createElement(
                      "label",
                      {
                        className:
                          "flex items-center gap-1 text-[11px] text-light-textMuted dark:text-dark-textMuted",
                      },
                      "Qty",
                      React.createElement("input", {
                        type: "number",
                        min: 1,
                        max: 999,
                        value: qty,
                        onChange: function (e) {
                          handleQtyChange(id, e.target.value);
                        },
                        className: qtyInputCls,
                      })
                    ),
                    React.createElement(
                      "button",
                      {
                        type: "button",
                        onClick: function () {
                          handleRemoveItem(id);
                        },
                        className: removeBtnCls,
                      },
                      "Remove"
                    )
                  )
                )
              );
            }),

        // Checkout form (only show when there are items)
        items.length > 0 &&
          React.createElement(
            "div",
            {
              className:
                "mt-2 rounded-2xl border border-light-border dark:border-dark-border " +
                "bg-light-surface dark:bg-dark-surface p-3 sm:p-4 flex flex-col gap-3",
            },
            React.createElement(
              "h2",
              {
                className:
                  "text-sm font-semibold text-light-strong dark:text-dark-strong",
              },
              "Checkout details"
            ),

            // Name + email
            React.createElement(
              "div",
              { className: "grid grid-cols-1 sm:grid-cols-2 gap-3" },
              React.createElement(
                "div",
                null,
                React.createElement("div", { className: formLabelCls }, "Name"),
                React.createElement("input", {
                  type: "text",
                  value: form.name,
                  onChange: function (e) {
                    handleFormChange("name", e.target.value);
                  },
                  className: formInputCls,
                  placeholder: "Full name",
                }),
                formErrors.name &&
                  React.createElement(
                    "div",
                    { className: formErrorCls },
                    formErrors.name
                  )
              ),
              React.createElement(
                "div",
                null,
                React.createElement("div", { className: formLabelCls }, "Email"),
                React.createElement("input", {
                  type: "email",
                  value: form.email,
                  onChange: function (e) {
                    handleFormChange("email", e.target.value);
                  },
                  className: formInputCls,
                  placeholder: "you@example.com",
                }),
                formErrors.email &&
                  React.createElement(
                    "div",
                    { className: formErrorCls },
                    formErrors.email
                  )
              )
            ),

            // Address lines
            React.createElement(
              "div",
              { className: "grid grid-cols-1 sm:grid-cols-2 gap-3" },
              React.createElement(
                "div",
                null,
                React.createElement(
                  "div",
                  { className: formLabelCls },
                  "Address line 1"
                ),
                React.createElement("input", {
                  type: "text",
                  value: form.address1,
                  onChange: function (e) {
                    handleFormChange("address1", e.target.value);
                  },
                  className: formInputCls,
                  placeholder: "House number and street",
                }),
                formErrors.address1 &&
                  React.createElement(
                    "div",
                    { className: formErrorCls },
                    formErrors.address1
                  )
              ),
              React.createElement(
                "div",
                null,
                React.createElement(
                  "div",
                  { className: formLabelCls },
                  "Address line 2 (optional)"
                ),
                React.createElement("input", {
                  type: "text",
                  value: form.address2,
                  onChange: function (e) {
                    handleFormChange("address2", e.target.value);
                  },
                  className: formInputCls,
                  placeholder: "Additional info, flat, etc.",
                })
              )
            ),

            // City / Postcode / Country
            React.createElement(
              "div",
              { className: "grid grid-cols-1 sm:grid-cols-3 gap-3" },
              React.createElement(
                "div",
                null,
                React.createElement("div", { className: formLabelCls }, "City"),
                React.createElement("input", {
                  type: "text",
                  value: form.city,
                  onChange: function (e) {
                    handleFormChange("city", e.target.value);
                  },
                  className: formInputCls,
                  placeholder: "City / Town",
                }),
                formErrors.city &&
                  React.createElement(
                    "div",
                    { className: formErrorCls },
                    formErrors.city
                  )
              ),
              React.createElement(
                "div",
                null,
                React.createElement(
                  "div",
                  { className: formLabelCls },
                  "Postcode"
                ),
                React.createElement("input", {
                  type: "text",
                  value: form.postcode,
                  onChange: function (e) {
                    handleFormChange("postcode", e.target.value);
                  },
                  className: formInputCls,
                  placeholder: "Postcode",
                }),
                formErrors.postcode &&
                  React.createElement(
                    "div",
                    { className: formErrorCls },
                    formErrors.postcode
                  )
              ),
              React.createElement(
                "div",
                null,
                React.createElement(
                  "div",
                  { className: formLabelCls },
                  "Country"
                ),
                React.createElement("input", {
                  type: "text",
                  value: form.country,
                  onChange: function (e) {
                    handleFormChange("country", e.target.value);
                  },
                  className: formInputCls,
                  placeholder: "Country",
                })
              )
            ),

            // Notes
            React.createElement(
              "div",
              null,
              React.createElement(
                "div",
                { className: formLabelCls },
                "Order notes (optional)"
              ),
              React.createElement("textarea", {
                value: form.notes,
                onChange: function (e) {
                  handleFormChange("notes", e.target.value);
                },
                className: formTextareaCls,
                placeholder: "Any special instructions about your order…",
              })
            )
          )
      ),

      // Footer: subtotal + shipping + actions
      React.createElement(
        "div",
        { className: footerCls },
        React.createElement(
          "div",
          { className: "flex flex-col gap-0.5 max-w-md" },
          React.createElement(
            "div",
            { className: subtotalLabelCls },
            "Items subtotal"
          ),
          React.createElement(
            "div",
            { className: subtotalValueCls },
            formatMoney(subtotal)
          ),
          React.createElement(
            "div",
            { className: subtotalLabelCls + " mt-2" },
            "Estimated shipping (tracked)"
          ),
          React.createElement(
            "div",
            { className: subtotalValueCls },
            shippingAmount > 0 ? formatMoney(shippingAmount) : "Calculated at checkout"
          ),
          React.createElement(
            "div",
            { className: subtotalLabelCls + " mt-2" },
            "Estimated total"
          ),
          React.createElement(
            "div",
            { className: subtotalValueCls },
            formatMoney(grandTotal)
          ),
          items.length > 0 &&
            React.createElement(
              "button",
              {
                type: "button",
                onClick: handleClearCart,
                className:
                  "mt-1 text-[11px] text-light-textMuted dark:text-dark-textMuted " +
                  "hover:text-light-error dark:hover:text-dark-error text-left",
              },
              "Clear cart"
            ),
          shippingNote &&
            React.createElement(
              "p",
              {
                className:
                  "mt-2 text-[11px] text-light-textMuted dark:text-dark-textMuted",
              },
              shippingNote
            ),
          React.createElement(
            "p",
            {
              className:
                "mt-2 text-[11px] text-light-textMuted dark:text-dark-textMuted",
            },
            "Shipping is automatically applied when you complete payment via Stripe - usually cheaper"
          ),
          error &&
            React.createElement(
              "p",
              {
                className:
                  "mt-1 text-xs text-light-error dark:text-dark-error",
              },
              error
            )
        ),
        React.createElement(
          "div",
          { className: "flex flex-col sm:flex-row gap-2 sm:ml-auto" },
          React.createElement(
            "button",
            {
              type: "button",
              onClick: onClose,
              className: btnSecondaryCls,
            },
            "Continue shopping"
          ),
          React.createElement(
            "button",
            {
              type: "button",
              onClick: handleCheckoutSubmit,
              disabled: !items.length || busy,
              className: btnPrimaryCls,
            },
            busy ? "Processing…" : "Checkout"
          )
        )
      )
    )
  );
}
