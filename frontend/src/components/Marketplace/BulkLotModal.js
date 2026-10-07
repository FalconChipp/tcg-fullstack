// frontend/src/components/Marketplace/BulkLotModal.js
//
// Sell a bulk lot — one listing for a whole collection of cards shipped as a
// single parcel. Two modes:
//   TRACKED : seller multi-selects from their own collection; system has exact cardIds
//   RANDOM  : seller declares count + description + guaranteed inclusions + photo
//
// Companion to CreateListingModal (single card) and BatchListingModal (N singles
// under one proof). Those remain untouched.

"use client";

import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "@/components/Auth/AuthProvider";
import { MY_COLLECTION_QUERY } from '@/graphql/collection';
import { CREATE_BULK_LOT_MUTATION } from '@/graphql/marketplace';
import { gqlFetch } from "@/utils/apiClient";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITIONS = ["M", "NM", "LP", "MP", "HP", "DMG"];
const PARCEL_SIZES = [
  { value: "LARGE_LETTER", label: "Large Letter", hint: "Up to 500g" },
  { value: "SMALL_PARCEL",  label: "Small Parcel",  hint: "Up to 1kg" },
  { value: "MEDIUM_PARCEL", label: "Medium Parcel", hint: "Up to 5kg — most bulk lots" },
];
const MIN_CARD_COUNT = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function conditionRank(c) {
  const i = CONDITIONS.indexOf(c);
  return i === -1 ? 99 : i;
}

// ─── Small UI atoms ───────────────────────────────────────────────────────────

function Chip({ active, onClick, children, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center rounded-[6px] px-3 py-1 text-xs font-medium border transition-colors cursor-pointer select-none",
        disabled ? "opacity-30 cursor-not-allowed" : "",
        active
          ? "bg-indigo-600/80 border-indigo-500 text-white"
          : "bg-white/[0.04] border-white/10 text-neutral-400 hover:border-white/25 hover:text-neutral-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Tabs({ value, onChange }) {
  const tabs = [
    { v: "BULK_TRACKED", label: "Tracked",  hint: "Pick from your collection" },
    { v: "BULK_RANDOM",  label: "Random",   hint: "Describe the lot" },
  ];
  return (
    <div className="flex rounded-[10px] border border-white/10 overflow-hidden">
      {tabs.map((t) => (
        <button
          key={t.v}
          type="button"
          onClick={() => onChange(t.v)}
          className={[
            "flex-1 px-4 py-2.5 text-xs font-semibold transition text-left",
            value === t.v
              ? "bg-indigo-600 text-white"
              : "text-neutral-400 hover:bg-white/[0.04]",
          ].join(" ")}
        >
          <div>{t.label}</div>
          <div className={value === t.v ? "text-[10px] font-normal text-indigo-100/80" : "text-[10px] font-normal text-neutral-600"}>
            {t.hint}
          </div>
        </button>
      ))}
    </div>
  );
}

function ConditionRange({ min, max, onChange }) {
  function setMin(c) {
    onChange({ min: c, max: conditionRank(c) > conditionRank(max) ? c : max });
  }
  function setMax(c) {
    onChange({ min: conditionRank(c) < conditionRank(min) ? c : min, max: c });
  }
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5 block">Best condition</label>
        <div className="flex flex-wrap gap-1.5">
          {CONDITIONS.map((c) => (
            <Chip key={c} active={min === c} onClick={() => setMin(c)}>{c}</Chip>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5 block">Worst condition</label>
        <div className="flex flex-wrap gap-1.5">
          {CONDITIONS.map((c) => (
            <Chip key={c} active={max === c} onClick={() => setMax(c)}>{c}</Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

function InclusionsEditor({ items, onChange }) {
  function update(i, patch) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function remove(i) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...items, { description: "", quantity: 1 }]);
  }
  const inputCls =
    "w-full rounded-[8px] border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-neutral-100 " +
    "placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20";
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={it.description}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="e.g. 5 holos guaranteed"
            className={inputCls + " flex-1"}
          />
          <input
            type="number" min="1" max="999"
            value={it.quantity}
            onChange={(e) => update(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
            className={inputCls + " w-16 text-center"}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-neutral-500 hover:text-red-400 text-xs px-1"
            aria-label="Remove inclusion"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
      >
        + Add guarantee
      </button>
    </div>
  );
}

function LotPhotoUploader({ fileName, onFile, onClear }) {
  async function handle(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await toBase64(file);
    onFile({ name: file.name, base64: b64 });
  }
  return (
    <div>
      {fileName ? (
        <div className="flex items-center gap-2 rounded-[10px] border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2">
          <span className="text-xs text-emerald-300 font-medium truncate flex-1">{fileName}</span>
          <button type="button" onClick={onClear} className="text-xs text-neutral-500 hover:text-red-400">✕</button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 rounded-[10px] border border-dashed border-white/15 bg-black/20 px-4 py-5 cursor-pointer hover:border-white/30 hover:bg-black/30 transition">
          <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V18a2 2 0 002 2h14a2 2 0 002-2v-1.5M7 10l5-5m0 0l5 5m-5-5v12" />
          </svg>
          <span className="text-xs text-neutral-400">Upload a photo of the lot</span>
          <input type="file" accept="image/*" onChange={handle} className="hidden" />
        </label>
      )}
    </div>
  );
}

// ─── Tracked tab: multi-select from collection ────────────────────────────────

function TrackedPicker({ collection, loading, selected, onChange }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return collection;
    return collection.filter((e) =>
      e.card?.name?.toLowerCase().includes(q) ||
      e.card?.set?.name?.toLowerCase().includes(q) ||
      e.card?.number?.toLowerCase().includes(q)
    );
  }, [collection, search]);

  function keyFor(entry) {
    return `${entry.cardId}:${entry.variation ?? ""}`;
  }
  function isSelected(entry) {
    return selected.some((s) => s.key === keyFor(entry));
  }
  function toggle(entry) {
    const key = keyFor(entry);
    if (isSelected(entry)) {
      onChange(selected.filter((s) => s.key !== key));
    } else {
      onChange([...selected, {
        key,
        cardId:   entry.cardId,
        name:     entry.card?.name ?? entry.cardId,
        imageSmall: entry.card?.images?.small ?? null,
        variant:  entry.variation ?? null,
        condition: entry.condition ?? null,
        quantity: 1,
        max:      entry.quantity ?? 1,
      }]);
    }
  }
  function setQty(key, q) {
    onChange(selected.map((s) => (s.key === key ? { ...s, quantity: Math.max(1, Math.min(s.max, q || 1)) } : s)));
  }

  const totalCards = selected.reduce((n, s) => n + s.quantity, 0);
  const inputCls =
    "w-full rounded-[10px] border border-white/10 bg-black/40 px-3 py-2 text-sm text-neutral-100 " +
    "placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20";

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Pick cards for the lot
        </label>
        <span className="text-[10px] text-neutral-500">
          {selected.length} unique · {totalCards} total
        </span>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search your collection…"
        className={inputCls}
        disabled={loading}
      />

      {loading ? (
        <p className="text-xs text-neutral-500 text-center py-6">Loading collection…</p>
      ) : collection.length === 0 ? (
        <p className="text-xs text-neutral-500 py-3 text-center border border-white/[0.06] rounded-[10px]">
          Your collection is empty. Add cards first.
        </p>
      ) : (
        <div className="grid grid-cols-6 gap-1.5 max-h-56 overflow-y-auto rounded-[10px] border border-white/[0.06] p-2 bg-black/20">
          {filtered.map((entry, i) => {
            const picked = isSelected(entry);
            const name = entry.card?.name ?? entry.cardId;
            const img  = entry.card?.images?.small;
            return (
              <button
                key={`${keyFor(entry)}-${i}`}
                type="button"
                onClick={() => toggle(entry)}
                title={name}
                className={[
                  "group relative aspect-[2/3] rounded-[6px] overflow-hidden border transition bg-black/40",
                  picked ? "border-emerald-500 ring-1 ring-emerald-500/50" : "border-white/[0.06] hover:border-indigo-500/50",
                ].join(" ")}
              >
                {img ? (
                  <img src={img} alt={name} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[8px] text-neutral-600 p-1 text-center leading-tight">{name}</div>
                )}
                {picked && (
                  <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                    <span className="text-emerald-300 text-sm font-bold">✓</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selected.length > 0 && (
        <div className="rounded-[10px] border border-white/[0.06] bg-black/20 p-2 space-y-1 max-h-40 overflow-y-auto">
          {selected.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-xs">
              {s.imageSmall ? (
                <img src={s.imageSmall} alt="" className="w-5 h-7 object-contain rounded shrink-0" />
              ) : <div className="w-5 h-7 shrink-0" />}
              <span className="flex-1 truncate text-neutral-300">{s.name}</span>
              {s.condition && <span className="text-[10px] text-neutral-600">{s.condition}</span>}
              <input
                type="number" min="1" max={s.max}
                value={s.quantity}
                onChange={(e) => setQty(s.key, Number(e.target.value))}
                className="w-14 rounded-[6px] border border-white/10 bg-black/40 px-1.5 py-0.5 text-xs text-neutral-100 text-center"
              />
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x.key !== s.key))}
                className="text-neutral-500 hover:text-red-400 px-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function BulkLotModal({ onClose, onCreated }) {
  const auth = useContext(AuthContext) || {};
  const token = auth.token || null;
  const isLoggedIn = !!(auth.user || token);

  // Mode
  const [kind, setKind] = useState("BULK_TRACKED");

  // Shared
  const [title, setTitle]         = useState("");
  const [description, setDesc]    = useState("");
  const [price, setPrice]         = useState("");
  const [cond, setCond]           = useState({ min: "NM", max: "LP" });
  const [inclusions, setIncl]     = useState([]);
  const [parcelSize, setParcel]   = useState("MEDIUM_PARCEL");
  const [labelPaidBy, setPaidBy]  = useState("buyer");
  const [allowOffers, setOffers]  = useState(true);

  // Tracked
  const [collection, setCollection] = useState([]);
  const [colLoading, setColLoading] = useState(false);
  const [selected, setSelected]     = useState([]);

  // Random
  const [cardCount, setCardCount] = useState("");
  const [lotPhoto, setLotPhoto]   = useState(null); // { name, base64 }

  // Submit
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");
  const [done, setDone] = useState(false);

  // Load collection when switching to Tracked (first time only)
  useEffect(() => {
    if (kind !== "BULK_TRACKED" || !isLoggedIn || collection.length) return;
    setColLoading(true);
    gqlFetch(MY_COLLECTION_QUERY, {}, token)
      .then((data) => setCollection(data?.myCollection ?? []))
      .catch(() => setCollection([]))
      .finally(() => setColLoading(false));
  }, [kind, isLoggedIn, token, collection.length]);

  const totalTracked = selected.reduce((n, s) => n + s.quantity, 0);

  function validate() {
    if (!title.trim()) return "Give the lot a title.";
    const priceNum = parseFloat(price);
    if (!priceNum || priceNum <= 0) return "Enter a valid price for the lot.";
    if (!cond.min || !cond.max) return "Pick a condition range.";
    if (kind === "BULK_TRACKED") {
      if (selected.length === 0) return "Pick at least one card from your collection.";
    }
    if (kind === "BULK_RANDOM") {
      const n = parseInt(cardCount, 10);
      if (!n || n < MIN_CARD_COUNT) return `Random lots need at least ${MIN_CARD_COUNT} cards.`;
      if (!lotPhoto)                 return "Upload a photo of the lot.";
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const bad = validate();
    if (bad) { setErr(bad); return; }
    setBusy(true);
    setErr("");

    const priceNum = parseFloat(price);
    const resolvedCount = kind === "BULK_TRACKED" ? totalTracked : parseInt(cardCount, 10);

    const input = {
      listingKind: kind,
      title: title.trim(),
      description: description.trim() || null,
      price: priceNum,
      currency: "GBP",
      conditionMin: cond.min,
      conditionMax: cond.max,
      cardCount: resolvedCount,
      guaranteedInclusions: inclusions
        .filter((i) => i.description.trim())
        .map((i) => ({ description: i.description.trim(), quantity: i.quantity })),
      parcelSize,
      labelPaidBy,
      allowOffers,
      // Tracked
      items: kind === "BULK_TRACKED"
        ? selected.map((s) => ({
            cardId:    s.cardId,
            variant:   s.variant,
            condition: s.condition,
            quantity:  s.quantity,
          }))
        : null,
      // Random
      lotPhotoBase64: kind === "BULK_RANDOM" ? lotPhoto.base64 : null,
    };

    try {
      await gqlFetch(CREATE_BULK_LOT_MUTATION, { input }, token);
      setDone(true);
    } catch (ex) {
      setErr(ex.message || "Failed to create bulk lot.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-[10px] border border-white/10 bg-black/40 px-3 py-2 text-sm text-neutral-100 " +
    "placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20 transition";
  const labelCls = "text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5 block";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-14 bg-black/70 backdrop-blur-sm px-4 pb-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl rounded-[14px] border border-white/[0.08] bg-[#0d0f17] max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-[#0d0f17]">
          <h2 className="text-sm font-semibold text-neutral-100">Sell a bulk lot</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-[6px] flex items-center justify-center text-neutral-500 hover:text-neutral-100 hover:bg-white/[0.08] transition text-xs"
          >
            ✕
          </button>
        </div>

        {/* Success */}
        {done && (
          <div className="flex flex-col items-center gap-5 py-12 px-6 text-center">
            <div className="w-14 h-14 rounded-[6px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-neutral-100">Bulk lot listed!</p>
              <p className="text-sm text-neutral-400 mt-1">
                {kind === "BULK_RANDOM"
                  ? "Your lot is live — the uploaded photo serves as proof."
                  : "Your lot is pending proof. Head to My Listings to complete it."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { if (onCreated) onCreated(); else onClose(); }}
              className="rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition"
            >
              View my listings
            </button>
          </div>
        )}

        {!done && (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {!isLoggedIn ? (
              <p className="text-sm text-center text-neutral-500 py-8">Please sign in to list cards.</p>
            ) : (
              <>
                {/* Tabs */}
                <Tabs value={kind} onChange={setKind} />

                {/* Mode-specific picker */}
                {kind === "BULK_TRACKED" && (
                  <TrackedPicker
                    collection={collection}
                    loading={colLoading}
                    selected={selected}
                    onChange={setSelected}
                  />
                )}
                {kind === "BULK_RANDOM" && (
                  <div className="grid grid-cols-[120px_1fr] gap-3 items-start">
                    <div>
                      <label className={labelCls}>Card count</label>
                      <input
                        type="number"
                        min={MIN_CARD_COUNT}
                        max="10000"
                        value={cardCount}
                        onChange={(e) => setCardCount(e.target.value)}
                        placeholder={`${MIN_CARD_COUNT}+`}
                        className={inputCls}
                      />
                      <p className="text-[10px] text-neutral-600 mt-1">Min {MIN_CARD_COUNT}</p>
                    </div>
                    <div>
                      <label className={labelCls}>Lot photo</label>
                      <LotPhotoUploader
                        fileName={lotPhoto?.name}
                        onFile={setLotPhoto}
                        onClear={() => setLotPhoto(null)}
                      />
                    </div>
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className={labelCls}>Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={kind === "BULK_TRACKED"
                      ? "e.g. 200 Scarlet & Violet commons"
                      : "e.g. 500 random modern cards, mostly commons"}
                    className={inputCls}
                    maxLength={200}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className={labelCls}>
                    Description <span className="text-neutral-600 font-normal normal-case">(optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDesc(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Rarity mix, sets covered, anything buyers should know…"
                    className={inputCls + " resize-none"}
                  />
                </div>

                {/* Condition range */}
                <ConditionRange min={cond.min} max={cond.max} onChange={setCond} />

                {/* Guaranteed inclusions */}
                <div>
                  <label className={labelCls}>
                    Guaranteed inclusions <span className="text-neutral-600 font-normal normal-case">(optional)</span>
                  </label>
                  <InclusionsEditor items={inclusions} onChange={setIncl} />
                </div>

                {/* Price */}
                <div>
                  <label className={labelCls}>Lot price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500 pointer-events-none">£</span>
                    <input
                      type="number" min="0.01" step="0.01" value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                      className={inputCls + " pl-7"}
                    />
                  </div>
                  {price && (kind === "BULK_TRACKED" ? totalTracked : parseInt(cardCount, 10) || 0) > 0 && (
                    <p className="text-[11px] text-neutral-600 mt-1">
                      ≈ £{(parseFloat(price) / (kind === "BULK_TRACKED" ? totalTracked : parseInt(cardCount, 10))).toFixed(3)} per card
                    </p>
                  )}
                </div>

                {/* Shipping */}
                <div>
                  <label className={labelCls}>Shipping</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PARCEL_SIZES.map((ps) => (
                      <Chip key={ps.value} active={parcelSize === ps.value} onClick={() => setParcel(ps.value)}>
                        {ps.label}
                      </Chip>
                    ))}
                    <span className="text-neutral-700 text-xs select-none">·</span>
                    {[{ value: "seller", label: "Seller pays" }, { value: "buyer", label: "Buyer pays" }].map((opt) => (
                      <Chip key={opt.value} active={labelPaidBy === opt.value} onClick={() => setPaidBy(opt.value)}>
                        {opt.label}
                      </Chip>
                    ))}
                  </div>
                  <p className="text-[11px] text-neutral-600 mt-1.5">
                    {PARCEL_SIZES.find((p) => p.value === parcelSize)?.hint}
                    {labelPaidBy === "buyer" ? " · Cost added to buyer's total." : " · Label cost deducted from proceeds."}
                  </p>
                </div>

                {/* Offers */}
                <div className="flex items-center gap-5">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div
                      onClick={() => setOffers((v) => !v)}
                      className={[
                        "w-4 h-4 rounded border-2 flex items-center justify-center transition shrink-0",
                        allowOffers ? "bg-indigo-600 border-indigo-500" : "border-white/20 group-hover:border-white/40",
                      ].join(" ")}
                    >
                      {allowOffers && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs text-neutral-400">Accept offers on this lot</span>
                  </label>
                </div>

                {/* Return policy notice */}
                {kind === "BULK_RANDOM" && (
                  <div className="rounded-[10px] border border-amber-500/20 bg-amber-500/[0.04] px-4 py-2.5">
                    <p className="text-[11px] text-amber-300/90 leading-relaxed">
                      <span className="font-semibold">Random lots are final-sale.</span> Buyers can only dispute if the lot differs materially from the photo, count, or guaranteed inclusions.
                    </p>
                  </div>
                )}

                {err && (
                  /listing limit/i.test(err) ? (
                    <p className="text-xs text-red-400">
                      {err}{" "}
                      <a href="/subscriptions" className="text-indigo-400 hover:text-indigo-300 underline font-medium">
                        Upgrade your plan →
                      </a>
                    </p>
                  ) : (
                    <p className="text-xs text-red-400">{err}</p>
                  )
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-[10px] py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {busy ? "Listing lot…" : "List this lot"}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
