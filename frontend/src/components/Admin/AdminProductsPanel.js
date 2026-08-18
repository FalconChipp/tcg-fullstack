// frontend/src/components/Admin/AdminProductsPanel.js
// -----------------------------------------------------------------------------
// Admin panel: create, list & edit marketplace product listings.
// Uses adminCreateProductListing + adminUpdateProductListing +
// listings(type: PRODUCT, status: active) on the backend.
// Supports multiple images + colour variants via JSON fields.
// Uses deleteListing (soft delete: status = "removed") for removal.
// "Add new product" form is hidden by default and expandable.
// -----------------------------------------------------------------------------

"use client";

import React, { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
  ADMIN_CREATE_PRODUCT_LISTING,
  ADMIN_UPDATE_PRODUCT_LISTING,
  ADMIN_PRODUCT_LISTINGS_QUERY as ADMIN_PRODUCT_LISTINGS,
  ADMIN_DELETE_PRODUCT_LISTING as DELETE_LISTING,
} from '@/graphql/admin';

const DEFAULT_STATUS = "active"; // ListingStatus enum in schema
const DEFAULT_FULFILMENT = "INTERNAL"; // must match Listing.fulfilmentType enum
const DEFAULT_CURRENCY = "GBP";

const PAGE_SIZE = 50;

// Small helper to coerce JSON-ish values into an array of strings
function toStringArray(maybeJson) {
  if (!maybeJson) return [];
  if (Array.isArray(maybeJson)) return maybeJson.map(String);

  if (typeof maybeJson === "string") {
    try {
      const parsed = JSON.parse(maybeJson);
      if (Array.isArray(parsed)) return parsed.map(String);
      return [];
    } catch {
      return [];
    }
  }

  return [];
}

export default function AdminProductsPanel() {
  // --- Form visibility (create) ---------------------------------------------

  const [showCreateForm, setShowCreateForm] = useState(false);

  // --- Create form state ----------------------------------------------------

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [quantity, setQuantity] = useState("1");

  // Primary image (hero / thumbnail)
  const [imageUrl, setImageUrl] = useState("");

  // Extra images + colours as multi-line text
  const [imageUrlsRaw, setImageUrlsRaw] = useState("");
  const [colourVariantsRaw, setColourVariantsRaw] = useState("");

  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [fulfilmentType, setFulfilmentType] = useState(DEFAULT_FULFILMENT); // INTERNAL / POD
  const [fulfilmentProvider, setFulfilmentProvider] = useState("");
  const [externalFulfilmentId, setExternalFulfilmentId] = useState("");
  const [notes, setNotes] = useState("");

  const [createdProduct, setCreatedProduct] = useState(null);

  // --- EDITING STATE (NEW) --------------------------------------------------
  // When a product row is being edited, we store it here plus textareas.

  const [editingProduct, setEditingProduct] = useState(null);
  const [editImageUrlsRaw, setEditImageUrlsRaw] = useState("");
  const [editColourVariantsRaw, setEditColourVariantsRaw] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // --- Create mutation ------------------------------------------------------

  const [createProduct, { loading: creating, error: createError }] =
    useMutation(ADMIN_CREATE_PRODUCT_LISTING, {
      onCompleted: (data) => {
        const created = data?.adminCreateProductListing || null;
        setCreatedProduct(created);
      },
    });

  // --- Update mutation (NEW) -----------------------------------------------

  const [updateProduct, { loading: updating, error: updateError }] =
    useMutation(ADMIN_UPDATE_PRODUCT_LISTING, {
      onCompleted: () => {
        setEditingProduct(null);
        setEditImageUrlsRaw("");
        setEditColourVariantsRaw("");
        setEditNotes("");
        refetchListings();
      },
    });

  // --- Delete mutation (uses shared deleteListing) --------------------------

  const [deleteListingMutation, { loading: deleting }] = useMutation(
    DELETE_LISTING,
    {
      onCompleted: () => {
        refetchListings();
      },
    }
  );

  // --- Listings query -------------------------------------------------------
  // IMPORTANT: we now pass status: "active" so removed/sold/etc are excluded.

  const {
    data: listData,
    loading: loadingList,
    error: listError,
    refetch: refetchListings,
  } = useQuery(ADMIN_PRODUCT_LISTINGS, {
    variables: { limit: PAGE_SIZE, offset: 0, status: "active" },
    fetchPolicy: "cache-first",
  });

  const rawListings = listData?.listings ?? [];

  // Only keep ProductListing and normalise JSON fields into arrays
  const products =
    rawListings
      .filter((l) => l.__typename === "ProductListing")
      .map((p) => ({
        ...p,
        imagesJson: toStringArray(p.imagesJson),
        colourVariantsJson: toStringArray(p.colourVariantsJson),
      })) ?? [];

  // --- Handlers: CREATE -----------------------------------------------------

  const handleSubmit = (e) => {
    e.preventDefault();

    // Parse numeric fields safely
    const parsedPrice = price.trim() ? parseFloat(price.trim()) : 0;
    const parsedQuantity = quantity.trim()
      ? parseInt(quantity.trim(), 10)
      : 1;

    // Build fulfilment meta (lightweight – just notes for now)
    const meta = notes.trim() ? { notes: notes.trim() } : null;

    // Build images array:
    //  - primary image first (if provided)
    //  - then any additional unique URLs from the textarea
    const imagesArray = [];

    if (imageUrl.trim()) {
      imagesArray.push(imageUrl.trim());
    }

    if (imageUrlsRaw.trim()) {
      imageUrlsRaw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((url) => {
          if (!imagesArray.includes(url)) {
            imagesArray.push(url);
          }
        });
    }

    // Build colour variants array from textarea
    const coloursArray = colourVariantsRaw.trim()
      ? colourVariantsRaw
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      : [];

    createProduct({
      variables: {
        input: {
          title: title.trim(),
          description: description.trim() || null,
          price: isNaN(parsedPrice) ? 0 : parsedPrice,
          currency: currency.trim() || DEFAULT_CURRENCY,
          quantity: Number.isNaN(parsedQuantity) ? 1 : parsedQuantity,
          imageUrl: imageUrl.trim() || null, // primary image

          // These must line up with Listing model:
          // fulfilmentType: 'INTERNAL' | 'POD'
          fulfilmentType: fulfilmentType || null,
          fulfilmentProvider: fulfilmentProvider.trim() || null,
          fulfilmentExternalId: externalFulfilmentId.trim() || null,

          // JSON metadata for multiple images + colours
          imagesJson: imagesArray.length ? imagesArray : null,
          colourVariantsJson: coloursArray.length ? coloursArray : null,
        },
      },
    }).then(() => {
      // Refresh the list so the new product appears
      refetchListings();
    });
  };

  // --- Handlers: DELETE -----------------------------------------------------

  const handleDelete = (product) => {
    if (
      !confirm(
        `Remove product listing ${product.id} (“${product.title}”)? This will mark the listing as removed.`
      )
    ) {
      return;
    }

    deleteListingMutation({
      variables: { id: product.id },
    });
  };

  // --- Handlers: EDIT (NEW) -------------------------------------------------

  const handleStartEdit = (product) => {
    setEditingProduct({
      ...product,
      // Ensure we have simple scalars for binding
      title: product.title || "",
      description: product.description || "",
      imageUrl: product.imageUrl || "",
      price:
        typeof product.price === "number"
          ? product.price
          : Number(product.price) || 0,
      currency: product.currency || DEFAULT_CURRENCY,
      quantity:
        typeof product.quantity === "number"
          ? product.quantity
          : Number(product.quantity) || 1,
      fulfilmentType: product.fulfilmentType || DEFAULT_FULFILMENT,
      fulfilmentProvider: product.fulfilmentProvider || "",
      fulfilmentExternalId: product.fulfilmentExternalId || "",
    });

    setEditImageUrlsRaw(
      (product.imagesJson || []).map((u) => String(u)).join("\n")
    );
    setEditColourVariantsRaw(
      (product.colourVariantsJson || []).map((c) => String(c)).join("\n")
    );
    // We don't currently fetch fulfilmentMetaJson/notes; start empty.
    setEditNotes("");
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setEditImageUrlsRaw("");
    setEditColourVariantsRaw("");
    setEditNotes("");
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    const parsedPrice =
      typeof editingProduct.price === "string"
        ? parseFloat(editingProduct.price || "0")
        : Number(editingProduct.price) || 0;

    const parsedQuantity =
      typeof editingProduct.quantity === "string"
        ? parseInt(editingProduct.quantity || "1", 10)
        : Number(editingProduct.quantity) || 1;

    const meta = editNotes.trim() ? { notes: editNotes.trim() } : null;

    const imagesArray = [];
    if (editingProduct.imageUrl && editingProduct.imageUrl.trim()) {
      imagesArray.push(editingProduct.imageUrl.trim());
    }

    if (editImageUrlsRaw.trim()) {
      editImageUrlsRaw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((url) => {
          if (!imagesArray.includes(url)) {
            imagesArray.push(url);
          }
        });
    }

    const coloursArray = editColourVariantsRaw.trim()
      ? editColourVariantsRaw
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      : [];

    updateProduct({
      variables: {
        id: editingProduct.id,
        input: {
          title: (editingProduct.title || "").trim(),
          description:
            (editingProduct.description || "").trim() || null,
          price: isNaN(parsedPrice) ? 0 : parsedPrice,
          currency:
            (editingProduct.currency || "").trim() || DEFAULT_CURRENCY,
          quantity: Number.isNaN(parsedQuantity) ? 1 : parsedQuantity,
          imageUrl:
            (editingProduct.imageUrl || "").trim() || null,

          fulfilmentType: editingProduct.fulfilmentType || null,
          fulfilmentProvider:
            (editingProduct.fulfilmentProvider || "").trim() || null,
          fulfilmentExternalId:
            (editingProduct.fulfilmentExternalId || "").trim() || null,

          imagesJson: imagesArray.length ? imagesArray : null,
          colourVariantsJson: coloursArray.length ? coloursArray : null,
        },
      },
    });
  };

  const hasAnyError = createError || listError || updateError;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-50">
            Products
          </h2>
          <p className="text-xs text-neutral-500">
            Create, edit and manage product listings (POD or internal store
            items).
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetchListings()}
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border border-white/20 text-neutral-50 hover:bg-white/10"
        >
          Refresh list
        </button>
      </div>

      {/* Add new product (collapsible) */}
      <div className="border border-white/5 rounded-xl bg-black/40">
        {/* Collapsible header */}
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div>
            <h3 className="text-xs font-semibold text-neutral-50">
              Add new product
            </h3>
            <p className="text-[11px] text-neutral-500">
              Create a new product listing for the marketplace.
            </p>
          </div>
          <span className="ml-4 text-[11px] text-neutral-300 border border-white/15 rounded-md px-2 py-1 bg-white/5">
            {showCreateForm ? "Hide form" : "Show form"}
          </span>
        </button>

        {/* Collapsible body */}
        {showCreateForm && (
          <div className="border-t border-white/5 p-4 md:p-5">
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-200">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="SixByFive Hoodie – Navy / Large"
                  className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-200">
                  Description (optional)
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description of the product, print details, fit notes, etc."
                  className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                />
              </div>

              {/* Price / currency / quantity */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-200">
                    Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="29.99"
                    className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-200">
                    Currency
                  </label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    placeholder="GBP"
                    className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-200">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="1"
                    className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                  />
                </div>
              </div>

              {/* Primary image URL */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-200">
                  Primary image URL (optional)
                </label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…/hoodie-front.png"
                  className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                />
                <p className="text-[11px] text-neutral-500">
                  This is the main thumbnail / hero image.
                </p>
              </div>

              {/* Additional images + colour variants */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-200">
                    Additional image URLs (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={imageUrlsRaw}
                    onChange={(e) => setImageUrlsRaw(e.target.value)}
                    placeholder={
                      "https://…/hoodie-back.png\nhttps://…/hoodie-detail.png"
                    }
                    className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                  />
                  <p className="text-[11px] text-neutral-500">
                    These, together with the primary image, are stored as{" "}
                    <code>imagesJson</code>.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-200">
                    Colour variants (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={colourVariantsRaw}
                    onChange={(e) => setColourVariantsRaw(e.target.value)}
                    placeholder={"Navy\nBlack\nHeather Grey"}
                    className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                  />
                  <p className="text-[11px] text-neutral-500">
                    e.g. <code>Navy</code>, <code>Black</code>,{" "}
                    <code>White</code>. Stored as{" "}
                    <code>colourVariantsJson</code>.
                  </p>
                </div>
              </div>

              {/* Status + Fulfilment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-200">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled
                    className="w-full px-3 py-2 text-xs rounded-md bg-black/40 border border-white/15 text-neutral-400"
                  >
                    {/* ListingStatus enum: active, sold, removed, cancelled */}
                    <option value="active">Active</option>
                  </select>
                  <p className="text-[11px] text-neutral-500">
                    Status is currently fixed to{" "}
                    <span className="font-semibold">active</span> on create.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-200">
                    Fulfilment type
                  </label>
                  <select
                    value={fulfilmentType}
                    onChange={(e) => setFulfilmentType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-white/40"
                  >
                    {/* Must align with Listing model values */}
                    <option value="INTERNAL">Internal</option>
                    <option value="POD">Print-on-demand (POD)</option>
                  </select>
                </div>
              </div>

              {/* Fulfilment provider / external ID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-200">
                    Fulfilment provider (optional)
                  </label>
                  <input
                    type="text"
                    value={fulfilmentProvider}
                    onChange={(e) => setFulfilmentProvider(e.target.value)}
                    placeholder="Inkthreadables"
                    className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-200">
                    External fulfilment ID (optional)
                  </label>
                  <input
                    type="text"
                    value={externalFulfilmentId}
                    onChange={(e) => setExternalFulfilmentId(e.target.value)}
                    placeholder="Inkthreadables product ID, etc."
                    className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                  />
                </div>
              </div>

              {/* Notes -> fulfilmentMetaJson */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-200">
                  Internal notes (optional)
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any internal notes about this product or fulfilment…"
                  className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                />
                <p className="text-[11px] text-neutral-500">
                  Notes are stored inside <code>fulfilmentMetaJson</code> for
                  now.
                </p>
              </div>

              {/* Errors from create / list / update */}
              {hasAnyError && (
                <div className="border border-red-500/40 rounded-md bg-red-950/40 px-3 py-2">
                  <p className="text-[11px] text-red-200">
                    {createError?.message ||
                      listError?.message ||
                      updateError?.message}
                  </p>
                </div>
              )}

              {/* Submit + status */}
              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="submit"
                  disabled={creating || !title.trim() || !price.trim()}
                  className="inline-flex items-center rounded-md px-4 py-2 text-xs font-medium border border-white/30 text-neutral-50 bg-white/5 hover:bg-white/10 disabled:opacity-60"
                >
                  {creating ? "Creating…" : "Create product listing"}
                </button>

                {createdProduct && (
                  <p className="text-[11px] text-emerald-300">
                    Created product listing{" "}
                    <span className="font-mono">{createdProduct.id}</span>{" "}
                    ({createdProduct.title})
                  </p>
                )}
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Existing products list */}
      <div className="border border-white/5 rounded-xl bg-black/40">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-neutral-50">
              Existing product listings
            </h3>
            <p className="text-[11px] text-neutral-500">
              Showing up to {PAGE_SIZE} most recent product listings.
            </p>
          </div>
          {loadingList && (
            <span className="text-[11px] text-neutral-400">
              Loading…
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-white/5 text-neutral-300">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Title</th>
                <th className="px-3 py-2 text-left font-semibold">Price</th>
                <th className="px-3 py-2 text-left font-semibold">Qty</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">
                  Fulfilment
                </th>
                <th className="px-3 py-2 text-left font-semibold">
                  Colours
                </th>
                <th className="px-3 py-2 text-left font-semibold">
                  Images
                </th>
                <th className="px-3 py-2 text-left font-semibold">
                  External ID
                </th>
                <th className="px-3 py-2 text-left font-semibold">
                  Created
                </th>
                <th className="px-3 py-2 text-left font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && !loadingList && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-3 py-4 text-center text-[11px] text-neutral-500"
                  >
                    No product listings found yet.
                  </td>
                </tr>
              )}

              {products.map((p) => {
                const colours = p.colourVariantsJson;
                const images = p.imagesJson;

                const isEditing = editingProduct && editingProduct.id === p.id;

                return (
                  <tr
                    key={p.id}
                    className={`border-t border-white/5 transition ${
                      isEditing ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col">
                        <span className="text-xs text-neutral-50">
                          {p.title || "—"}
                        </span>
                        <span className="text-[10px] text-neutral-500">
                          {p.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="text-[11px] text-neutral-300">
                        {p.currency || "GBP"}{" "}
                        {typeof p.price === "number"
                          ? p.price.toFixed(2)
                          : p.price ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="text-[11px] text-neutral-300">
                        {p.quantity ?? 0}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="text-[11px] text-neutral-300">
                        {p.status || "active"}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col">
                        <span className="text-[11px] text-neutral-300">
                          {p.fulfilmentType || "—"}
                        </span>
                        {p.fulfilmentProvider && (
                          <span className="text-[10px] text-neutral-500">
                            {p.fulfilmentProvider}
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Colours */}
                    <td className="px-3 py-2 align-top">
                      {colours && colours.length ? (
                        <div className="flex flex-wrap gap-1">
                          {colours.slice(0, 4).map((c) => (
                            <span
                              key={c}
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] bg.white/5 bg-white/5 text-neutral-100"
                            >
                              {c}
                            </span>
                          ))}
                          {colours.length > 4 && (
                            <span className="text-[10px] text-neutral-400">
                              +{colours.length - 4} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-neutral-500">
                          —
                        </span>
                      )}
                    </td>
                    {/* Images */}
                    <td className="px-3 py-2 align-top">
                      {images && images.length ? (
                        <span className="text-[11px] text-neutral-300">
                          {images.length} image
                          {images.length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="text-[11px] text-neutral-300">
                        {p.fulfilmentExternalId || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="text-[11px] text-neutral-400">
                        {p.createdAt
                          ? new Date(p.createdAt).toLocaleDateString()
                          : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top space-x-2">
                      <button
                        type="button"
                        onClick={() =>
                          isEditing ? handleCancelEdit() : handleStartEdit(p)
                        }
                        className="px-2 py-1 rounded-md border border-blue-400/60 text-[10px] text-blue-100 hover:bg-blue-500/20"
                      >
                        {isEditing ? "Cancel" : "Edit"}
                      </button>
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => handleDelete(p)}
                        className="px-2 py-1 rounded-md border border-red-400/60 text-[10px] text-red-200 hover:bg-red-500/20 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Inline edit form (NEW) */}
        {editingProduct && (
          <div className="border-t border-white/5 p-4 md:p-5 bg-black/60">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-semibold text-neutral-50">
                  Edit product
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Updating listing{" "}
                  <span className="font-mono">{editingProduct.id}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-[11px] text-neutral-400 hover:text-neutral-100"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-200">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={editingProduct.title}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-200">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editingProduct.description}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                />
              </div>

              {/* Price / currency / quantity */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-200">
                    Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingProduct.price}
                    onChange={(e) =>
                      setEditingProduct((prev) => ({
                        ...prev,
                        price: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-200">
                    Currency
                  </label>
                  <input
                    type="text"
                    value={editingProduct.currency}
                    onChange={(e) =>
                      setEditingProduct((prev) => ({
                        ...prev,
                        currency: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-200">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingProduct.quantity}
                    onChange={(e) =>
                      setEditingProduct((prev) => ({
                        ...prev,
                        quantity: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                  />
                </div>
              </div>

              {/* Primary image URL */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-200">
                  Primary image URL
                </label>
                <input
                  type="text"
                  value={editingProduct.imageUrl}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({
                      ...prev,
                      imageUrl: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                />
              </div>

              {/* Additional images + colour variants */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-200">
                    Additional image URLs (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={editImageUrlsRaw}
                    onChange={(e) => setEditImageUrlsRaw(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                  />
                  <p className="text-[11px] text-neutral-500">
                    Stored together with primary image in{" "}
                    <code>imagesJson</code>.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-200">
                    Colour variants (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={editColourVariantsRaw}
                    onChange={(e) => setEditColourVariantsRaw(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                  />
                  <p className="text-[11px] text-neutral-500">
                    Stored as <code>colourVariantsJson</code>.
                  </p>
                </div>
              </div>

              {/* Fulfilment type / provider / external id */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-200">
                    Fulfilment type
                  </label>
                  <select
                    value={editingProduct.fulfilmentType}
                    onChange={(e) =>
                      setEditingProduct((prev) => ({
                        ...prev,
                        fulfilmentType: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-white/40"
                  >
                    <option value="INTERNAL">Internal</option>
                    <option value="POD">Print-on-demand (POD)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-200">
                    Fulfilment provider
                  </label>
                  <input
                    type="text"
                    value={editingProduct.fulfilmentProvider}
                    onChange={(e) =>
                      setEditingProduct((prev) => ({
                        ...prev,
                        fulfilmentProvider: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-200">
                    External fulfilment ID
                  </label>
                  <input
                    type="text"
                    value={editingProduct.fulfilmentExternalId}
                    onChange={(e) =>
                      setEditingProduct((prev) => ({
                        ...prev,
                        fulfilmentExternalId: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                  />
                </div>
              </div>

              {/* Notes for fulfilmentMetaJson */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-200">
                  Internal notes (fulfilmentMetaJson)
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Any internal notes about this product or fulfilment…"
                  className="w-full px-3 py-2 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/40"
                />
              </div>

              {/* Errors */}
              {hasAnyError && (
                <div className="border border-red-500/40 rounded-md bg-red-950/40 px-3 py-2">
                  <p className="text-[11px] text-red-200">
                    {createError?.message ||
                      listError?.message ||
                      updateError?.message}
                  </p>
                </div>
              )}

              {/* Save / cancel */}
              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="submit"
                  disabled={updating}
                  className="inline-flex items-center rounded-md px-4 py-2 text-xs font-medium border border-white/30 text-neutral-50 bg-white/5 hover:bg-white/10 disabled:opacity-60"
                >
                  {updating ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-[11px] text-neutral-400 hover:text-neutral-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
