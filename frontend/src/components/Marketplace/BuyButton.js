// frontend/src/components/Marketplace/BuyButton.js
// "Add to cart" button (no JSX)
// - NO GraphQL / createOrder
// - Writes to localStorage("sbf_cart")
// - Item shape includes colour/size/productType metadata:
//   { id, listingId, type, title, subtitle, imageUrl, currency, price, qty,
//     cardId?, productType?, fulfilmentType?, fulfilmentProvider?,
//     fulfilmentExternalId?, colourId?, colourName?, sizeId?, sizeLabel? }

"use client";

import React, { useState } from "react";
import { devError } from "@/utils/devLog";

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

    // Fire a storage-like event so SecondaryHeader / CartModal can update in same tab
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

/* ----------------- Helpers ----------------- */

// Accepts either an array or a JSON string of image URLs
function normalizeImagesList(maybeImages) {
  if (!maybeImages) return [];
  if (Array.isArray(maybeImages)) return maybeImages;

  if (typeof maybeImages === "string") {
    try {
      var parsed = JSON.parse(maybeImages);
      if (Array.isArray(parsed)) return parsed;
    } catch (_e) {
      // ignore
    }
  }
  return [];
}

// Accepts either an array or JSON string of colour names
function normalizeColourList(maybeColours) {
  if (!maybeColours) return [];
  if (Array.isArray(maybeColours)) return maybeColours;

  if (typeof maybeColours === "string") {
    try {
      var parsed = JSON.parse(maybeColours);
      if (Array.isArray(parsed)) return parsed;
    } catch (_e) {
      // ignore
    }
  }
  return [];
}

/* ----------------- Main component ----------------- */

export default function BuyButton(props) {
  var listing = props.listing;
  var defaultQty = props.defaultQty || 1;
  var onAdded = props.onAdded || function () {};

  // Selected colour/size coming from the product detail page
  var selectedColour = props.selectedColour || null;
  var selectedSize = props.selectedSize || null;

  var _useState = useState(defaultQty);
  var qty = _useState[0];
  var setQty = _useState[1];

  var _useState2 = useState(false);
  var adding = _useState2[0];
  var setAdding = _useState2[1];

  var _useState3 = useState("");
  var err = _useState3[0];
  var setErr = _useState3[1];

  var _useState4 = useState(false);
  var added = _useState4[0];
  var setAdded = _useState4[1];

  if (!listing) {
    return null;
  }

  var isProduct = listing.__typename === "ProductListing";

  // IMPORTANT: treat PRODUCTS as always in stock on the frontend.
  // Card listings still respect any inventory/onHand metadata if you add it later.
  var onHand =
    !isProduct && listing.inventory && typeof listing.inventory.onHand === "number"
      ? listing.inventory.onHand
      : null;

  var inStock = isProduct ? true : onHand === null || onHand > 0;

  function onQtyChange(e) {
    var v = parseInt(e.target.value || "1", 10);
    if (!Number.isFinite(v) || v < 1) v = 1;
    // Only clamp to onHand for non-products
    if (!isProduct && onHand !== null && v > onHand) v = onHand;
    if (v > 999) v = 999;
    setQty(v);
  }

  // Build cart item, including colour/size/productType metadata
  // CHANGED: now applies sensible defaults for colour/size when they are not selected
  function buildCartItem(listing, qtyToAdd, colourOpt, sizeOpt) {
    var type = listing.__typename === "ProductListing" ? "PRODUCT" : "CARD";
    var currency = listing.currency || "GBP";
    var price = Number(listing.price) || 0;

    var title;
    var subtitle = "";

    if (type === "PRODUCT") {
      title = listing.title || "Product";
      subtitle = listing.description || "";
    } else {
      // Card listing – basic label using cardId / condition / variation
      var parts = [];
      if (listing.cardId) parts.push(listing.cardId);
      if (listing.variation) parts.push(listing.variation);
      title = parts.length ? parts.join(" • ") : "Card listing";
      if (listing.condition) subtitle = listing.condition;
      if (listing.notes) {
        subtitle = subtitle ? subtitle + " • " + listing.notes : listing.notes;
      }
    }

    // Normalised images
    var images = normalizeImagesList(listing.imagesJson);

    // ---------- Colour / size defaults ----------
    // Start from explicitly-selected options (detail page),
    // then fall back to the first colour + a default size for products.
    var effectiveColour = colourOpt || null;
    var effectiveSize = sizeOpt || null;

    if (!effectiveColour && type === "PRODUCT") {
      var colourList = normalizeColourList(listing.colourVariantsJson);
      if (colourList.length) {
        var firstColour = String(colourList[0]);
        effectiveColour = {
          id: "colour-default",
          name: firstColour,
          label: firstColour,
        };
      }
    }

    if (!effectiveSize && type === "PRODUCT") {
      // Simple sensible default – you can tune this later (e.g. "One size")
      effectiveSize = {
        id: "size-default",
        label: "M",
      };
    }

    // Variant image based on effective colour, if possible
    var variantImage = null;

    if (effectiveColour && images.length) {
      var colourKey =
        (effectiveColour.name ||
          effectiveColour.label ||
          effectiveColour.id ||
          "")
          .toString()
          .toLowerCase();
      var hyphenKey = colourKey.replace(/\s+/g, "-");

      var match = images.find(function (img) {
        var lower = String(img || "").toLowerCase();
        return (
          lower.indexOf(colourKey) !== -1 ||
          (hyphenKey && lower.indexOf(hyphenKey) !== -1)
        );
      });

      if (match) variantImage = match;
    }

    // Colour/size metadata from effective selections
    var colourId = effectiveColour && effectiveColour.id ? effectiveColour.id : null;
    var colourName =
      (effectiveColour &&
        (effectiveColour.name ||
          effectiveColour.label ||
          effectiveColour.id)) ||
      null;

    var sizeId = effectiveSize && effectiveSize.id ? effectiveSize.id : null;
    var sizeLabel =
      (effectiveSize &&
        (effectiveSize.label || effectiveSize.name || effectiveSize.id)) ||
      null;

    return {
      id: listing.id, // for React key
      listingId: listing.id, // explicit link back to listing
      type: type, // "PRODUCT" | "CARD"
      title: title,
      subtitle: subtitle,
      imageUrl: variantImage || listing.imageUrl || null,
      currency: currency,
      price: price,
      qty: qtyToAdd,
      cardId: listing.cardId || null,

      // Product metadata
      productType: listing.productType || null,
      fulfilmentType: listing.fulfilmentType || null,
      fulfilmentProvider: listing.fulfilmentProvider || null,
      fulfilmentExternalId: listing.fulfilmentExternalId || null,

      // User selections / defaults
      colourId: colourId,
      colourName: colourName,
      sizeId: sizeId,
      sizeLabel: sizeLabel,
    };
  }

  function handleAddToCart() {
    if (!listing) return;
    if (!inStock) return;

    setErr("");
    setAdded(false);
    setAdding(true);

    try {
      var items = readCartFromStorage();
      // NOTE: selectedColour/selectedSize might be null – buildCartItem
      // now fills in sensible defaults for products.
      var item = buildCartItem(listing, qty, selectedColour, selectedSize);

      // Merge items by listingId + type + colourId + sizeId
      var foundIndex = -1;
      for (var i = 0; i < items.length; i++) {
        var existing = items[i] || {};
        var sameListing = existing.listingId === item.listingId;
        var sameType = existing.type === item.type;
        var sameColour = existing.colourId === item.colourId;
        var sameSize = existing.sizeId === item.sizeId;

        if (sameListing && sameType && sameColour && sameSize) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex >= 0) {
        var existingItem = items[foundIndex];
        var newQty = (Number(existingItem.qty) || 0) + item.qty;

        if (!isProduct && onHand !== null && newQty > onHand) {
          newQty = onHand;
        }
        items[foundIndex] = Object.assign({}, existingItem, { qty: newQty });
      } else {
        items.push(item);
      }

      writeCartToStorage(items);
      setAdded(true);
      onAdded({ items: items, addedItem: item });
    } catch (e) {
      setErr((e && e.message) || "Failed to add to cart");
      devError("[BuyButton/AddToCart] error:", e);
    } finally {
      setAdding(false);
      if (!err) {
        setTimeout(function () {
          setAdded(false);
        }, 2000);
      }
    }
  }

  var input =
    isProduct &&
    React.createElement("input", {
      type: "number",
      min: 1,
      max: 999,
      value: qty,
      onChange: onQtyChange,
      "aria-label": "Quantity",
      className:
        "w-16 rounded-md border border-vault-border " +
        "bg-vault-surface px-2 py-1 text-sm " +
        "text-vault-text",
    });

  var btnLabel;
  if (!inStock && !isProduct) {
    btnLabel = "Out of stock";
  } else if (adding) {
    btnLabel = "Adding…";
  } else {
    btnLabel = "Add to cart";
  }

  var btn = React.createElement(
    "button",
    {
      type: "button",
      onClick: handleAddToCart,
      disabled: adding || (!inStock && !isProduct),
      className:
        "rounded-[6px] px-4 py-2 text-sm font-medium text-white " +
        "bg-vault-accent hover:bg-vault-accentHover " +
        "dark:bg-vault-accent dark:hover:bg-vault-accentHover " +
        "disabled:opacity-50 disabled:cursor-not-allowed",
    },
    btnLabel
  );

  var statusNode = null;
  if (added && !err) {
    statusNode = React.createElement(
      "span",
      { className: "text-xs text-vault-textTertiary" },
      "Added to cart"
    );
  } else if (err) {
    statusNode = React.createElement(
      "span",
      { className: "text-xs text-vault-danger dark:text-vault-danger" },
      err
    );
  }

  return React.createElement(
    "div",
    { className: "flex items-center gap-2" },
    input,
    btn,
    statusNode
  );
}
