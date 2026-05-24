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
  const token = auth.accessToken || auth.token || null;
  const isLoggedIn = !!(auth.isAuthenticated || token);

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
            cardId:     selectedEntry.cardId,
            title:      selectedEntry.card?.name ?? selectedEntry.cardId,
            condition,
            variant:    variation !== "Standard" ? variation : undefined,
            ...(priceNum != null ? { price: priceNum, currency: "GBP" } : {}),
            quantity:   parseInt(quantity, 10) || 1,
            parcelSize,
            labelPaidBy,
            allowOffers: tradeOnly ? false : allowOffers,
            willTrade:   tradeOnly ? true : willTrade,
          },
        },
        token,
      );
      setDone(true);
      if (onCreated) onCreated(data.createListing);
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

  // Reference price for deviation warning — median of marketplace listings
  const referencePrice = useMemo(() => {
    const prices = priceSuggestion?.map((l) => l.price).filter(Boolean) ?? [];
    return prices.length ? median(prices) : null;
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
                onClick={() => onViewListings ? onViewListings() : onClose()}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition"
              >
                View my listings
              </button>
              <button
                type="button"
                onClick={onClose}
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
              <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-6">

                {/* ── Left: form ── */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                  {/* 1. Collection search */}
                  <div>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <label className={labelCls + " mb-0"}>Your collection</label>
                      {collectionLoading && (
                        <span className="text-[10px] text-neutral-600">Loading…</span>
                      )}
                      {!collectionLoading && collection.length > 0 && !selectedEntry && (
                        <span className="text-[10px] text-neutral-600">{collection.length} cards</span>
                      )}
                    </div>

                    {collectionErr && (
                      <p className="text-xs text-red-400 mb-2">{collectionErr}</p>
                    )}

                    {!collectionLoading && collection.length === 0 && !collectionErr && (
                      <p className="text-xs text-neutral-500 py-3 text-center border border-white/[0.06] rounded-xl">
                        Your collection is empty. Add cards first.
                      </p>
                    )}

                    {collection.length > 0 && (
                      <div className="relative">
                        <input
                          type="text"
                          value={query}
                          onChange={(e) => {
                            setQuery(e.target.value);
                            if (selectedEntry) setSelectedEntry(null);
                          }}
                          placeholder="Search your collection…"
                          className={inputCls}
                          autoComplete="off"
                          disabled={collectionLoading}
                        />
                      </div>
                    )}

                    {/* Dropdown results */}
                    {showDropdown && (
                      <div className="mt-1.5 flex flex-col gap-0.5 max-h-52 overflow-y-auto rounded-2xl border border-white/[0.06] p-1.5 bg-[#080a12]">
                        {filteredEntries.map((entry, i) => (
                          <CollectionRow
                            key={`${entry.cardId}-${entry.variation ?? ""}-${i}`}
                            entry={entry}
                            selected={selectedEntry}
                            onSelect={handleSelectEntry}
                          />
                        ))}
                      </div>
                    )}

                    {query.trim().length > 0 && filteredEntries.length === 0 && !selectedEntry && (
                      <p className="text-xs text-neutral-600 mt-2">No cards matching "{query}" in your collection.</p>
                    )}

                    {/* Selected card summary */}
                    {selectedEntry && (
                      <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                        {selectedEntry.card?.images?.small && (
                          <img
                            src={selectedEntry.card.images.small}
                            alt={selectedEntry.card.name}
                            className="w-7 h-9 object-contain rounded shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-neutral-100 truncate">
                            {selectedEntry.card?.name ?? selectedEntry.cardId}
                          </p>
                          <p className="text-[11px] text-neutral-500 truncate">
                            {[selectedEntry.card?.set?.name, selectedEntry.card?.number ? `#${selectedEntry.card.number}` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <button type="button" onClick={handleClearEntry} className="text-xs text-neutral-600 hover:text-red-400 transition shrink-0">✕</button>
                      </div>
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
                          This set was released recently. Listings open in{" "}
                          <span className="font-medium">{embargoInfo.daysLeft} day{embargoInfo.daysLeft !== 1 ? "s" : ""}</span>
                          {" "}({embargoInfo.endsAt}).
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 2. Condition */}
                  <div>
                    <label className={labelCls}>Condition</label>
                    <div className="flex flex-wrap gap-2">
                      {CONDITIONS.map((c) => (
                        <Chip key={c} active={condition === c} onClick={() => setCondition(c)}>{c}</Chip>
                      ))}
                    </div>
                  </div>

                  {/* 3. Variation */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={labelCls + " mb-0"}>Variation</label>
                      {variationAutoFilled && (
                        <span className="text-[10px] text-indigo-400 font-medium">Auto-filled</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableVariations.map((v) => (
                        <Chip
                          key={v}
                          active={variation === v}
                          onClick={() => { setVariation(v); setVariationAutoFilled(false); }}
                        >
                          {v}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  {/* 4. Listing type */}
                  <div>
                    <label className={labelCls}>Listing type</label>
                    <div className="flex gap-2">
                      {[
                        { value: false, label: "For sale", hint: "Set a price" },
                        { value: true,  label: "Trade only", hint: "No price — trade offers only" },
                      ].map((opt) => (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() => setTradeOnly(opt.value)}
                          className={[
                            "flex-1 flex flex-col items-start rounded-xl border px-3 py-2.5 text-left text-xs transition",
                            tradeOnly === opt.value
                              ? "border-indigo-500/60 bg-indigo-600/[0.08]"
                              : "border-white/[0.06] hover:bg-white/[0.04]",
                          ].join(" ")}
                        >
                          <span className="flex items-center gap-2">
                            <span className={[
                              "w-3 h-3 rounded-full border-2 shrink-0 transition",
                              tradeOnly === opt.value ? "border-indigo-400 bg-indigo-500" : "border-neutral-600",
                            ].join(" ")} />
                            <span className="font-semibold text-neutral-100">{opt.label}</span>
                          </span>
                          <span className="text-neutral-500 mt-0.5 ml-5">{opt.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 5. Price + Quantity */}
                  <div className="grid grid-cols-2 gap-3">
                    {!tradeOnly && (
                      <div>
                        <label className={labelCls}>Price (£)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500 pointer-events-none">£</span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="0.00"
                            className={inputCls + " pl-7"}
                          />
                        </div>
                        {deviationPct != null && Math.abs(deviationPct) > 15 && (
                          <p className={[
                            "text-[11px] mt-1.5 flex items-center gap-1",
                            deviationPct > 0 ? "text-amber-400" : "text-sky-400",
                          ].join(" ")}>
                            {deviationPct > 0 ? "↑" : "↓"}
                            {" "}{Math.abs(Math.round(deviationPct))}%{" "}
                            {deviationPct > 0 ? "above" : "below"} marketplace median
                            {" "}(£{referencePrice.toFixed(2)})
                          </p>
                        )}
                      </div>
                    )}
                    <div className={tradeOnly ? "col-span-2" : ""}>
                      <label className={labelCls}>Quantity</label>
                      <input
                        type="number"
                        min="1"
                        max={selectedEntry?.quantity ?? 99}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className={inputCls}
                      />
                      {selectedEntry && (
                        <p className="text-[10px] text-neutral-600 mt-1">You own ×{selectedEntry.quantity}</p>
                      )}
                    </div>
                  </div>

                  {/* 5. Parcel size */}
                  <div>
                    <label className={labelCls}>Parcel size</label>
                    <div className="flex flex-col gap-2">
                      {PARCEL_SIZES.map((ps) => (
                        <button
                          key={ps.value}
                          type="button"
                          onClick={() => setParcelSize(ps.value)}
                          className={[
                            "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-xs transition",
                            parcelSize === ps.value
                              ? "border-indigo-500/60 bg-indigo-600/[0.08]"
                              : "border-white/[0.06] hover:bg-white/[0.04]",
                          ].join(" ")}
                        >
                          <span className={[
                            "w-3 h-3 rounded-full border-2 shrink-0 transition",
                            parcelSize === ps.value ? "border-indigo-400 bg-indigo-500" : "border-neutral-600",
                          ].join(" ")} />
                          <span>
                            <span className="font-semibold text-neutral-100">{ps.label}</span>
                            <span className="ml-2 text-neutral-500">{ps.hint}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 6. Label paid by */}
                  <div>
                    <label className={labelCls}>Shipping label paid by</label>
                    <div className="flex gap-2">
                      {[
                        { value: "seller", label: "Seller pays" },
                        { value: "buyer",  label: "Buyer pays" },
                      ].map((opt) => (
                        <Chip key={opt.value} active={labelPaidBy === opt.value} onClick={() => setLabelPaidBy(opt.value)}>
                          {opt.label}
                        </Chip>
                      ))}
                    </div>
                    <p className="text-[11px] text-neutral-600 mt-1.5">
                      {labelPaidBy === "buyer"
                        ? "Shipping cost added to buyer's total at checkout."
                        : "Label cost deducted from your sale proceeds."}
                    </p>
                  </div>

                  {/* 7. Offers + trade */}
                  <div className="flex flex-col gap-2.5">
                    {(tradeOnly ? [] : [
                      { state: allowOffers, set: setAllowOffers, label: "Accept price offers from buyers" },
                      { state: willTrade,   set: setWillTrade,   label: "Open to trading this card" },
                    ]).map(({ state, set, label }) => (
                      <label key={label} className="flex items-center gap-3 cursor-pointer group">
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
                        <span className="text-xs text-neutral-300">{label}</span>
                      </label>
                    ))}
                  </div>

                  {err && <p className="text-xs text-red-400">{err}</p>}

                  <button
                    type="submit"
                    disabled={busy || !selectedEntry || !!embargoInfo}
                    className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
