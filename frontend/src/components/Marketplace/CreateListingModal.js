// frontend/src/components/Marketplace/CreateListingModal.js

"use client";

import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { gql } from "@apollo/client";
import { AuthContext } from "@/components/Auth/AuthProvider";

// ─── GQL ─────────────────────────────────────────────────────────────────────

const MY_COLLECTION_QUERY = gql`
  query MyCollectionForListing {
    myCollection {
      cardId
      quantity
      condition
      variation
      card {
        id
        name
        number
        rarity
        set { name releaseDate }
        images { small large }
      }
    }
  }
`;

const PRICE_SUGGESTION_QUERY = gql`
  query PriceSuggestion($cardId: String!) {
    listings(type: CARD, status: ACTIVE, cardId: $cardId, limit: 30) {
      price
      condition
    }
  }
`;

const CARD_DETAIL_QUERY = gql`
  query CardDetail($id: ID!) {
    cardsearchCard(id: $id) {
      variants { key label default }
      latestPrices { variation currency gbp market }
    }
  }
`;

const CREATE_LISTING_MUTATION = gql`
  mutation CreateListing($input: CreateListingInput!) {
    createListing(input: $input) {
      id
      cardId
      price
      currency
      condition
      variation
      status
      createdAt
    }
  }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { gqlFetch } from "@/utils/apiClient";

const EMBARGO_DAYS = 14;

function getEmbargoInfo(releaseDate) {
  if (!releaseDate) return null;
  const released   = new Date(releaseDate);
  const embargoEnd = new Date(released.getTime() + EMBARGO_DAYS * 24 * 60 * 60 * 1000);
  const now        = new Date();
  if (now >= embargoEnd) return null;
  const daysLeft = Math.ceil((embargoEnd - now) / (1000 * 60 * 60 * 24));
  return { endsAt: embargoEnd.toISOString().slice(0, 10), daysLeft };
}

function rarityToVariation(rarity) {
  if (!rarity) return "Standard";
  const r = rarity.toLowerCase();
  if (r.includes("reverse holo") || r.includes("reverse")) return "Reverse Holo";
  if (r.includes("full art"))   return "Full Art";
  if (r.includes("secret"))     return "Secret Rare";
  if (r.includes("holo"))       return "Holo";
  return "Standard";
}

function median(nums) {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}


// ─── Constants ───────────────────────────────────────────────────────────────

const CONDITIONS = ["NM", "LP", "MP", "PL"];
const VARIATIONS = ["Standard", "Reverse Holo", "Holo", "Full Art", "Secret Rare", "1st Edition", "Other"];
const PARCEL_SIZES = [
  { value: "LARGE_LETTER", label: "Large Letter", hint: "Up to 500g — most singles" },
  { value: "SMALL_PARCEL",  label: "Small Parcel",  hint: "Up to 1kg — playsets, decks" },
  { value: "MEDIUM_PARCEL", label: "Medium Parcel", hint: "Up to 5kg — bulk lots" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function CollectionRow({ entry, selected, onSelect }) {
  const card = entry.card;
  const isSelected = selected?.cardId === entry.cardId && selected?.variation === entry.variation;
  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      className={[
        "flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-left transition-colors text-xs",
        isSelected
          ? "bg-white/[0.12] border border-white/20"
          : "hover:bg-white/[0.06] border border-transparent",
      ].join(" ")}
    >
      <div className="shrink-0 w-8 h-11 rounded overflow-hidden bg-white/[0.06]">
        {card?.images?.small ? (
          <img src={card.images.small} alt={card.name} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-neutral-100 truncate">{card?.name ?? entry.cardId}</p>
        <p className="text-neutral-500 truncate">
          {[card?.set?.name, card?.number ? `#${card.number}` : null, card?.rarity]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-neutral-400 font-medium">×{entry.quantity}</p>
        {entry.variation && (
          <p className="text-[10px] text-neutral-600 mt-0.5">{entry.variation}</p>
        )}
        {isSelected && <span className="text-emerald-400">✓</span>}
      </div>
    </button>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer select-none",
        active
          ? "bg-indigo-600/80 border-indigo-500 text-white"
          : "bg-white/[0.04] border-white/10 text-neutral-400 hover:border-white/25 hover:text-neutral-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function CardPreviewPanel({ entry, priceSuggestion, priceLoading, apiPrices, apiLoading }) {
  const card = entry?.card;
  if (!entry || !card) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[280px] rounded-2xl border border-white/[0.06] bg-white/[0.02] text-neutral-600 gap-2">
        <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M3 9h18M9 21V9" />
        </svg>
        <p className="text-[11px]">Select a card to preview</p>
      </div>
    );
  }

  const imgSrc = card.images?.large || card.images?.small;
  const prices = priceSuggestion?.map((l) => l.price).filter(Boolean) ?? [];
  const low = prices.length ? Math.min(...prices) : null;
  const med = median(prices);
  const hasApiPrices = apiPrices && (apiPrices.gbp != null || apiPrices.market != null);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl overflow-hidden bg-black/40 border border-white/[0.06] flex items-center justify-center" style={{ minHeight: 260 }}>
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={card.name}
            className="w-full max-w-[220px] mx-auto object-contain rounded-xl"
            style={{ aspectRatio: "2.5/3.5" }}
          />
        ) : (
          <div className="w-40 h-56 rounded-xl bg-white/[0.04] flex items-center justify-center text-neutral-700 text-xs">No image</div>
        )}
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 space-y-1.5">
        <p className="text-sm font-semibold text-neutral-100">{card.name}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-neutral-500">
          {card.set?.name && <span>{card.set.name}</span>}
          {card.number    && <span>#{card.number}</span>}
          {card.rarity    && <span>{card.rarity}</span>}
        </div>
        <div className="text-[11px] text-neutral-600 pt-0.5">
          You own <span className="text-neutral-400 font-medium">×{entry.quantity}</span>
          {entry.condition && <span> · {entry.condition}</span>}
        </div>
      </div>

      {/* ── Marketplace price data ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 space-y-3">
        <p className="text-[10px] uppercase tracking-wider text-neutral-600 font-semibold">Market price</p>

        {priceLoading ? (
          <div className="space-y-1.5">
            <div className="h-3 w-24 rounded bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-16 rounded bg-white/[0.06] animate-pulse" />
          </div>
        ) : prices.length > 0 ? (
          <div className="space-y-1">
            <p className="text-[10px] text-neutral-500 font-medium">On this marketplace</p>
            {low != null && (
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Lowest</span>
                <span className="text-neutral-100 font-medium">£{low.toFixed(2)}</span>
              </div>
            )}
            {med != null && (
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Median</span>
                <span className="text-neutral-100 font-medium">£{med.toFixed(2)}</span>
              </div>
            )}
            <p className="text-[10px] text-neutral-600 mt-0.5">
              {prices.length} active listing{prices.length !== 1 ? "s" : ""}
            </p>
          </div>
        ) : (
          <p className="text-xs text-neutral-600">No active listings on this marketplace.</p>
        )}

        {/* Catalog reference prices */}
        {(apiLoading || hasApiPrices) && (
          <div className="border-t border-white/[0.06] pt-3 space-y-1">
            <p className="text-[10px] text-neutral-500 font-medium">Catalog reference</p>
            {apiLoading ? (
              <div className="h-3 w-28 rounded bg-white/[0.06] animate-pulse" />
            ) : (
              <>
                {apiPrices?.gbp != null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-500">Latest (GBP)</span>
                    <span className="text-neutral-300 font-medium">£{Number(apiPrices.gbp).toFixed(2)}</span>
                  </div>
                )}
                {apiPrices?.market != null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-500">Market</span>
                    <span className="text-neutral-300 font-medium">£{Number(apiPrices.market).toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function CreateListingModal({ onClose, onCreated, onViewListings }) {
  const auth = useContext(AuthContext) || {};
  const token = auth.token || null;
  const isLoggedIn = !!(auth.user || token);

  // Collection
  const [collection, setCollection]     = useState([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionErr, setCollectionErr] = useState("");

  // Search
  const [query, setQuery] = useState("");

  // Selected entry
  const [selectedEntry, setSelectedEntry]     = useState(null);
  const [variationAutoFilled, setVariationAutoFilled] = useState(false);

  // Price suggestion (marketplace listings)
  const [priceSuggestion, setPriceSuggestion] = useState(null);
  const [priceLoading, setPriceLoading]       = useState(false);

  // TCGDex card data (variations + external prices)
  const [tcgData, setTcgData]       = useState(null);
  const [tcgLoading, setTcgLoading] = useState(false);

  // Listing fields
  const [condition, setCondition]     = useState("NM");
  const [variation, setVariation]     = useState("Standard");
  const [tradeOnly, setTradeOnly]     = useState(false);
  const [price, setPrice]             = useState("");
  const [quantity, setQuantity]       = useState("1");
  const [parcelSize, setParcelSize]   = useState("LARGE_LETTER");
  const [labelPaidBy, setLabelPaidBy] = useState("seller");
  const [allowOffers, setAllowOffers] = useState(false);
  const [willTrade, setWillTrade]     = useState(false);
  const [notes, setNotes]             = useState("");

  // Submit
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");
  const [done, setDone] = useState(false);

  // Fetch collection on open
  useEffect(() => {
    if (!isLoggedIn) return;
    setCollectionLoading(true);
    gqlFetch(MY_COLLECTION_QUERY, {}, token)
      .then((data) => setCollection(data?.myCollection ?? []))
      .catch((ex) => setCollectionErr(ex.message || "Failed to load collection"))
      .finally(() => setCollectionLoading(false));
  }, [isLoggedIn]);

  // Filter collection client-side
  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return collection;
    return collection.filter((e) =>
      e.card?.name?.toLowerCase().includes(q) ||
      e.card?.number?.toLowerCase().includes(q) ||
      e.card?.set?.name?.toLowerCase().includes(q)
    );
  }, [collection, query]);

  const showDropdown = query.trim().length > 0 && filteredEntries.length > 0 && !selectedEntry;

  // Embargo check — derived from selected entry's set release date
  const embargoInfo = selectedEntry
    ? getEmbargoInfo(selectedEntry.card?.set?.releaseDate)
    : null;

  // Auto-fill when entry is selected
  useEffect(() => {
    if (!selectedEntry) {
      setPriceSuggestion(null);
      return;
    }
    // Condition: use entry's stored condition if available, else default NM
    if (selectedEntry.condition) setCondition(selectedEntry.condition);

    // Variation: use entry's stored variation if set, else derive from rarity
    if (selectedEntry.variation) {
      setVariation(selectedEntry.variation);
      setVariationAutoFilled(true);
    } else {
      const suggested = rarityToVariation(selectedEntry.card?.rarity);
      setVariation(suggested);
      setVariationAutoFilled(suggested !== "Standard");
    }

    // Fetch marketplace price suggestions
    setPriceLoading(true);
    setPriceSuggestion(null);
    gqlFetch(PRICE_SUGGESTION_QUERY, { cardId: selectedEntry.cardId }, token)
      .then((data) => setPriceSuggestion(data?.listings ?? null))
      .catch(() => setPriceSuggestion(null))
      .finally(() => setPriceLoading(false));

    // Fetch card detail from catalog (variants + latest prices)
    setTcgLoading(true);
    setTcgData(null);
    gqlFetch(CARD_DETAIL_QUERY, { id: selectedEntry.cardId }, token)
      .then((d) => setTcgData(d?.cardsearchCard ?? null))
      .catch(() => setTcgData(null))
      .finally(() => setTcgLoading(false));
  }, [selectedEntry?.cardId, selectedEntry?.variation]);

  function handleSelectEntry(entry) {
    setSelectedEntry(entry);
    setQuery(entry.card?.name ?? entry.cardId);
  }

  function handleClearEntry() {
    setSelectedEntry(null);
    setQuery("");
    setVariation("Standard");
    setVariationAutoFilled(false);
    setPriceSuggestion(null);
    setTcgData(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedEntry) { setErr("Please select a card from your collection."); return; }
    const priceNum = tradeOnly ? null : parseFloat(price);
    if (!tradeOnly && (!priceNum || priceNum <= 0)) { setErr("Please enter a valid price."); return; }
    setBusy(true);
    setErr("");
    try {
      const data = await gqlFetch(
        CREATE_LISTING_MUTATION,
        {
          input: {
            cardId:      selectedEntry.cardId,
            title:       selectedEntry.card?.name ?? selectedEntry.cardId,
            description: notes.trim() || undefined,
            condition,
            variant:     variation !== "Standard" ? variation : undefined,
            ...(priceNum != null ? { price: priceNum, currency: "GBP" } : {}),
            quantity:    parseInt(quantity, 10) || 1,
            parcelSize,
            labelPaidBy,
            allowOffers: tradeOnly ? false : allowOffers,
            willTrade:   tradeOnly ? true : willTrade,
          },
        },
        token,
      );
      setDone(true);
    } catch (ex) {
      setErr(ex.message || "Failed to create listing");
    } finally {
      setBusy(false);
    }
  }

  // Variations available for this card based on catalog variants
  const availableVariations = useMemo(() => {
    const variants = tcgData?.variants;
    if (!variants?.length) return VARIATIONS;
    const keys = new Set(variants.map((v) => (v.label || v.key || "").toLowerCase()));
    return VARIATIONS.filter((v) => {
      if (v === "Standard")     return keys.has("standard") || !keys.size;
      if (v === "Reverse Holo") return keys.has("reverse holo") || keys.has("reverse");
      if (v === "Holo")         return keys.has("holo") || keys.has("holofoil");
      if (v === "1st Edition")  return keys.has("1st edition") || keys.has("firstedition");
      return true; // Full Art, Secret Rare, Other
    });
  }, [tcgData]);

  // Latest prices from catalog (already ingested from TCGDex)
  const apiPrices = useMemo(() => {
    const prices = tcgData?.latestPrices;
    if (!prices?.length) return null;
    const match = prices.find((p) => !p.variation || p.variation === variation) ?? prices[0];
    const gbp    = Number(match?.gbp)    || null;
    const market = Number(match?.market) || null;
    return (gbp || market) ? { gbp, market } : null;
  }, [tcgData, variation]);

  // Reference price for deviation warning — marketplace median, or catalog price as fallback
  const referencePrice = useMemo(() => {
    const prices = priceSuggestion?.map((l) => l.price).filter(Boolean) ?? [];
    if (prices.length) return median(prices);
    return apiPrices?.market ?? apiPrices?.gbp ?? null;
  }, [priceSuggestion, apiPrices]);

  const referenceSource = useMemo(() => {
    const prices = priceSuggestion?.map((l) => l.price).filter(Boolean) ?? [];
    return prices.length > 0 ? "marketplace median" : "catalog price";
  }, [priceSuggestion]);

  // Price deviation from marketplace median
  const priceNum = tradeOnly ? null : parseFloat(price);
  const deviationPct = (referencePrice && priceNum && priceNum > 0)
    ? ((priceNum - referencePrice) / referencePrice) * 100
    : null;

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-neutral-100 " +
    "placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20 transition";
  const labelCls = "text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5 block";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-14 bg-black/70 backdrop-blur-sm px-4 pb-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-3xl rounded-3xl border border-white/[0.08] bg-[#0d0f17] shadow-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-[#0d0f17]">
          <h2 className="text-sm font-semibold text-neutral-100">List a card for sale</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-100 hover:bg-white/[0.08] transition text-xs"
          >
            ✕
          </button>
        </div>

        {/* ── Success ── */}
        {done && (
          <div className="flex flex-col items-center gap-5 py-12 px-6">
            {/* Icon */}
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>

            {/* Title */}
            <div className="text-center">
              <p className="text-base font-semibold text-neutral-100">Listing submitted!</p>
              <p className="text-sm text-neutral-400 mt-1">One step left — photo proof required.</p>
            </div>

            {/* Proof explanation */}
            <div className="w-full max-w-sm rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-5 py-4 space-y-3">
              <p className="text-xs font-semibold text-amber-300 uppercase tracking-wide">What happens next?</p>
              <ol className="space-y-2 text-xs text-neutral-300 list-none">
                <li className="flex gap-2.5 items-start">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center justify-center mt-0.5">1</span>
                  <span>Go to <strong className="text-neutral-100">My Listings</strong> and find your new listing.</span>
                </li>
                <li className="flex gap-2.5 items-start">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center justify-center mt-0.5">2</span>
                  <span>Take a photo of your card with the <strong className="text-neutral-100">proof code</strong> written on a piece of paper next to it.</span>
                </li>
                <li className="flex gap-2.5 items-start">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center justify-center mt-0.5">3</span>
                  <span>Upload the photo. Our team will verify it and activate your listing.</span>
                </li>
              </ol>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm">
              <button
                type="button"
                onClick={() => {
                  if (onCreated) onCreated();
                  if (onViewListings) onViewListings();
                  else onClose();
                }}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition"
              >
                View my listings
              </button>
              <button
                type="button"
                onClick={() => { if (onCreated) onCreated(); onClose(); }}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium text-neutral-400 border border-white/10 hover:bg-white/[0.04] transition"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {!done && (
          <div className="p-6">
            {!isLoggedIn ? (
              <p className="text-sm text-center text-neutral-500 py-8">Please sign in to list cards.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-6">

                {/* ── Left: form ── */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                  {/* 1. Collection picker */}
                  <div>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <label className={labelCls + " mb-0"}>Card</label>
                      {collectionLoading && <span className="text-[10px] text-neutral-600">Loading…</span>}
                      {!collectionLoading && collection.length > 0 && !selectedEntry && (
                        <span className="text-[10px] text-neutral-600">{collection.length} in collection</span>
                      )}
                    </div>

                    {collectionErr && <p className="text-xs text-red-400 mb-2">{collectionErr}</p>}

                    {!collectionLoading && collection.length === 0 && !collectionErr && (
                      <p className="text-xs text-neutral-500 py-3 text-center border border-white/[0.06] rounded-xl">
                        Your collection is empty. Add cards first.
                      </p>
                    )}

                    {/* Selected card */}
                    {selectedEntry && (
                      <div className="flex items-center gap-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/[0.06] px-3 py-2">
                        {selectedEntry.card?.images?.small && (
                          <img src={selectedEntry.card.images.small} alt={selectedEntry.card.name} className="w-7 h-9 object-contain rounded shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-neutral-100 truncate">{selectedEntry.card?.name ?? selectedEntry.cardId}</p>
                          <p className="text-[11px] text-neutral-500 truncate">
                            {[selectedEntry.card?.set?.name, selectedEntry.card?.number ? `#${selectedEntry.card.number}` : null].filter(Boolean).join(" · ")}
                            {selectedEntry.condition ? ` · ${selectedEntry.condition}` : ""}
                          </p>
                        </div>
                        <button type="button" onClick={handleClearEntry} className="text-xs text-neutral-600 hover:text-red-400 transition shrink-0 px-1">✕</button>
                      </div>
                    )}

                    {/* Card grid picker */}
                    {!selectedEntry && collection.length > 0 && (
                      <>
                        <input
                          type="text"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search your collection…"
                          className={inputCls + " mb-2"}
                          autoComplete="off"
                          disabled={collectionLoading}
                        />
                        {filteredEntries.length === 0 && query.trim() ? (
                          <p className="text-xs text-neutral-600 text-center py-3">No cards matching "{query}".</p>
                        ) : (
                          <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto rounded-xl border border-white/[0.06] p-2 bg-black/20">
                            {filteredEntries.map((entry, i) => {
                              const imgUrl = entry.card?.images?.small;
                              const name = entry.card?.name ?? entry.cardId;
                              return (
                                <button
                                  key={`${entry.cardId}-${entry.variation ?? ""}-${i}`}
                                  type="button"
                                  onClick={() => handleSelectEntry(entry)}
                                  title={`${name}${entry.condition ? ` · ${entry.condition}` : ""}`}
                                  className="group relative aspect-[2/3] rounded-lg overflow-hidden border border-white/[0.06] hover:border-indigo-500/50 transition bg-black/40"
                                >
                                  {imgUrl ? (
                                    <img src={imgUrl} alt={name} className="w-full h-full object-contain group-hover:scale-105 transition duration-200" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[9px] text-neutral-600 p-1 text-center leading-tight">{name}</div>
                                  )}
                                  {entry.condition && (
                                    <span className="absolute top-1 left-1 text-[8px] font-bold px-1 py-0.5 rounded bg-black/70 text-neutral-300">
                                      {entry.condition}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* ── Embargo warning ── */}
                  {embargoInfo && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 flex gap-3 items-start">
                      <svg className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      <div>
                        <p className="text-xs font-semibold text-amber-300">New set — listings locked</p>
                        <p className="text-[11px] text-amber-400/80 mt-0.5">
                          Opens in <span className="font-medium">{embargoInfo.daysLeft} day{embargoInfo.daysLeft !== 1 ? "s" : ""}</span> ({embargoInfo.endsAt}).
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── Rest of form — only shown once a card is selected ── */}
                  {selectedEntry && (
                    <>
                      {/* 2. Condition + Variation side by side */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>Condition</label>
                          <div className="flex flex-wrap gap-1.5">
                            {CONDITIONS.map((c) => (
                              <Chip key={c} active={condition === c} onClick={() => setCondition(c)}>{c}</Chip>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-baseline justify-between mb-1.5">
                            <label className={labelCls + " mb-0"}>Variation</label>
                            {variationAutoFilled && <span className="text-[10px] text-indigo-400">Auto-filled</span>}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {availableVariations.map((v) => (
                              <Chip key={v} active={variation === v} onClick={() => { setVariation(v); setVariationAutoFilled(false); }}>{v}</Chip>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 3. Listing type + price + qty */}
                      <div>
                        <label className={labelCls}>Pricing</label>
                        <div className="flex gap-2 items-start">
                          {/* type toggle */}
                          <div className="flex rounded-xl overflow-hidden border border-white/10 shrink-0">
                            {[{ v: false, l: "For sale" }, { v: true, l: "Trade only" }].map(({ v: val, l: lbl }) => (
                              <button
                                key={String(val)}
                                type="button"
                                onClick={() => setTradeOnly(val)}
                                className={[
                                  "px-3 py-2 text-xs font-medium transition whitespace-nowrap",
                                  tradeOnly === val ? "bg-indigo-600 text-white" : "text-neutral-400 hover:bg-white/[0.04]",
                                ].join(" ")}
                              >
                                {lbl}
                              </button>
                            ))}
                          </div>
                          {!tradeOnly && (
                            <div className="relative flex-1 min-w-0">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500 pointer-events-none">£</span>
                              <input
                                type="number" min="0.01" step="0.01" value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="0.00"
                                className={inputCls + " pl-7"}
                              />
                            </div>
                          )}
                          <div className="w-20 shrink-0">
                            <input
                              type="number" min="1" max={selectedEntry?.quantity ?? 99} value={quantity}
                              onChange={(e) => setQuantity(e.target.value)}
                              className={inputCls}
                              placeholder="Qty"
                            />
                          </div>
                        </div>
                        {/* price hints */}
                        <div className="flex items-baseline justify-between mt-1.5 px-0.5">
                          {deviationPct != null && Math.abs(deviationPct) > 15 ? (
                            <p className={["text-[11px] flex items-center gap-1", deviationPct > 0 ? "text-amber-400" : "text-sky-400"].join(" ")}>
                              {deviationPct > 0 ? "↑" : "↓"} {Math.abs(Math.round(deviationPct))}% {deviationPct > 0 ? "above" : "below"} {referenceSource} (£{referencePrice.toFixed(2)})
                            </p>
                          ) : referencePrice && !deviationPct ? null : <span />}
                          {selectedEntry && (
                            <p className="text-[10px] text-neutral-600">You own ×{selectedEntry.quantity}</p>
                          )}
                        </div>
                      </div>

                      {/* 4. Shipping — parcel size + who pays on one row */}
                      <div>
                        <label className={labelCls}>Shipping</label>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {PARCEL_SIZES.map((ps) => (
                            <Chip key={ps.value} active={parcelSize === ps.value} onClick={() => setParcelSize(ps.value)}>
                              {ps.label}
                            </Chip>
                          ))}
                          <span className="text-neutral-700 text-xs select-none">·</span>
                          {[{ value: "seller", label: "Seller pays" }, { value: "buyer", label: "Buyer pays" }].map((opt) => (
                            <Chip key={opt.value} active={labelPaidBy === opt.value} onClick={() => setLabelPaidBy(opt.value)}>
                              {opt.label}
                            </Chip>
                          ))}
                        </div>
                        <p className="text-[11px] text-neutral-600 mt-1.5">
                          {PARCEL_SIZES.find((p) => p.value === parcelSize)?.hint}
                          {labelPaidBy === "buyer" ? " · Cost added to buyer's total." : " · Label cost deducted from proceeds."}
                        </p>
                      </div>

                      {/* 5. Options — compact inline checkboxes */}
                      {!tradeOnly && (
                        <div className="flex items-center gap-5">
                          {[
                            { state: allowOffers, set: setAllowOffers, label: "Accept offers" },
                            { state: willTrade,   set: setWillTrade,   label: "Open to trades" },
                          ].map(({ state, set, label }) => (
                            <label key={label} className="flex items-center gap-2 cursor-pointer group">
                              <div
                                onClick={() => set((v) => !v)}
                                className={[
                                  "w-4 h-4 rounded border-2 flex items-center justify-center transition shrink-0",
                                  state ? "bg-indigo-600 border-indigo-500" : "border-white/20 group-hover:border-white/40",
                                ].join(" ")}
                              >
                                {state && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <span className="text-xs text-neutral-400">{label}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {/* 6. Seller notes */}
                      <div>
                        <label className={labelCls}>
                          Notes <span className="text-neutral-600 font-normal normal-case">(optional)</span>
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                          maxLength={500}
                          placeholder="e.g. Minor scratch on top-left corner, sleeve included, ships next day…"
                          className={inputCls + " resize-none"}
                        />
                        {notes.length > 400 && (
                          <p className="text-[11px] text-neutral-600 mt-1 text-right">{notes.length}/500</p>
                        )}
                      </div>
                    </>
                  )}

                  {err && <p className="text-xs text-red-400">{err}</p>}

                  <button
                    type="submit"
                    disabled={busy || !selectedEntry || !!embargoInfo}
                    className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-auto"
                  >
                    {busy ? "Creating listing…" : embargoInfo ? `Listings open ${embargoInfo.endsAt}` : "List for sale"}
                  </button>
                </form>

                {/* ── Right: card preview ── */}
                <div className="md:sticky md:top-20 self-start">
                  <CardPreviewPanel
                    entry={selectedEntry}
                    priceSuggestion={priceSuggestion}
                    priceLoading={priceLoading}
                    apiPrices={apiPrices}
                    apiLoading={tcgLoading}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
