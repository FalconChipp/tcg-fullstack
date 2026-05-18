// frontend/src/pages/marketplace/[slug].js

"use client";

import React, { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useQuery, gql } from "@apollo/client";

import Layout from "@/components/Layout/Layout";
import SecondaryHeader from "@/components/Marketplace/SecondaryHeader";
import BuyButton from "@/components/Marketplace/BuyButton";
import ColorSelector from "@/components/Marketplace/ColorSelector";
import SizeSelector from "@/components/Marketplace/SizeSelector";
import ProductDetailsSection from "@/components/Marketplace/ProductDetailsSection";
// cart modal
import CartModal from "@/components/Marketplace/CartModal";

/* ---------------- Helper: extract UUID from slug or id ---------------- */

function extractIdFromParam(param) {
  if (!param || typeof param !== "string") return null;

  var uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (uuidRegex.test(param)) return param;

  var match = param.match(
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  );
  if (match && match[0]) return match[0];

  return param;
}

/* ---------------- Helper: parse JSON string -> array ------------------- */

function parseJsonList(maybeJson) {
  if (!maybeJson) return [];
  if (Array.isArray(maybeJson)) return maybeJson;

  if (typeof maybeJson === "string") {
    try {
      var parsed = JSON.parse(maybeJson);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch (_e) {
      return [];
    }
  }

  return [];
}

/* ---------------- Helpers: filename + colour/orientation ---------------- */

function normalizeColorName(name) {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getFilenameFromUrl(url) {
  if (!url || typeof url !== "string") return "";
  var noQuery = url.split("?")[0];
  var parts = noQuery.split("/");
  return parts[parts.length - 1] || "";
}

function filenameMatchesColor(filename, colorKey) {
  if (!filename || !colorKey) return false;
  var lower = filename.toLowerCase();
  return lower.indexOf(colorKey.toLowerCase()) !== -1;
}

function orientationScore(filename) {
  var lower = filename.toLowerCase();
  if (lower.indexOf("front") !== -1) return 0;
  if (lower.indexOf("back") !== -1) return 1;
  return 2;
}

/* ---------------- SHIPPING: simple client-side estimates ---------------- */

// NOTE: these are *display-only* estimates for the product page.
var SHIPPING_ESTIMATES = {
  CARD_TRACKED: 3, // cards must be sent tracked
  POD: 3.49, // print-on-demand clothing etc.
  INTERNAL: 2.49, // internally-fulfilled non-card items (e.g. 3D prints)
};

/**
 * Compute a simple shipping info object for the given listing.
 * Returns:
 *   { label, note, cost, tracked }
 */
function getShippingInfoForListing(listing) {
  if (!listing) {
    return {
      label: "Shipping",
      note: "Shipping will be calculated automatically at checkout.",
      cost: null,
      tracked: false,
    };
  }

  // Try to decide what kind of item this is
  var rawType = listing.type || listing.__typename || "";
  var productType = listing.productType || "";
  var fulfilmentType = listing.fulfilmentType || "";

  var typeUpper = String(rawType).toUpperCase();
  var prodUpper = String(productType).toUpperCase();
  var fulfilUpper = String(fulfilmentType).toUpperCase();

  var isCard =
    typeUpper === "CARD" ||
    listing.__typename === "CardListing" ||
    prodUpper === "CARD";

  var isPod = fulfilUpper === "POD";
  var isInternal = !isPod && !isCard;

  if (isCard) {
    return {
      label: "Tracked card shipping (UK)",
      note:
        "Cards are always shipped using a tracked service for buyer and seller protection.",
      cost: SHIPPING_ESTIMATES.CARD_TRACKED,
      tracked: true,
    };
  }

  if (isPod) {
    return {
      label: "Standard shipping (clothing / print-on-demand)",
      note: "Fulfilled and shipped directly by our print partner.",
      cost: SHIPPING_ESTIMATES.POD,
      tracked: false,
    };
  }

  // Default: internal fulfilment (e.g. 3D prints, merch you ship yourself)
  if (isInternal) {
    return {
      label: "Standard shipping (3D printed item)",
      note: "Packed and shipped directly by the seller as a tracked parcel.",
      cost: SHIPPING_ESTIMATES.INTERNAL,
      tracked: true,
    };
  }

  return {
    label: "Shipping",
    note: "Shipping will be calculated automatically at checkout.",
    cost: null,
    tracked: false,
  };
}

/* ---------------- Mock product (same as grid) ---------------- */

var MOCK_PRODUCT = {
  __typename: "ProductListing",
  id: "mock-product-001",
  type: "PRODUCT",
  price: 24.99,
  currency: "GBP",
  quantity: 1,
  allowOffers: false,
  status: "active",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),

  title: "SixByFive Sample Hoodie (Mock)",
  description: "Mock product used to preview the marketplace layout.",
  imageUrl: "https://placehold.co/800x800?text=SixByFive+Hoodie",
  imagesJson: [
    "https://placehold.co/800x800?text=SixByFive+Hoodie",
    "https://placehold.co/800x800?text=Back",
  ],
  colourVariantsJson: ["Black", "White", "Navy", "Grey", "Purple"],
  inventory: {
    id: "mock-inv",
    onHand: 10,
    reserved: 0,
    sold: 2,
  },
  seller: {
    id: "mock-user",
    username: "sixbyfive",
  },
  productType: "3D_PRINT",
};

/* ---------------- GraphQL query ---------------- */

var LISTING_QUERY = gql`
  query Listing($id: ID!) {
    listing(id: $id) {
      __typename
      id
      type
      price
      currency
      quantity
      allowOffers
      status
      createdAt
      updatedAt
      ... on CardListing {
        cardId
        condition
        variation
        seller { id username avatar }
      }
      ... on ProductListing {
        title
        description
        imageUrl
        imagesJson
        colourVariantsJson
        inventory { id onHand reserved sold }
        fulfilmentType
        fulfilmentProvider
        fulfilmentExternalId
        seller { id username avatar }
      }
    }
  }
`;

function ListingDetailInner() {
  var router = useRouter();

  // NEW: back button handler (uses history.back if possible, else /marketplace)
  function handleBackClick() {
    if (typeof window !== "undefined" && window.history && window.history.length > 1) {
      router.back();
    } else {
      router.push("/marketplace");
    }
  }

  // cart modal state
  var _useStateCart = useState(false);
  var isCartOpen = _useStateCart[0];
  var setIsCartOpen = _useStateCart[1];

  var routeParam = router && router.query ? router.query.slug : null;

  var id = extractIdFromParam(routeParam);
  var hasId = typeof id === "string" && id.length > 0;
  var isMockId = hasId && id === "mock-product-001";

  var _useQuery = useQuery(LISTING_QUERY, {
    skip: !hasId || isMockId,
    variables: { id: id },
    fetchPolicy: "cache-and-network",
  });
  var data = _useQuery.data;
  var loading = _useQuery.loading;
  var error = _useQuery.error;

  var listing = null;
  if (isMockId) {
    listing = MOCK_PRODUCT;
  } else if (data && data.listing) {
    listing = data.listing;
  }

  var isProduct = listing && listing.__typename === "ProductListing";

  if (listing) {
    // eslint-disable-next-line no-console
    console.log("[ListingDetail] listing", listing);
  }

  /* ---------- Colour + size options (using parsed metadata) ---------- */

  var colourOptions = useMemo(
    function () {
      if (!isProduct) return [];

      if (isMockId) {
        return [
          {
            id: "colour-black",
            value: "colour-black",
            name: "Black",
            subtitle: "Classic",
            imageUrl: "https://placehold.co/120x120/000000/FFFFFF?text=Black",
            images: [
              "https://placehold.co/800x800/000000/FFFFFF?text=Black+Front",
              "https://placehold.co/800x800/000000/FFFFFF?text=Black+Back",
            ],
          },
          {
            id: "colour-white",
            value: "colour-white",
            name: "White",
            subtitle: "Clean",
            imageUrl: "https://placehold.co/120x120/FFFFFF/000000?text=White",
            images: [
              "https://placehold.co/800x800/FFFFFF/000000?text=White+Front",
              "https://placehold.co/800x800/FFFFFF/000000?text=White+Back",
            ],
          },
          {
            id: "colour-navy",
            value: "colour-navy",
            name: "Navy",
            subtitle: "Deep blue",
            imageUrl: "https://placehold.co/120x120/001F3F/FFFFFF?text=Navy",
            images: [
              "https://placehold.co/800x800/001F3F/FFFFFF?text=Navy+Front",
              "https://placehold.co/800x800/001F3F/FFFFFF?text=Navy+Back",
            ],
          },
          {
            id: "colour-grey",
            value: "colour-grey",
            name: "Grey",
            subtitle: "Heather",
            imageUrl: "https://placehold.co/120x120/AAAAAA/000000?text=Grey",
            images: [
              "https://placehold.co/800x800/AAAAAA/000000?text=Grey+Front",
              "https://placehold.co/800x800/AAAAAA/000000?text=Grey+Back",
            ],
          },
          {
            id: "colour-purple",
            value: "colour-purple",
            name: "Purple",
            subtitle: "Limited",
            imageUrl: "https://placehold.co/120x120/5E2CA5/FFFFFF?text=Purple",
            images: [
              "https://placehold.co/800x800/5E2CA5/FFFFFF?text=Purple+Front",
              "https://placehold.co/800x800/5E2CA5/FFFFFF?text=Purple+Back",
            ],
          },
        ];
      }

      var coloursRaw = listing ? parseJsonList(listing.colourVariantsJson) : [];
      var allImages = listing ? parseJsonList(listing.imagesJson) : [];

      return coloursRaw.map(function (name, index) {
        var label = String(name || "Colour " + (index + 1));
        var colorKey = normalizeColorName(label);

        var matchedImages = allImages.filter(function (url) {
          var filename = getFilenameFromUrl(url);
          return filenameMatchesColor(filename, colorKey);
        });

        matchedImages.sort(function (a, b) {
          var fa = getFilenameFromUrl(a);
          var fb = getFilenameFromUrl(b);
          return orientationScore(fa) - orientationScore(fb);
        });

        return {
          id: "colour-" + index,
          value: "colour-" + index,
          name: label,
          subtitle: "",
          imageUrl: matchedImages[0] || null,
          images: matchedImages,
        };
      });
    },
    [isProduct, isMockId, listing]
  );

  // Only show size options for POD / clothing products.
  // 3D prints, stands, etc. should not have a size selector.
  var sizeOptions = useMemo(
    function () {
      if (!isProduct) return [];

      // 🔽 NEW: gate by fulfilmentType
      var fulfil = listing && listing.fulfilmentType;
      if (fulfil !== "POD") {
        // Non-POD items (e.g. 3D prints) -> no sizes
        return [];
      }

      return [
        { id: "size-s", value: "size-s", label: "S" },
        { id: "size-m", value: "size-m", label: "M" },
        { id: "size-l", value: "size-l", label: "L" },
        { id: "size-xl", value: "size-xl", label: "XL" },
        { id: "size-xxl", value: "size-xxl", label: "XXL" },
      ];
    },
    [isProduct, listing]
  );


  var _useStateColour = useState(null);
  var selectedColourId = _useStateColour[0];
  var setSelectedColourId = _useStateColour[1];

  var _useStateSize = useState(null);
  var selectedSizeId = _useStateSize[0];
  var setSelectedSizeId = _useStateSize[1];

  /* ----- default first colour / size for products (if available) ----- */

  useEffect(
    function () {
      if (!isProduct) return;
      if (!colourOptions.length) return;
      if (selectedColourId) return;
      setSelectedColourId(colourOptions[0].id || colourOptions[0].value);
    },
    [isProduct, colourOptions, selectedColourId]
  );

  useEffect(
    function () {
      if (!isProduct) return;
      if (!sizeOptions.length) return;
      if (selectedSizeId) return;
      setSelectedSizeId(sizeOptions[0].id || sizeOptions[0].value);
    },
    [isProduct, sizeOptions, selectedSizeId]
  );

  /* ----- support option object OR raw id/value from selectors ----- */

  function handleColourSelect(optOrId) {
    if (!optOrId) return;
    var nextId =
      typeof optOrId === "string"
        ? optOrId
        : optOrId.id || optOrId.value || null;
    if (!nextId) return;
    setSelectedColourId(nextId);
  }

  function handleSizeSelect(optOrId) {
    if (!optOrId) return;
    var nextId =
      typeof optOrId === "string"
        ? optOrId
        : optOrId.id || optOrId.value || null;
    if (!nextId) return;
    setSelectedSizeId(nextId);
  }

  var selectedColour = useMemo(
    function () {
      if (!selectedColourId || !colourOptions.length) return null;
      for (var i = 0; i < colourOptions.length; i++) {
        if (
          colourOptions[i].id === selectedColourId ||
          colourOptions[i].value === selectedColourId
        ) {
          return colourOptions[i];
        }
      }
      return null;
    },
    [selectedColourId, colourOptions]
  );

  var selectedSize = useMemo(
    function () {
      if (!selectedSizeId || !sizeOptions.length) return null;
      for (var i = 0; i < sizeOptions.length; i++) {
        if (
          sizeOptions[i].id === selectedSizeId ||
          sizeOptions[i].value === selectedSizeId
        ) {
          return sizeOptions[i];
        }
      }
      return null;
    },
    [selectedSizeId, sizeOptions]
  );

  // Active hero image index for the current gallery
  var _useStateImage = useState(0);
  var activeImageIndex = _useStateImage[0];
  var setActiveImageIndex = _useStateImage[1];

  useEffect(
    function () {
      setActiveImageIndex(0);
    },
    [id, selectedColourId]
  );

  /* ---------- Shared styling classes ---------- */

  var containerCls = "mx-auto max-w-7xl px-4 py-8";
  var titleCls =
    "text-2xl font-bold text-light-strong dark:text-dark-strong mb-1";
  var subtitleCls =
    "text-sm text-light-textMuted dark:text-dark-textMuted mb-4";
  var gridCls =
    "grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6 mt-4";

  var imgWrapperCls =
    "rounded-2xl border border-light-border dark:border-dark-border " +
    "bg-light-elevated dark:bg-dark-elevated aspect-square overflow-hidden flex items-center justify-center";
  var imgCls = "w-full h-full object-cover";

  var priceCls =
    "text-2xl font-semibold text-light-strong dark:text-dark-strong";
  var sellerCls =
    "text-sm text-light-textMuted dark:text-dark-textMuted";

  var panelCls =
    "rounded-2xl border border-light-border dark:border-dark-border " +
    "bg-light-elevated dark:bg-dark-elevated p-4 flex flex-col gap-3";

  var sectionLabelCls =
    "text-xs font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted";

  /* ---------- Build main content node ---------- */

  var contentNode;

  if (!hasId) {
    contentNode = React.createElement(
      "p",
      { className: subtitleCls },
      "No listing id provided."
    );
  } else if (error && !isMockId) {
    contentNode = React.createElement(
      "p",
      { className: subtitleCls },
      "Error loading listing: " + error.message
    );
  } else if (loading && !data && !isMockId) {
    contentNode = React.createElement(
      "p",
      { className: subtitleCls },
      "Loading listing…"
    );
  } else if (!listing) {
    contentNode = React.createElement(
      "p",
      { className: subtitleCls },
      "Listing not found."
    );
  } else {
    var currency = listing.currency || "GBP";
    var priceText;
    try {
      priceText = new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: currency,
      }).format(Number(listing.price) || 0);
    } catch (_e) {
      var sym = currency.toUpperCase() === "GBP" ? "£" : "";
      priceText = sym + (Number(listing.price) || 0).toFixed(2);
    }

    var isProd = isProduct;
    var title;
    var subtitleMain = "";
    var description = "";
    var sellerName =
      listing.seller && (listing.seller.username || listing.seller.id);

    var imagesArray = parseJsonList(listing.imagesJson);

    var colourImages =
      selectedColour &&
      Array.isArray(selectedColour.images) &&
      selectedColour.images.length >= 2
        ? selectedColour.images
        : null;

    var effectiveImagesArray =
      colourImages && colourImages.length ? colourImages : imagesArray;

    var primaryImage =
      listing.imageUrl ||
      (effectiveImagesArray[activeImageIndex] ||
        effectiveImagesArray[0] ||
        imagesArray[0] ||
        null);

    if (isProd) {
      title = listing.title || "Product";
      description = listing.description || "";
    } else {
      var parts = [];
      if (listing.cardId) parts.push(listing.cardId);
      if (listing.variation) parts.push(listing.variation);
      title = parts.length ? parts.join(" • ") : "Card listing";
      if (listing.condition) subtitleMain = listing.condition;
    }

    var uiListingBase = Object.assign({}, listing);

    uiListingBase.quantity =
      uiListingBase.quantity && uiListingBase.quantity > 0
        ? uiListingBase.quantity
        : 1;

    if (uiListingBase.inventory) {
      uiListingBase.inventory = Object.assign({}, uiListingBase.inventory, {
        onHand:
          uiListingBase.inventory.onHand &&
          uiListingBase.inventory.onHand > 0
            ? uiListingBase.inventory.onHand
            : 999,
      });
    }

    // inferred productType mapping
    // - POD       -> CLOTHING
    // - otherwise -> 3D_PRINT
    var inferredType = "3D_PRINT";
    if (listing.fulfilmentType === "POD") inferredType = "CLOTHING";

    var detailsListing = isProd
      ? Object.assign({}, uiListingBase, {
          productType: uiListingBase.productType || inferredType,
          imagesJson: imagesArray,
          colourVariantsJson: parseJsonList(uiListingBase.colourVariantsJson),
        })
      : uiListingBase;

    // SHIPPING: compute display info for this listing
    var shippingInfo = getShippingInfoForListing(detailsListing);
    var shippingCurrency = (listing.currency || "GBP").toUpperCase();
    var shippingPriceText = null;
    if (shippingInfo.cost != null) {
      try {
        shippingPriceText = new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency: shippingCurrency,
        }).format(Number(shippingInfo.cost) || 0);
      } catch (_e2) {
        var sSym = shippingCurrency === "GBP" ? "£" : "";
        shippingPriceText =
          sSym + (Number(shippingInfo.cost) || 0).toFixed(2);
      }
    }

    contentNode = React.createElement(
      React.Fragment,
      null,

      React.createElement(
        "div",
        null,
        React.createElement("h1", { className: titleCls }, title),
        subtitleMain &&
          React.createElement("p", { className: subtitleCls }, subtitleMain),
        isMockId &&
          React.createElement(
            "p",
            {
              className:
                "mt-1 text-xs text-light-textMuted dark:text-dark-textMuted",
            },
            "This is a mock product used for preview."
          )
      ),

      React.createElement(
        "div",
        { className: gridCls },

        // LEFT: image + thumbnails
        React.createElement(
          "div",
          null,
          React.createElement(
            "div",
            { className: imgWrapperCls },
            primaryImage
              ? React.createElement("img", {
                  src: primaryImage,
                  alt: title,
                  className: imgCls,
                })
              : React.createElement(
                  "div",
                  {
                    className:
                      "text-sm text-light-textMuted dark:text-dark-textMuted",
                  },
                  isProd ? "No image" : "Card"
                )
          ),
          effectiveImagesArray.length > 1 &&
            React.createElement(
              "div",
              {
                className:
                  "mt-3 flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-light-border dark:scrollbar-thumb-dark-border",
              },
              effectiveImagesArray.map(function (src, idx) {
                return React.createElement(
                  "button",
                  {
                    key: src + "-" + idx,
                    type: "button",
                    onClick: function () {
                      setActiveImageIndex(idx);
                    },
                    className:
                      "h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden border " +
                      (idx === activeImageIndex
                        ? "border-light-accent dark:border-dark-accent"
                        : "border-light-border dark:border-dark-border"),
                  },
                  React.createElement("img", {
                    src: src,
                    alt: "Thumbnail " + (idx + 1),
                    className: "h-full w-full object-cover",
                  })
                );
              })
            )
        ),

        // RIGHT: options + summary + description
        React.createElement(
          "div",
          { className: "flex flex-col gap-4" },

          (colourOptions.length > 0 || sizeOptions.length > 0) &&
            React.createElement(
              "div",
              {
                className:
                  "rounded-2xl border border-light-border dark:border-dark-border " +
                  "bg-light-surface dark:bg-dark-surface p-4 flex flex-col gap-4",
              },
              colourOptions.length > 0 &&
                React.createElement(ColorSelector, {
                  options: colourOptions,
                  selectedId: selectedColourId,
                  onSelect: handleColourSelect,
                  label: "Colour",
                  maxVisible: 4,
                }),
              sizeOptions.length > 0 &&
                React.createElement(SizeSelector, {
                  options: sizeOptions,
                  selectedId: selectedSizeId,
                  onSelect: handleSizeSelect,
                  label: "Size",
                })
            ),

          React.createElement(
            "div",
            { className: panelCls },
            React.createElement("div", { className: sectionLabelCls }, "Summary"),
            React.createElement(
              "div",
              { className: "flex items-baseline justify-between gap-2" },
              React.createElement("div", { className: priceCls }, priceText),
              sellerName &&
                React.createElement(
                  "div",
                  { className: sellerCls },
                  "Seller: ",
                  sellerName
                )
            ),
            (selectedColour || selectedSize) &&
              React.createElement(
                "div",
                {
                  className:
                    "mt-1 text-xs text-light-textMuted dark:text-dark-textMuted space-y-0.5",
                },
                selectedColour &&
                  React.createElement(
                    "p",
                    null,
                    "Colour: ",
                    selectedColour.name || selectedColour.id
                  ),
                selectedSize &&
                  React.createElement(
                    "p",
                    null,
                    "Size: ",
                    selectedSize.label || selectedSize.id
                  )
              ),

            // SHIPPING: summary section
            React.createElement(
              "div",
              {
                className:
                  "mt-3 rounded-xl bg-light-surface/60 dark:bg-dark-surface/60 px-3 py-2 text-xs",
              },
              React.createElement(
                "p",
                {
                  className:
                    "font-semibold text-light-strong dark:text-dark-strong",
                },
                shippingInfo.label
              ),
              shippingPriceText &&
                React.createElement(
                  "p",
                  {
                    className:
                      "mt-0.5 text-light-text dark:text-dark-text font-medium",
                  },
                  "Estimated shipping for this item: ",
                  shippingPriceText,
                  " ",
                  shippingCurrency
                ),
              !shippingPriceText &&
                React.createElement(
                  "p",
                  {
                    className:
                      "mt-0.5 text-light-text dark:text-dark-text font-medium",
                  },
                  "Shipping is calculated automatically at checkout based on your basket."
                ),
              React.createElement(
                "p",
                {
                  className:
                    "mt-0.5 text-light-textMuted dark:text-dark-textMuted",
                },
                shippingInfo.note
              ),
              shippingInfo.tracked &&
                React.createElement(
                  "p",
                  {
                    className:
                      "mt-0.5 text-[11px] text-light-textMuted dark:text-dark-textMuted",
                  },
                  "Cards and 3D printed items are sent using a tracked service."
                )
            ),

            React.createElement(
              "div",
              { className: "mt-2" },
              React.createElement(BuyButton, {
                listing: detailsListing,
                defaultQty: 1,
                selectedColour: selectedColour,
                selectedSize: selectedSize,
              })
            )
          ),

          (description || !isProd) &&
            React.createElement(
              "div",
              {
                className:
                  "rounded-2xl border border-light-border dark:border-dark-border " +
                  "bg-light-surface dark:bg-dark-surface p-4",
              },
              React.createElement(
                "div",
                { className: sectionLabelCls },
                isProd ? "Description" : "Details"
              ),
              description
                ? React.createElement(
                    "p",
                    {
                      className:
                        "mt-1 text-sm text-light-text dark:text-dark-text whitespace-pre-line",
                    },
                    description
                  )
                : React.createElement(
                    "p",
                    {
                      className:
                        "mt-1 text-sm text-light-textMuted dark:text-dark-textMuted",
                    },
                    "No additional details provided."
                  )
            )
        )
      ),

      isProd &&
        React.createElement(
          "div",
          { className: "mt-6" },
          React.createElement(ProductDetailsSection, { listing: detailsListing })
        )
    );
  }

  return React.createElement(
    Layout,
    null,
    React.createElement(
      "div",
      { className: containerCls },

      // NEW: back button + secondary header in one row
      React.createElement(
        "div",
        {
          className:
            "mb-4 flex items-center justify-between gap-3",
        },
        React.createElement(
          "button",
          {
            type: "button",
            onClick: handleBackClick,
            className:
              "inline-flex items-center gap-1 rounded-full border border-light-border dark:border-dark-border " +
              "bg-light-surface dark:bg-dark-surface px-3 py-1.5 text-xs font-medium " +
              "text-light-text dark:text-dark-text hover:bg-light-alt dark:hover:bg-dark-alt",
          },
          React.createElement(
            "span",
            { className: "text-base leading-none" },
            "←"
          ),
          React.createElement("span", null, "Back to marketplace")
        ),
        React.createElement(SecondaryHeader, {
          onCartClick: function () {
            setIsCartOpen(true);
          },
        })
      ),

      contentNode,

      React.createElement(CartModal, {
        isOpen: isCartOpen,
        onClose: function () {
          setIsCartOpen(false);
        },
      })
    )
  );
}

var ListingDetailPage = dynamic(
  function () {
    return Promise.resolve(ListingDetailInner);
  },
  { ssr: false }
);

export default ListingDetailPage;
