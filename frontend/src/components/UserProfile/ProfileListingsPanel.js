// src/components/UserProfile/ProfileListingsPanel.js
"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import CardImage from "@/components/Cards/CardImage";
import Link from "next/link";
import { getCardImageUrl } from "@/utils/imageUtils";
import { gqlFetch } from "@/utils/apiClient";
import CardSkeleton from "@/components/UI/CardSkeleton";

/* ─── GQL ─────────────────────────────────────────────────────────────────── */

function gql(token, query, variables = {}) {
  return gqlFetch(query, variables, token);
}

const MY_LISTINGS_QUERY = `
  query MyListings($status: ListingStatus, $limit: Int) {
    myListings(status: $status, limit: $limit) {
      id cardId title condition variant price quantity status
      allowOffers willTrade proofCode createdAt
      cardInfo { name imageSmall setName number rarity }
    }
  }
`;

const PUBLIC_LISTINGS_QUERY = `
  query PublicListings($sellerId: ID!, $limit: Int) {
    listings(sellerId: $sellerId, status: ACTIVE, limit: $limit) {
      ... on CardListing {
        id cardId title condition variant price quantity status
        allowOffers willTrade createdAt
        cardInfo { name imageSmall setName number rarity }
      }
    }
  }
`;

const UPDATE_MUTATION = `
  mutation UpdateListing($id: ID!, $input: UpdateListingInput!) {
    updateListing(id: $id, input: $input) {
      id price quantity allowOffers willTrade status
    }
  }
`;

const DELETE_MUTATION = `
  mutation DeleteListing($id: ID!) { deleteListing(id: $id) }
`;

const SUBMIT_PROOF_MUTATION = `
  mutation SubmitListingProof($id: ID!, $image: String!) {
    submitListingProof(id: $id, image: $image) {
      ok result newProofCode
    }
  }
`;

/* ─── Constants ───────────────────────────────────────────────────────────── */

const CONDITION_LABELS = {
  NM: "Near Mint", LP: "Lightly Played", MP: "Mod. Played",
  HP: "Heavily Played", DMG: "Damaged",
};

const CONDITION_SHORT = {
  NM: "NM", LP: "LP", MP: "MP", HP: "HP", DMG: "DMG",
};

const STATUS_META = {
  ACTIVE:        { label: "Active",       cls: "bg-emerald-500 text-white" },
  PENDING_PROOF: { label: "Needs proof",  cls: "bg-amber-500 text-white" },
  SOLD:          { label: "Sold",         cls: "bg-blue-500 text-white" },
  CANCELLED:     { label: "Delisted",     cls: "bg-neutral-500 text-white" },
};

const CONDITION_COLOR = {
  NM:  "bg-emerald-500/80 text-white",
  LP:  "bg-teal-500/80 text-white",
  MP:  "bg-amber-500/80 text-white",
  HP:  "bg-orange-500/80 text-white",
  DMG: "bg-red-500/80 text-white",
};

const STATUS_FILTERS = [
  { value: null,            label: "All" },
  { value: "ACTIVE",        label: "Active" },
  { value: "PENDING_PROOF", label: "Needs proof" },
  { value: "SOLD",          label: "Sold" },
  { value: "CANCELLED",     label: "Delisted" },
];

const SORT_OPTIONS = [
  { value: "price-asc",  label: "Price (Low → High)" },
  { value: "price-desc", label: "Price (High → Low)" },
  { value: "name-asc",   label: "Name (A–Z)" },
  { value: "name-desc",  label: "Name (Z–A)" },
  { value: "date-desc",  label: "Newest first" },
  { value: "date-asc",   label: "Oldest first" },
];

/* ─── Edit modal ──────────────────────────────────────────────────────────── */

function EditModal({ listing, token, onSaved, onClose }) {
  const [price, setPrice]             = useState(String(listing.price ?? ""));
  const [qty, setQty]                 = useState(String(listing.quantity ?? 1));
  const [allowOffers, setAllowOffers] = useState(!!listing.allowOffers);
  const [willTrade, setWillTrade]     = useState(!!listing.willTrade);
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState(null);

  async function save() {
    setSaving(true); setErr(null);
    try {
      await gql(token, UPDATE_MUTATION, {
        id: listing.id,
        input: { price: Number(price) || listing.price, quantity: Number(qty) || listing.quantity, allowOffers, willTrade },
      });
      onSaved({ price: Number(price), quantity: Number(qty), allowOffers, willTrade });
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[10px] border border-vault-border bg-vault-surface  overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-vault-border">
          <div>
            <h3 className="font-bold text-vault-text">Edit listing</h3>
            <p className="text-xs text-vault-textTertiary mt-0.5 truncate max-w-[260px]">
              {listing.cardInfo?.name || listing.title}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-[6px] hover:bg-vault-raised dark:hover:bg-vault-raised transition text-vault-textTertiary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-vault-textTertiary">Price (£)</label>
              <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-vault-text focus:outline-none focus:ring-2 focus:ring-vault-accent dark:focus:ring-vault-accent text-sm transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-vault-textTertiary">Quantity</label>
              <input type="number" min="1" step="1" value={qty} onChange={e => setQty(e.target.value)}
                className="w-full px-3 py-2 rounded-[6px] border border-vault-border bg-vault-raised text-vault-text focus:outline-none focus:ring-2 focus:ring-vault-accent dark:focus:ring-vault-accent text-sm transition" />
            </div>
          </div>

          <div className="flex gap-5">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-vault-text">
              <input type="checkbox" className="accent-vault-accent dark:accent-vault-accent w-4 h-4"
                checked={allowOffers} onChange={e => setAllowOffers(e.target.checked)} />
              Allow offers
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-vault-text">
              <input type="checkbox" className="accent-vault-accent dark:accent-vault-accent w-4 h-4"
                checked={willTrade} onChange={e => setWillTrade(e.target.checked)} />
              Will trade
            </label>
          </div>

          {err && <p className="text-xs text-red-500">{err}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-[10px] text-sm font-semibold bg-vault-accent text-vault-text hover:bg-vault-accentHover transition disabled:opacity-50">
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button onClick={onClose}
              className="px-4 py-2.5 rounded-[10px] text-sm font-semibold border border-vault-border bg-vault-raised hover:bg-vault-surface dark:hover:bg-vault-surface transition">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Proof modal ─────────────────────────────────────────────────────────── */

function ProofModal({ listing: initial, token, onActivated, onClose }) {
  const [listing, setListing] = useState(initial);
  const [file, setFile]       = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]   = useState(null);
  const [err, setErr]         = useState(null);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    // Convert any format (AVIF, HEIC, WEBP, PNG…) to JPEG via canvas
    // so Tesseract always receives a format it can read
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        setPreview(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => setPreview(ev.target.result); // fallback: send as-is
      img.src = ev.target.result;
    };
    reader.readAsDataURL(f);
  }

  async function submit() {
    if (!file || !preview) return;
    setSubmitting(true); setErr(null); setResult(null);
    try {
      const data = await gql(token, SUBMIT_PROOF_MUTATION, { id: listing.id, image: preview });
      const res = data?.submitListingProof;
      setResult(res);
      if (res?.result === 'approved') {
        onActivated(listing.id);
      } else if (res?.result === 'expired' && res?.newProofCode) {
        setListing(l => ({ ...l, proofCode: res.newProofCode }));
        setFile(null); setPreview(null);
      }
    } catch (e) { setErr(e.message); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[10px] border border-vault-border bg-vault-surface  overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-vault-border">
          <div>
            <h3 className="font-bold text-vault-text">Submit proof</h3>
            <p className="text-xs text-vault-textTertiary mt-0.5 truncate max-w-[260px]">
              {listing.cardInfo?.name || listing.title}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-[6px] hover:bg-vault-raised dark:hover:bg-vault-raised transition text-vault-textTertiary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {result?.result === 'approved' ? (
            <div className="p-4 rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-600 dark:text-emerald-400 font-semibold text-center">
              ✅ Proof approved — your listing is now live!
            </div>
          ) : result?.result === 'pending_admin' ? (
            <div className="p-4 rounded-[10px] bg-amber-500/10 border border-amber-500/30 text-sm text-amber-600 dark:text-amber-400 font-semibold text-center">
              ⏳ Submitted — under admin review.
            </div>
          ) : result?.result === 'processing' ? (
            <div className="p-4 rounded-[10px] bg-blue-500/10 border border-blue-500/30 text-sm text-blue-400 font-semibold text-center space-y-1">
              <p>🔍 Photo received — verifying now.</p>
              <p className="text-xs font-normal text-vault-textTertiary">
                This usually takes under a minute. Check your notifications — we'll let you know once it's approved.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-[10px] border border-amber-500/30 bg-amber-500/5 p-4 space-y-1">
                <p className="text-xs font-semibold text-vault-textTertiary uppercase tracking-wide mb-2">Your proof code</p>
                <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-[10px] bg-vault-raised border-2 border-amber-500/40">
                  <span className="font-mono font-extrabold text-xl tracking-[0.2em] text-amber-600 dark:text-amber-400 select-all">
                    {listing.proofCode}
                  </span>
                </div>
                <p className="text-xs text-vault-textTertiary leading-relaxed mt-2">
                  Write this code on paper, place it next to the card, and take a clear photo showing both.
                </p>
                {result?.result === 'expired' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                    ⚠️ Previous code expired — new code issued above.
                  </p>
                )}
              </div>

              <label className="flex flex-col items-center justify-center w-full rounded-[10px] border-2 border-dashed border-vault-border bg-vault-raised cursor-pointer hover:bg-vault-surface dark:hover:bg-vault-surface transition overflow-hidden">
                {preview ? (
                  <img src={preview} alt="Proof preview" className="w-full max-h-48 object-contain p-2" />
                ) : (
                  <div className="py-6 text-center">
                    <div className="text-3xl mb-2">📷</div>
                    <p className="text-sm text-vault-textTertiary">Click to select photo</p>
                    <p className="text-xs text-vault-textTertiary mt-0.5">JPG, PNG, WEBP</p>
                  </div>
                )}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
              </label>

              {err && <p className="text-xs text-red-500">{err}</p>}

              <button onClick={submit} disabled={!file || submitting}
                className="w-full py-2.5 rounded-[10px] text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white transition disabled:opacity-50">
                {submitting ? "Submitting…" : "Submit proof"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Card tile ───────────────────────────────────────────────────────────── */

function ListingTile({ listing: initial, token, isOwnProfile, onDelisted }) {
  const [listing, setListing]   = useState(initial);
  const [showEdit, setShowEdit] = useState(false);
  const [showProof, setShowProof] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const name    = listing.cardInfo?.name || listing.title || "Card listing";
  const img     = listing.cardInfo?.imageSmall || null;
  const setName = listing.cardInfo?.setName || null;
  const cond    = listing.condition;
  const status  = listing.status;

  const isActive  = status === "ACTIVE";
  const isPending = status === "PENDING_PROOF";

  async function delist() {
    setDeleting(true);
    try {
      await gql(token, DELETE_MUTATION, { id: listing.id });
      onDelisted(listing.id);
    } catch { setDeleting(false); }
  }

  return (
    <>
      <div className="bg-vault-surface rounded-[10px]  p-3 flex flex-col group hover: transition">

        {/* Image */}
        <div className="relative w-full aspect-[245/337] bg-vault-raised rounded-[6px] overflow-hidden mb-2">
          <CardImage
            src={img ? getCardImageUrl(img) : null}
            name={name}
            cardId={listing.cardId}
            className="absolute inset-0 w-full h-full object-contain rounded-[6px] group-hover:scale-105 transition-transform duration-300"
          />

          {/* Condition overlay */}
          {cond && (
            <span className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-[6px] text-[10px] font-bold ${CONDITION_COLOR[cond] ?? "bg-black/60 text-white"}`}>
              {CONDITION_SHORT[cond] ?? cond}
            </span>
          )}

          {/* Status overlay — own profile */}
          {isOwnProfile && status && status !== "ACTIVE" && (
            <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-[6px] text-[10px] font-bold ${STATUS_META[status]?.cls ?? "bg-neutral-500 text-white"}`}>
              {STATUS_META[status]?.label ?? status}
            </span>
          )}

          {/* Quantity overlay */}
          {listing.quantity > 1 && (
            <span className="absolute top-2 right-2 bg-black/70 text-white px-2 py-0.5 rounded-[6px] text-[10px] font-bold">
              ×{listing.quantity}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col min-w-0">
          <p className="font-bold text-sm text-vault-text truncate" title={name}>{name}</p>
          {setName && (
            <p className="text-xs text-vault-textTertiary truncate">{setName}</p>
          )}

          {/* Price row */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {listing.willTrade && !listing.price ? (
              <span className="font-extrabold text-sm text-violet-500 dark:text-violet-400">Trade only</span>
            ) : (
              <span className="font-extrabold text-sm text-vault-text">
                £{Number(listing.price || 0).toFixed(2)}
              </span>
            )}
            {listing.allowOffers && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-[6px] bg-vault-accent/10 dark:bg-vault-accent/10 text-vault-accent font-semibold">Offers</span>
            )}
            {listing.willTrade && listing.price > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-[6px] bg-violet-500/10 text-violet-500 dark:text-violet-400 font-semibold">Trade</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex flex-wrap gap-1.5 items-center">
          {/* Own profile */}
          {isOwnProfile && isPending && (
            <button onClick={() => setShowProof(true)}
              className="flex-1 py-1.5 rounded-[6px] text-xs font-semibold bg-amber-500/10 border border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition">
              Submit proof
            </button>
          )}
          {isOwnProfile && isActive && (
            <button onClick={() => setShowEdit(true)}
              className="flex-1 py-1.5 rounded-[6px] text-xs font-semibold border border-vault-border bg-vault-raised hover:bg-vault-surface dark:hover:bg-vault-surface transition text-vault-text">
              Edit
            </button>
          )}
          {isOwnProfile && isActive && !confirmDel && (
            <button onClick={() => setConfirmDel(true)}
              className="flex-1 py-1.5 rounded-[6px] text-xs font-semibold border border-red-400/40 text-red-500 hover:bg-red-500/10 transition">
              Delist
            </button>
          )}
          {isOwnProfile && isActive && confirmDel && (
            <div className="flex gap-1 flex-1">
              <button onClick={delist} disabled={deleting}
                className="flex-1 py-1.5 rounded-[6px] text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50">
                {deleting ? "…" : "Confirm"}
              </button>
              <button onClick={() => setConfirmDel(false)}
                className="flex-1 py-1.5 rounded-[6px] text-xs font-semibold border border-vault-border bg-vault-raised transition">
                No
              </button>
            </div>
          )}

          {/* Public profile */}
          {!isOwnProfile && isActive && (
            <Link href="/marketplace"
              className="flex-1 text-center py-1.5 rounded-[6px] text-xs font-semibold bg-vault-accent !text-white hover:bg-vault-accentHover transition">
              View on marketplace
            </Link>
          )}
        </div>
      </div>

      {/* Modals */}
      {showEdit && (
        <EditModal listing={listing} token={token}
          onSaved={updated => { setListing(l => ({ ...l, ...updated })); setShowEdit(false); }}
          onClose={() => setShowEdit(false)} />
      )}
      {showProof && (
        <ProofModal listing={listing} token={token}
          onActivated={() => { setListing(l => ({ ...l, status: "ACTIVE" })); setShowProof(false); }}
          onClose={() => setShowProof(false)} />
      )}
    </>
  );
}

/* ─── Skeleton grid ───────────────────────────────────────────────────────── */

function ListingsSkeletonGrid({ count = 10, compact = false }) {
  return (
    <div className={compact
      ? "grid grid-cols-2 gap-3 mt-2"
      : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mt-2"
    }>
      {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}

/* ─── Main panel ──────────────────────────────────────────────────────────── */

export default function ProfileListingsPanel({ userId, isOwnProfile, token, compact = false, fixedStatus = null, onCreateListing }) {
  const [listings, setListings]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [search, setSearch]             = useState("");
  const [sortOption, setSortOption]     = useState("date-desc");

  // When fixedStatus is set, always query with that status and ignore the UI filter
  const effectiveStatus = fixedStatus ?? statusFilter;

  const load = useCallback(async (status) => {
    setLoading(true); setError(null);
    try {
      let items = [];
      if (isOwnProfile) {
        const data = await gql(token, MY_LISTINGS_QUERY, { ...(status ? { status } : {}), limit: 200 });
        items = data?.myListings ?? [];
      } else {
        const data = await gql(null, PUBLIC_LISTINGS_QUERY, { sellerId: userId, limit: 200 });
        items = (data?.listings ?? []).filter(Boolean);
      }
      setListings(items);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, userId, isOwnProfile]);

  useEffect(() => { load(effectiveStatus); }, [load, effectiveStatus]);

  function handleDelisted(id) {
    setListings(ls => ls.map(l => l.id === id ? { ...l, status: "CANCELLED" } : l));
  }

  // Derived
  const counts      = useMemo(() => listings.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc; }, {}), [listings]);
  const activeCount = counts["ACTIVE"] ?? 0;

  const displayed = useMemo(() => {
    let arr = statusFilter ? listings.filter(l => l.status === statusFilter) : listings;
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(l => (l.cardInfo?.name || l.title || "").toLowerCase().includes(q));
    }
    const [by, dir] = sortOption.split("-");
    const mult = dir === "asc" ? 1 : -1;
    return [...arr].sort((a, b) => {
      if (by === "price") return mult * ((Number(a.price) || 0) - (Number(b.price) || 0));
      if (by === "name")  return mult * ((a.cardInfo?.name || a.title || "").localeCompare(b.cardInfo?.name || b.title || ""));
      if (by === "date")  return mult * (new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      return 0;
    });
  }, [listings, statusFilter, search, sortOption]);

  return (
    <section className="w-full max-w-8xl mx-auto mt-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 mb-4">
        <div>
          <h3 className="text-xl font-extrabold text-vault-accent dark:text-vault-accent">
            {isOwnProfile ? "My listings" : "Listings"}
          </h3>
          <p className="text-sm text-vault-textTertiary mt-0.5">
            {isOwnProfile
              ? "Manage your card listings"
              : activeCount > 0
                ? `${activeCount} card${activeCount !== 1 ? "s" : ""} for sale`
                : "No active listings right now"}
          </p>
        </div>
        {isOwnProfile && (
          <div className="flex gap-2">
            {onCreateListing ? (
              <button type="button" onClick={onCreateListing}
                className="px-4 py-2 rounded-[10px] text-sm font-semibold bg-vault-accent !text-white hover:bg-vault-accentHover transition">
                + New listing
              </button>
            ) : (
              <Link href="/marketplace"
                className="px-4 py-2 rounded-[10px] text-sm font-semibold bg-vault-accent !text-white hover:bg-vault-accentHover transition">
                + New listing
              </Link>
            )}
            <button type="button" onClick={() => load(effectiveStatus)}
              className="px-3 py-2 rounded-[10px] text-sm border border-vault-border bg-vault-raised hover:bg-vault-surface dark:hover:bg-vault-surface transition">
              ↺
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 mb-4 px-4">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative w-[200px]">
            <input type="text" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-vault-surface text-vault-text rounded-md px-3 pl-8 py-1.5 border border-vault-border focus:border-vault-accent dark:focus:border-vault-accent outline-none text-sm h-9 font-semibold transition" />
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-vault-textSecondary pointer-events-none" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </div>

          {/* Sort */}
          <select value={sortOption} onChange={e => setSortOption(e.target.value)}
            className="bg-vault-surface text-vault-text rounded-md px-3 py-1.5 border border-vault-border focus:border-vault-accent dark:focus:border-vault-accent outline-none text-sm h-9 font-semibold transition">
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Status pills — own profile only, hidden when fixedStatus is set */}
        {isOwnProfile && !fixedStatus && (
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map(f => {
              const active = statusFilter === f.value;
              const count  = f.value ? (counts[f.value] ?? 0) : listings.length;
              return (
                <button key={String(f.value)} type="button" onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 rounded-[6px] text-sm font-semibold border transition flex items-center gap-1.5
                    ${active
                      ? "bg-vault-accent text-vault-text border-transparent"
                      : "border-vault-border bg-vault-raised text-vault-text hover:bg-vault-surface dark:hover:bg-vault-surface"}`}>
                  {f.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-[6px] ${active ? "bg-white/20" : "bg-vault-border dark:bg-vault-border"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Result count */}
        <p className="text-xs text-vault-textTertiary">
          Showing <span className="font-semibold">{displayed.length}</span>
          {listings.length !== displayed.length && <> of <span className="font-semibold">{listings.length}</span></>} listing{displayed.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Loading */}
      {loading && <ListingsSkeletonGrid compact={compact} />}

      {/* Error */}
      {!loading && error && (
        <div className="mx-4 rounded-[10px] border border-red-400/30 bg-red-500/5 p-4 text-sm text-red-500">
          Failed to load listings: {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && displayed.length === 0 && (
        <div className="mx-4 rounded-[10px] border border-vault-border bg-vault-surface p-10 text-center">
          <div className="text-4xl mb-3">🏷️</div>
          <p className="font-bold text-vault-accent dark:text-vault-accent mb-1">
            {isOwnProfile
              ? statusFilter ? `No ${STATUS_META[statusFilter]?.label.toLowerCase() ?? statusFilter} listings` : "No listings yet"
              : "No listings for sale right now"}
          </p>
          {isOwnProfile && !statusFilter && (
            <p className="text-sm text-vault-textTertiary mt-1">
              {onCreateListing ? (
                <button type="button" onClick={onCreateListing} className="underline text-vault-accent">
                  Create your first listing
                </button>
              ) : (
                <Link href="/marketplace" className="underline text-vault-accent">
                  Create your first listing
                </Link>
              )}
            </p>
          )}
        </div>
      )}

      {/* Grid */}
      {!loading && !error && displayed.length > 0 && (
        <div className={compact
          ? "grid grid-cols-2 gap-3 px-4"
          : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 px-4"
        }>
          {displayed.map(l => (
            <ListingTile
              key={l.id}
              listing={l}
              token={token}
              isOwnProfile={isOwnProfile}
              onDelisted={handleDelisted}
            />
          ))}
        </div>
      )}
    </section>
  );
}
