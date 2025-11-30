// frontend/src/components/Marketplace/ProductDetailsSection.js
// Dynamic product details panel (plain JS, no JSX)
// - UI-only: chooses layout based on product type
// - Types supported:
//    • "3D_PRINT"  → 3D print details (material, quality, lead time, etc.)
//    • "CLOTHING"  → clothing details (fabric, fit, print, care, size guide)
// - Detection:
//    • Prefers listing.productType if present
//    • Fallback: infers from title keywords (hoodie, tee, 3d print, etc.)

"use client";

import React, { useMemo } from "react";

/* ---------- Helpers: infer product type from title ---------- */

function inferProductType(listing) {
  if (!listing) return null;

  // Explicit override from backend (future-safe)
  if (listing.productType) {
    return String(listing.productType).toUpperCase();
  }

  var title = (listing.title || "").toLowerCase();

  // Basic heuristics for now
  if (
    title.includes("hoodie") ||
    title.includes("t-shirt") ||
    title.includes("tshirt") ||
    title.includes("tee") ||
    title.includes("jumper") ||
    title.includes("crewneck")
  ) {
    return "CLOTHING";
  }

  if (
    title.includes("3d printed") ||
    title.includes("printed model") ||
    title.includes("miniature") ||
    title.includes("figure") 
  ) {
    return "3D_PRINT";
  }

  return null;
}

/* ---------- Render helpers ---------- */

function DetailRow(label, value, key) {
  if (!value) return null;
  return React.createElement(
    "div",
    {
      key: key || label,
      className:
        "flex items-start justify-between gap-4 text-xs sm:text-sm text-light-text dark:text-dark-text",
    },
    React.createElement(
      "span",
      {
        className:
          "font-medium text-light-strong dark:text-dark-strong",
      },
      label
    ),
    React.createElement(
      "span",
      {
        className:
          "text-right text-light-textMuted dark:text-dark-textMuted",
      },
      value
    )
  );
}

function SectionWrapper(label, children, key) {
  if (!children) return null;
  return React.createElement(
    "div",
    { key: key, className: "space-y-1.5" },
    React.createElement(
      "div",
      {
        className:
          "text-[11px] font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted",
      },
      label
    ),
    children
  );
}

/* ---------- 3D PRINT details ---------- */

function render3DPrintDetails(listing) {
  // For now, static-ish defaults; later can be driven by listing.metadataJson
  var material = "PLA+ (high quality)"; // could read from listing.metadata later
  var layerHeight = "0.16–0.20mm (fine detail)";
  var infill = "15–20% standard, higher where needed";
  var finish = "Cleaned and de-supported, no painting by default";
  var leadTime = "3–7 working days before dispatch";
  var care = "Keep away from high heat sources (>60°C) to avoid warping";

  var dims = "Varies by model; sized for display on a standard shelf";

  var rows = [
    DetailRow("Material", material, "mat"),
    DetailRow("Layer height", layerHeight, "layer"),
    DetailRow("Infill", infill, "infill"),
    DetailRow("Finish", finish, "finish"),
    DetailRow("Approx. size", dims, "dims"),
    DetailRow("Lead time", leadTime, "lead"),
    DetailRow("Care", care, "care"),
  ].filter(Boolean);

  if (!rows.length) return null;

  return SectionWrapper(
    "3D print details",
    React.createElement("div", { className: "space-y-1.5" }, rows),
    "3d-print"
  );
}

/* ---------- CLOTHING details ---------- */

function renderClothingDetails(listing) {
  var fabric = "80% cotton / 20% polyester (soft-feel fleece)";
  var fit = "Unisex regular fit – size up for oversized look";
  var weight = "Medium weight (approx. 280–300gsm)";
  var printMethod = "DTF (direct-to-film) or screen print depending on run";
  var leadTime = "Usually ships in 5–10 working days";
  var care =
    "Wash inside out at 30°C, do not tumble dry, do not iron directly over print";

  var rows = [
    DetailRow("Fabric", fabric, "fab"),
    DetailRow("Fit", fit, "fit"),
    DetailRow("Weight", weight, "weight"),
    DetailRow("Print", printMethod, "print"),
    DetailRow("Lead time", leadTime, "lead"),
    DetailRow("Care", care, "care"),
  ].filter(Boolean);

  var sizeGuide = React.createElement(
    "div",
    {
      className:
        "mt-2 rounded-xl border border-light-border dark:border-dark-border bg-light-surface/60 dark:bg-dark-surface/60 px-3 py-2",
    },
    React.createElement(
      "div",
      {
        className:
          "flex items-center justify-between text-[11px] font-semibold text-light-textMuted dark:text-dark-textMuted mb-1",
      },
      React.createElement("span", null, "Size guide"),
      React.createElement(
        "span",
        null,
        "Chest (approx.)"
      )
    ),
    React.createElement(
      "div",
      { className: "grid grid-cols-4 gap-1 text-[11px] text-light-textMuted dark:text-dark-textMuted" },
      React.createElement(
        "div",
        { className: "flex flex-col gap-0.5" },
        React.createElement("span", { className: "font-medium text-light-strong dark:text-dark-strong" }, "S"),
        React.createElement("span", null, "34–36\"")
      ),
      React.createElement(
        "div",
        { className: "flex flex-col gap-0.5" },
        React.createElement("span", { className: "font-medium text-light-strong dark:text-dark-strong" }, "M"),
        React.createElement("span", null, "38–40\"")
      ),
      React.createElement(
        "div",
        { className: "flex flex-col gap-0.5" },
        React.createElement("span", { className: "font-medium text-light-strong dark:text-dark-strong" }, "L"),
        React.createElement("span", null, "42–44\"")
      ),
      React.createElement(
        "div",
        { className: "flex flex-col gap-0.5" },
        React.createElement("span", { className: "font-medium text-light-strong dark:text-dark-strong" }, "XL+"),
        React.createElement("span", null, "46\"+")
      )
    )
  );

  var detailsBlock = React.createElement(
    "div",
    { className: "space-y-1.5" },
    rows,
    sizeGuide
  );

  return SectionWrapper("Garment details", detailsBlock, "clothing");
}

/* ---------- Component ---------- */

export default function ProductDetailsSection(props) {
  var listing = props && props.listing;
  if (!listing || listing.__typename !== "ProductListing") return null;

  var productType = useMemo(
    function () {
      return inferProductType(listing);
    },
    [listing]
  );

  if (!productType) return null;

  var panelCls =
    "rounded-2xl border border-light-border dark:border-dark-border " +
    "bg-light-surface dark:bg-dark-surface p-4 space-y-3";

  var headerCls =
    "text-xs font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted";

  var content;
  if (productType === "3D_PRINT") {
    content = render3DPrintDetails(listing);
  } else if (productType === "CLOTHING") {
    content = renderClothingDetails(listing);
  } else {
    return null;
  }

  if (!content) return null;

  return React.createElement(
    "section",
    { className: panelCls, "aria-label": "Product details" },
    React.createElement("div", { className: headerCls }, "Product details"),
    content
  );
}
