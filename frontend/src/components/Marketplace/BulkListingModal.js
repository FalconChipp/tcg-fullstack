"use client";

import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { gql, useApolloClient } from "@apollo/client";
import { AuthContext } from "@/components/Auth/AuthProvider";

// ─── GQL ─────────────────────────────────────────────────────────────────────

const MY_COLLECTION_QUERY = gql`
  query MyCollectionForBulkListing {
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

const CREATE_BULK_LISTINGS = gql`
  mutation CreateBulkListings($listings: [BulkListingItemInput!]!) {
    createBulkListings(listings: $listings) {
      batchId
      proofCode
      proofCodeExpiresAt
      count
      listings { id cardId title status }
    }
  }
`;

const SUBMIT_BULK_PROOF = gql`
  mutation SubmitBulkProof($batchId: ID!, $image: String!) {
    submitBulkProof(batchId: $batchId, image: $image) {
      ok
      result
      activated
      newProofCode
    }
  }
`;

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITIONS   = ["NM", "LP", "MP", "HP", "DMG"];
const PARCEL_SIZES = [
  { value: "LARGE_LETTER", label: "Large Letter", hint: "Most singles" },
  { value: "SMALL_PARCEL",  label: "Small Parcel",  hint: "Playsets / decks" },
  { value: "MEDIUM_PARCEL", label: "Medium Parcel", hint: "Bulk lots" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function cardLabel(entry) {
  const c = entry.card;
  if (!c) return entry.cardId;
  const parts = [c.name, c.set?.name, c.number ? `#${c.number}` : null].filter(Boolean);
  return parts.join(" · ");
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function Steps({ current }) {
  const steps = ["Add cards", "Review", "Proof photo"];
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => {
        const idx   = i + 1;
        const done  = idx < current;
        const active = idx === current;
        return (
          <React.Fragment key={label}>
            <div className="flex items-center gap-1.5">
              <div className={`w-5 h-5 rounded-[6px] flex items-center justify-center text-[10px] font-bold shrink-0 ${
                done   ? "bg-emerald-500 text-white" :
                active ? "bg-indigo-600 text-white"  :
                         "bg-white/[0.08] text-neutral-500"
              }`}>
                {done ? "✓" : idx}
              </div>
              <span className={`text-xs font-medium ${active ? "text-neutral-100" : "text-neutral-500"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px ${done ? "bg-emerald-500/40" : "bg-white/[0.08]"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Step 1: Add cards ────────────────────────────────────────────────────────

function AddCardsStep({ batch, onAdd, onRemove, onUpdateItem, onNext, capsMax }) {
  const apollo = useApolloClient();
  const [collection,  setCollection]  = useState([]);
  const [colLoading,  setColLoading]  = useState(true);
  const [search,      setSearch]      = useState("");
  const [defaultCond, setDefaultCond] = useState("NM");

  useEffect(() => {
    apollo.query({ query: MY_COLLECTION_QUERY, fetchPolicy: "network-only" })
      .then(({ data }) => setCollection(data?.myCollection ?? []))
      .catch(() => {})
      .finally(() => setColLoading(false));
  }, [apollo]);

  const filtered = collection.filter((e) => {
    if (!search) return true;
    const name = e.card?.name?.toLowerCase() ?? "";
    const set  = e.card?.set?.name?.toLowerCase() ?? "";
    const q    = search.toLowerCase();
    return name.includes(q) || set.includes(q);
  });

  const alreadyAdded = (entry) => batch.some(
    (b) => b.cardId === entry.cardId && b.variation === entry.variation
  );

  const handleAdd = (entry) => {
    if (alreadyAdded(entry)) return;
    if (capsMax !== null && batch.length >= capsMax) return;
    onAdd({
      cardId:    entry.cardId,
      variation: entry.variation,
      card:      entry.card,
      condition: defaultCond,
      price:     "",
      willTrade: false,
    });
  };

  const atLimit = capsMax !== null && batch.length >= capsMax;

  return (
    <div className="flex flex-col gap-4">
      {/* Default condition quick-set */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500 shrink-0">Default condition:</span>
        <div className="flex gap-1">
          {CONDITIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setDefaultCond(c)}
              className={`px-2.5 py-0.5 rounded-[6px] text-xs font-medium border transition-colors ${
                defaultCond === c
                  ? "bg-indigo-600/80 border-indigo-500 text-white"
                  : "bg-white/[0.04] border-white/10 text-neutral-400 hover:border-white/25"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: collection search */}
        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Search your collection…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-[6px] bg-white/[0.06] border border-white/10 px-3 py-2 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
          />
          <div className="overflow-y-auto max-h-72 rounded-[10px] border border-white/[0.06] divide-y divide-white/[0.04]">
            {colLoading && (
              <div className="py-8 text-center text-xs text-neutral-600">Loading collection…</div>
            )}
            {!colLoading && filtered.length === 0 && (
              <div className="py-8 text-center text-xs text-neutral-600">No cards found.</div>
            )}
            {filtered.map((entry, i) => {
              const added = alreadyAdded(entry);
              return (
                <button
                  key={`${entry.cardId}-${entry.variation}-${i}`}
                  type="button"
                  onClick={() => handleAdd(entry)}
                  disabled={added || atLimit}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 text-left text-xs transition-colors ${
                    added   ? "opacity-40 cursor-default" :
                    atLimit ? "opacity-40 cursor-not-allowed" :
                              "hover:bg-white/[0.06] cursor-pointer"
                  }`}
                >
                  <div className="shrink-0 w-7 h-10 rounded overflow-hidden bg-white/[0.04]">
                    {entry.card?.images?.small
                      ? <img src={entry.card.images.small} alt="" className="w-full h-full object-contain" />
                      : <div className="w-full h-full" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-100 truncate">{entry.card?.name ?? entry.cardId}</p>
                    <p className="text-neutral-500 truncate">{[entry.card?.set?.name, entry.variation].filter(Boolean).join(" · ")}</p>
                  </div>
                  {added
                    ? <span className="text-emerald-500 text-[10px] font-semibold">Added</span>
                    : <span className="text-neutral-600 text-[10px]">+ Add</span>}
                </button>
              );
            })}
          </div>
          {atLimit && (
            <p className="text-[11px] text-amber-400 text-center">
              Listing limit reached for your plan ({capsMax}).
            </p>
          )}
        </div>

        {/* Right: batch queue */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300">
              Batch ({batch.length}{capsMax !== null ? `/${capsMax}` : ""})
            </span>
            {batch.length > 0 && (
              <button
                type="button"
                onClick={() => batch.forEach((_, i) => onRemove(0))}
                className="text-[11px] text-neutral-600 hover:text-rose-400 transition"
              >
                Clear all
              </button>
            )}
          </div>

          {batch.length === 0 ? (
            <div className="flex-1 rounded-[10px] border border-dashed border-white/[0.08] flex items-center justify-center min-h-[200px]">
              <p className="text-xs text-neutral-600">Select cards from your collection</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-72 space-y-1.5">
              {batch.map((item, i) => (
                <div key={i} className="rounded-[6px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 flex items-center gap-2">
                  <div className="shrink-0 w-6 h-9 rounded overflow-hidden bg-white/[0.04]">
                    {item.card?.images?.small
                      ? <img src={item.card.images.small} alt="" className="w-full h-full object-contain" />
                      : <div className="w-full h-full" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-neutral-200 truncate">{item.card?.name ?? item.cardId}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {/* Condition */}
                      <select
                        value={item.condition}
                        onChange={(e) => onUpdateItem(i, { condition: e.target.value })}
                        className="bg-white/[0.06] border border-white/10 rounded text-[10px] text-neutral-300 px-1 py-0.5 focus:outline-none"
                      >
                        {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {/* Price */}
                      <div className="flex items-center gap-0.5">
                        <span className="text-[10px] text-neutral-500">£</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Price"
                          value={item.price}
                          onChange={(e) => onUpdateItem(i, { price: e.target.value })}
                          className="w-16 bg-white/[0.06] border border-white/10 rounded text-[10px] text-neutral-100 px-1.5 py-0.5 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    className="text-neutral-600 hover:text-rose-400 transition shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onNext}
          disabled={batch.length === 0}
          className="px-5 py-2 rounded-[10px] text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Review {batch.length > 0 ? `${batch.length} listing${batch.length !== 1 ? "s" : ""}` : ""} →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Review ───────────────────────────────────────────────────────────

function ReviewStep({ batch, onUpdateItem, onRemove, onBack, onSubmit, submitting, error }) {
  const [shipping,     setShipping]     = useState({ type: "FIXED", price: "1.99", parcelSize: "LARGE_LETTER", labelPaidBy: "seller" });
  const [applyToAll,   setApplyToAll]   = useState(true);

  const handleSubmit = () => {
    const listings = batch.map((item) => ({
      cardId:       item.cardId,
      title:        item.card?.name ?? item.cardId,
      condition:    item.condition,
      variant:      item.variation ?? null,
      price:        item.price ? Number(item.price) : null,
      currency:     "GBP",
      quantity:     1,
      willTrade:    item.willTrade,
      allowOffers:  true,
      ...(applyToAll ? {
        shippingType:  shipping.type,
        shippingPrice: shipping.type === "FIXED" ? Number(shipping.price) : null,
        parcelSize:    shipping.parcelSize,
        labelPaidBy:   shipping.labelPaidBy,
      } : {}),
    }));
    onSubmit(listings);
  };

  const totalValue = batch
    .reduce((sum, item) => sum + (item.price ? Number(item.price) : 0), 0)
    .toFixed(2);

  return (
    <div className="flex flex-col gap-4">
      {/* Card list */}
      <div className="rounded-[10px] border border-white/[0.08] overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1fr_80px_80px_32px] gap-3 px-4 py-2 border-b border-white/[0.06] text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">
          <div>Card</div><div>Condition</div><div>Price</div><div />
        </div>
        <div className="divide-y divide-white/[0.05]">
          {batch.map((item, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_80px_32px] gap-3 px-4 py-2.5 items-center">
              <div className="flex items-center gap-2 min-w-0">
                <div className="shrink-0 w-6 h-9 rounded overflow-hidden bg-white/[0.04]">
                  {item.card?.images?.small
                    ? <img src={item.card.images.small} alt="" className="w-full h-full object-contain" />
                    : <div className="w-full h-full" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-neutral-200 truncate">{item.card?.name ?? item.cardId}</p>
                  <p className="text-[10px] text-neutral-600 truncate">{item.card?.set?.name}</p>
                </div>
              </div>
              <select
                value={item.condition}
                onChange={(e) => onUpdateItem(i, { condition: e.target.value })}
                className="bg-white/[0.06] border border-white/10 rounded text-xs text-neutral-300 px-1.5 py-1 focus:outline-none w-full"
              >
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex items-center gap-0.5">
                <span className="text-xs text-neutral-500">£</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.price}
                  onChange={(e) => onUpdateItem(i, { price: e.target.value })}
                  className="w-full bg-white/[0.06] border border-white/10 rounded text-xs text-neutral-100 px-1.5 py-1 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-neutral-600 hover:text-rose-400 transition mx-auto"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Shipping */}
      <div className="rounded-[10px] border border-white/[0.08] p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-neutral-300">Shipping (applied to all)</span>
          <label className="flex items-center gap-1.5 text-xs text-neutral-500 cursor-pointer">
            <input type="checkbox" checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)} className="accent-indigo-500" />
            Apply to all
          </label>
        </div>
        {applyToAll && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-neutral-500 mb-1">Parcel size</label>
              <select
                value={shipping.parcelSize}
                onChange={(e) => setShipping((s) => ({ ...s, parcelSize: e.target.value }))}
                className="w-full bg-white/[0.06] border border-white/10 rounded text-xs text-neutral-300 px-2 py-1.5 focus:outline-none"
              >
                {PARCEL_SIZES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label} — {p.hint}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-neutral-500 mb-1">Shipping price</label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-neutral-500">£</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shipping.price}
                  onChange={(e) => setShipping((s) => ({ ...s, price: e.target.value }))}
                  className="w-full bg-white/[0.06] border border-white/10 rounded text-xs text-neutral-100 px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] text-neutral-500 mb-1">Paid by</label>
              <div className="flex gap-2">
                {["seller", "buyer"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setShipping((s) => ({ ...s, labelPaidBy: v }))}
                    className={`flex-1 py-1 rounded text-xs font-medium border transition-colors capitalize ${
                      shipping.labelPaidBy === v
                        ? "bg-indigo-600/70 border-indigo-500 text-white"
                        : "bg-white/[0.04] border-white/10 text-neutral-400"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
        <span>{batch.length} listing{batch.length !== 1 ? "s" : ""}</span>
        <span>Total value: £{totalValue}</span>
      </div>

      {error && (
        <div className="rounded-[6px] border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || batch.length === 0}
          className="px-5 py-2 rounded-[10px] text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 disabled:cursor-wait"
        >
          {submitting ? "Creating listings…" : `Create ${batch.length} listing${batch.length !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Proof photo ──────────────────────────────────────────────────────

function ProofStep({ batchId, proofCode, count, onBack, onDone }) {
  const apollo          = useApolloClient();
  const fileRef         = useRef(null);
  const [image,         setImage]         = useState(null);
  const [preview,       setPreview]       = useState(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [result,        setResult]        = useState(null); // 'approved' | 'pending_admin' | 'expired'
  const [activated,     setActivated]     = useState(0);
  const [newCode,       setNewCode]       = useState(null);
  const [error,         setError]         = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    const b64 = await toBase64(file);
    setImage(b64);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!image) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await apollo.mutate({
        mutation: SUBMIT_BULK_PROOF,
        variables: { batchId, image },
      });
      const res = data?.submitBulkProof;
      if (res?.result === "expired") {
        setNewCode(res.newProofCode);
        setResult("expired");
      } else {
        setResult(res?.result ?? "pending_admin");
        setActivated(res?.activated ?? 0);
      }
    } catch (err) {
      setError(err?.message ?? "Upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Expired — show new code
  if (result === "expired") {
    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center">
        <div className="w-12 h-12 rounded-[6px] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-neutral-100 mb-1">Proof code expired</p>
          <p className="text-xs text-neutral-500 mb-3">A new code has been issued. Re-photograph with the new code below.</p>
          <div className="inline-block bg-white/[0.06] border border-white/10 rounded-[10px] px-5 py-3">
            <p className="text-[11px] text-neutral-500 mb-1 uppercase tracking-wide">New proof code</p>
            <p className="text-2xl font-black tracking-[0.2em] text-neutral-100 font-mono">{newCode}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setResult(null); setImage(null); setPreview(null); setNewCode(null); }}
          className="px-5 py-2 rounded-[10px] text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition"
        >
          Upload new photo
        </button>
      </div>
    );
  }

  // Success
  if (result === "approved") {
    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center">
        <div className="w-14 h-14 rounded-[6px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-base font-bold text-neutral-100 mb-1">
            {activated} listing{activated !== 1 ? "s" : ""} verified and live!
          </p>
          <p className="text-xs text-neutral-500">Your cards are now visible on the marketplace.</p>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="px-6 py-2.5 rounded-[10px] text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition"
        >
          Done
        </button>
      </div>
    );
  }

  // Under review
  if (result === "pending_admin") {
    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center">
        <div className="w-14 h-14 rounded-[6px] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
        <div>
          <p className="text-base font-bold text-neutral-100 mb-1">Under review</p>
          <p className="text-xs text-neutral-500 max-w-xs">
            Our team couldn't auto-verify your photo. A moderator will review your {count} listing{count !== 1 ? "s" : ""} shortly and activate them.
          </p>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="px-6 py-2.5 rounded-[10px] text-sm font-semibold border border-white/10 text-neutral-400 hover:bg-white/[0.06] transition"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Proof code */}
      <div className="rounded-[10px] border border-amber-500/20 bg-amber-500/[0.06] p-5">
        <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wide mb-2">Your proof code</p>
        <p className="text-3xl font-black tracking-[0.2em] text-neutral-100 font-mono mb-3">{proofCode}</p>
        <ol className="space-y-1.5 text-xs text-neutral-400">
          <li className="flex gap-2">
            <span className="shrink-0 w-4 h-4 rounded-[6px] bg-amber-500/20 text-amber-400 text-[9px] font-bold flex items-center justify-center">1</span>
            Lay all <strong className="text-neutral-200 mx-1">{count} card{count !== 1 ? "s" : ""}</strong> face-up together in one shot.
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 w-4 h-4 rounded-[6px] bg-amber-500/20 text-amber-400 text-[9px] font-bold flex items-center justify-center">2</span>
            Write <strong className="text-neutral-200 mx-1 font-mono">{proofCode}</strong> on a piece of paper and place it clearly in front of the cards.
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 w-4 h-4 rounded-[6px] bg-amber-500/20 text-amber-400 text-[9px] font-bold flex items-center justify-center">3</span>
            Take one clear photo showing all cards face-up and the code visible.
          </li>
        </ol>
      </div>

      {/* Upload area */}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {preview ? (
          <div className="relative rounded-[10px] overflow-hidden border border-white/10 bg-black/40">
            <img src={preview} alt="Proof" className="w-full max-h-52 object-contain" />
            <button
              type="button"
              onClick={() => { setImage(null); setPreview(null); }}
              className="absolute top-2 right-2 w-7 h-7 rounded-[6px] bg-black/60 text-neutral-300 hover:text-white flex items-center justify-center transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-[10px] border-2 border-dashed border-white/10 hover:border-indigo-500/50 bg-white/[0.02] hover:bg-white/[0.04] transition py-10 flex flex-col items-center gap-2 text-neutral-600 hover:text-neutral-400"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium">Tap to take photo or upload</span>
            <span className="text-xs">Show all {count} cards with the code visible</span>
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-[6px] border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!image || submitting}
          className="px-5 py-2 rounded-[10px] text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting…" : "Submit proof photo"}
        </button>
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function BulkListingModal({ open, onClose, onComplete, capsMax = null }) {
  const auth = useContext(AuthContext) || {};
  const isLoggedIn = !!(auth.user || auth.token);
  const apollo = useApolloClient();

  const [step,       setStep]       = useState(1);
  const [batch,      setBatch]      = useState([]);
  const [batchId,    setBatchId]    = useState(null);
  const [proofCode,  setProofCode]  = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);

  // Reset when modal opens/closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep(1);
        setBatch([]);
        setBatchId(null);
        setProofCode(null);
        setError(null);
      }, 300);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const addToBatch = useCallback((item) => {
    setBatch((b) => [...b, item]);
  }, []);

  const removeFromBatch = useCallback((idx) => {
    setBatch((b) => b.filter((_, i) => i !== idx));
  }, []);

  const updateItem = useCallback((idx, updates) => {
    setBatch((b) => b.map((item, i) => i === idx ? { ...item, ...updates } : item));
  }, []);

  const handleSubmitListings = async (listings) => {
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await apollo.mutate({
        mutation: CREATE_BULK_LISTINGS,
        variables: { listings },
      });
      const res = data?.createBulkListings;
      setBatchId(res.batchId);
      setProofCode(res.proofCode);
      setStep(3);
    } catch (err) {
      setError(err?.message ?? "Failed to create listings. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[10px] bg-[#0d0f17] border border-white/[0.08]  flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <div>
            <h2 className="text-sm font-bold text-neutral-100">Bulk Listing</h2>
            <p className="text-xs text-neutral-500 mt-0.5">List multiple cards with one proof photo</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-[6px] flex items-center justify-center text-neutral-500 hover:text-neutral-100 hover:bg-white/[0.08] transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-5">
          {!isLoggedIn ? (
            <p className="text-sm text-center text-neutral-500 py-12">Please sign in to list cards.</p>
          ) : (
            <>
              <Steps current={step} />

              {step === 1 && (
                <AddCardsStep
                  batch={batch}
                  onAdd={addToBatch}
                  onRemove={removeFromBatch}
                  onUpdateItem={updateItem}
                  onNext={() => setStep(2)}
                  capsMax={capsMax}
                />
              )}

              {step === 2 && (
                <ReviewStep
                  batch={batch}
                  onUpdateItem={updateItem}
                  onRemove={removeFromBatch}
                  onBack={() => setStep(1)}
                  onSubmit={handleSubmitListings}
                  submitting={submitting}
                  error={error}
                />
              )}

              {step === 3 && batchId && proofCode && (
                <ProofStep
                  batchId={batchId}
                  proofCode={proofCode}
                  count={batch.length}
                  onBack={() => setStep(2)}
                  onDone={() => { onComplete?.(); onClose(); }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
