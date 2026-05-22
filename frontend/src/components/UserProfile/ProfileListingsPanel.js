// src/components/UserProfile/ProfileListingsPanel.js
"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getGraphqlUrl } from "@/utils/apiClient";

/* ─── GraphQL ────────────────────────────────────────────────────────────────── */

async function gql(token, query, variables = {}) {
  const res = await fetch(getGraphqlUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

// Own profile — all statuses
const MY_LISTINGS_QUERY = `
  query MyListings($status: ListingStatus, $limit: Int) {
    myListings(status: $status, limit: $limit) {
      id cardId title condition variant price quantity status
      allowOffers willTrade proofCode createdAt
      cardInfo { name imageSmall setName number rarity }
    }
  }
`;

// Other users — ACTIVE only (public storefront)
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

/* ─── Proof submission (own profile, PENDING_PROOF listings) ─────────────────── */

function ProofSubmit({ listing, token, onActivated, onCodeRefreshed }) {
  const [file, setFile]           = useState(null);
  const [preview, setPreview]     = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]       = useState(null); // { ok, result, newProofCode }
  const [err, setErr]             = useState(null);
  const [proofCode, setProofCode] = useState(listing.proofCode || "");

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
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
        setProofCode(res.newProofCode);
        onCodeRefreshed(listing.id, res.newProofCode);
        setFile(null); setPreview(null);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Success states
  if (result?.result === 'approved') {
    return (
      <div className="mt-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-2">
        ✅ Proof approved — your listing is now live!
      </div>
    );
  }
  if (result?.result === 'pending_admin') {
    return (
      <div className="mt-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-2">
        ⏳ Proof submitted — under admin review. Your listing will go live once approved.
      </div>
    );
  }

  return (
    <div className="mt-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-4">
      {/* Proof code display */}
      <div>
        <p className="text-xs font-semibold text-light-textMuted dark:text-dark-textMuted mb-2 uppercase tracking-wide">
          Your proof code
        </p>
        <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-light-surface dark:bg-dark-surface border-2 border-amber-500/40">
          <span className="font-mono font-extrabold text-xl tracking-[0.2em] text-amber-600 dark:text-amber-400 select-all">
            {proofCode}
          </span>
        </div>
        <p className="mt-2 text-xs text-light-textMuted dark:text-dark-textMuted leading-relaxed">
          Write or print this code on a piece of paper, place it next to your card, and take a clear photo showing both the card and the code together.
        </p>
        {result?.result === 'expired' && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-semibold">
            ⚠️ Your previous code expired. A new code has been issued above — re-photograph with the new code.
          </p>
        )}
      </div>

      {/* Upload */}
      <div>
        <p className="text-xs font-semibold text-light-textMuted dark:text-dark-textMuted mb-2 uppercase tracking-wide">
          Upload photo
        </p>
        <label className="flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt cursor-pointer hover:bg-light-surface dark:hover:bg-dark-surface transition overflow-hidden">
          {preview ? (
            <img src={preview} alt="Proof preview" className="w-full max-h-56 object-contain p-2" />
          ) : (
            <div className="py-6 text-center">
              <div className="text-3xl mb-2">📷</div>
              <p className="text-sm text-light-textMuted dark:text-dark-textMuted">Click to select a photo</p>
              <p className="text-xs text-light-textMuted dark:text-dark-textMuted mt-0.5">JPG, PNG, WEBP</p>
            </div>
          )}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
        </label>
        {preview && (
          <button type="button" onClick={() => { setFile(null); setPreview(null); }}
            className="mt-2 text-xs text-light-textMuted dark:text-dark-textMuted underline">
            Remove photo
          </button>
        )}
      </div>

      {err && <p className="text-xs text-red-500">{err}</p>}

      <button type="button" onClick={submit} disabled={!file || submitting}
        className="w-full py-2.5 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white transition disabled:opacity-50">
        {submitting ? "Submitting…" : "Submit proof"}
      </button>
    </div>
  );
}

/* ─── Shared helpers ─────────────────────────────────────────────────────────── */

const STATUS_META = {
  ACTIVE:        { label: "Active",        cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  PENDING_PROOF: { label: "Pending proof", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  SOLD:          { label: "Sold",          cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  CANCELLED:     { label: "Delisted",      cls: "bg-light-textMuted/15 text-light-textMuted dark:text-dark-textMuted" },
};

const CONDITION_LABELS = {
  NM: "Near Mint", LP: "Lightly Played", MP: "Moderately Played",
  HP: "Heavily Played", DMG: "Damaged",
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, cls: "bg-light-alt text-light-textMuted" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}

/* ─── Inline edit form (own profile only) ─────────────────────────────────────── */

function EditForm({ listing, token, onSaved, onCancel }) {
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
        input: {
          price:       Number(price)  || listing.price,
          quantity:    Number(qty)    || listing.quantity,
          allowOffers,
          willTrade,
        },
      });
      onSaved({ price: Number(price), quantity: Number(qty), allowOffers, willTrade });
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 p-4 rounded-xl border border-light-accent/30 dark:border-dark-accent/30 bg-light-accent/5 dark:bg-dark-accent/5 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1 text-light-textMuted dark:text-dark-textMuted">Price (£)</label>
          <input
            type="number" min="0" step="0.01" value={price}
            onChange={e => setPrice(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-light-textMuted dark:text-dark-textMuted">Quantity</label>
          <input
            type="number" min="1" step="1" value={qty}
            onChange={e => setQty(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition text-sm"
          />
        </div>
      </div>
      <div className="flex gap-5">
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
          <input type="checkbox" className="accent-light-accent dark:accent-dark-accent w-4 h-4"
            checked={allowOffers} onChange={e => setAllowOffers(e.target.checked)} />
          Allow offers
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
          <input type="checkbox" className="accent-light-accent dark:accent-dark-accent w-4 h-4"
            checked={willTrade} onChange={e => setWillTrade(e.target.checked)} />
          Will trade
        </label>
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={saving}
          className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-light-accent dark:bg-dark-accent text-white hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition disabled:opacity-50">
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-1.5 rounded-lg text-sm font-semibold border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt hover:bg-light-surface dark:hover:bg-dark-surface transition">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── Single listing row ─────────────────────────────────────────────────────── */

function ListingRow({ listing: initial, token, isOwnProfile, onDelisted }) {
  const [listing, setListing]       = useState(initial);
  const [editing, setEditing]       = useState(false);
  const [showProof, setShowProof]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  async function delist() {
    setDeleting(true);
    try {
      await gql(token, DELETE_MUTATION, { id: listing.id });
      onDelisted(listing.id);
    } catch {
      setDeleting(false);
    }
  }

  const name          = listing.cardInfo?.name || listing.title || "Card listing";
  const setName       = listing.cardInfo?.setName || null;
  const img           = listing.cardInfo?.imageSmall || null;
  const cond          = CONDITION_LABELS[listing.condition] || listing.condition || "";
  const isActive      = listing.status === "ACTIVE";
  const isPending     = listing.status === "PENDING_PROOF";
  const canEdit        = isOwnProfile && isActive;
  const canSubmitProof = isOwnProfile && isPending;

  return (
    <li className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface overflow-hidden">
      <div className="flex gap-4 p-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-12 h-[68px] rounded-lg overflow-hidden bg-black/20 dark:bg-white/5 border border-light-border dark:border-dark-border">
          {img
            ? <img src={img} alt={name} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-lg">🃏</div>}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="font-bold text-light-primary dark:text-dark-primary truncate text-sm">{name}</span>
            {isOwnProfile && <StatusBadge status={listing.status} />}
          </div>
          <div className="text-xs text-light-textMuted dark:text-dark-textMuted mb-2">
            {[setName, cond, listing.variant].filter(Boolean).join(" • ")}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-extrabold text-base text-light-primary dark:text-dark-primary">
              £{Number(listing.price || 0).toFixed(2)}
            </span>
            <span className="text-xs text-light-textMuted dark:text-dark-textMuted">Qty: {listing.quantity}</span>
            {listing.allowOffers && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-light-border dark:border-dark-border text-light-textMuted dark:text-dark-textMuted">
                Offers ✓
              </span>
            )}
            {listing.willTrade && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-light-border dark:border-dark-border text-light-textMuted dark:text-dark-textMuted">
                Trade ✓
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex flex-col gap-2 items-end justify-start">
          {canSubmitProof && (
            <button type="button" onClick={() => { setShowProof(v => !v); setEditing(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition
                ${showProof
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"}`}>
              {showProof ? "Close" : "Submit proof"}
            </button>
          )}
          {canEdit && (
            <button type="button" onClick={() => { setEditing(v => !v); setShowProof(false); }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt hover:bg-light-surface dark:hover:bg-dark-surface transition">
              {editing ? "Close" : "Edit"}
            </button>
          )}
          {isOwnProfile && isActive && !confirmDel && (
            <button type="button" onClick={() => setConfirmDel(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-400/40 text-red-500 hover:bg-red-500/10 transition">
              Delist
            </button>
          )}
          {isOwnProfile && isActive && confirmDel && (
            <div className="flex gap-1">
              <button type="button" onClick={delist} disabled={deleting}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50">
                {deleting ? "…" : "Confirm"}
              </button>
              <button type="button" onClick={() => setConfirmDel(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt transition">
                No
              </button>
            </div>
          )}
          {!isOwnProfile && isActive && (
            <Link href="/marketplace"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-light-accent dark:bg-dark-accent !text-white hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition">
              View
            </Link>
          )}
        </div>
      </div>

      {showProof && (
        <div className="px-4 pb-4">
          <ProofSubmit
            listing={listing}
            token={token}
            onActivated={(id) => {
              setListing(l => ({ ...l, status: "ACTIVE" }));
              setShowProof(false);
            }}
            onCodeRefreshed={(id, newCode) => {
              setListing(l => ({ ...l, proofCode: newCode }));
            }}
          />
        </div>
      )}

      {editing && (
        <div className="px-4 pb-4">
          <EditForm
            listing={listing}
            token={token}
            onSaved={updated => { setListing(l => ({ ...l, ...updated })); setEditing(false); }}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}
    </li>
  );
}

/* ─── Filter pills ───────────────────────────────────────────────────────────── */

const FILTERS = [
  { value: null,            label: "All" },
  { value: "ACTIVE",        label: "Active" },
  { value: "PENDING_PROOF", label: "Pending proof" },
  { value: "SOLD",          label: "Sold" },
  { value: "CANCELLED",     label: "Delisted" },
];

/* ─── Main panel ─────────────────────────────────────────────────────────────── */

export default function ProfileListingsPanel({ userId, isOwnProfile, token }) {
  const [listings, setListings]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);

  const load = useCallback(async (status) => {
    setLoading(true); setError(null);
    try {
      let items = [];
      if (isOwnProfile) {
        const data = await gql(token, MY_LISTINGS_QUERY, { ...(status ? { status } : {}), limit: 100 });
        items = data?.myListings ?? [];
      } else {
        const data = await gql(null, PUBLIC_LISTINGS_QUERY, { sellerId: userId, limit: 100 });
        items = (data?.listings ?? []).filter(Boolean);
      }
      setListings(items);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, userId, isOwnProfile]);

  useEffect(() => { load(statusFilter); }, [load, statusFilter]);

  function handleDelisted(id) {
    setListings(ls => ls.map(l => l.id === id ? { ...l, status: "CANCELLED" } : l));
  }

  const counts      = listings.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc; }, {});
  const filtered    = statusFilter ? listings.filter(l => l.status === statusFilter) : listings;
  const activeCount = listings.filter(l => l.status === "ACTIVE").length;

  return (
    <div className="space-y-5 mt-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-extrabold text-light-primary dark:text-dark-primary">
            {isOwnProfile ? "My listings" : "Listings"}
          </h3>
          <p className="text-sm text-light-textMuted dark:text-dark-textMuted mt-0.5">
            {isOwnProfile
              ? "Manage, edit, or delist your active card listings."
              : activeCount > 0
                ? `${activeCount} active listing${activeCount !== 1 ? "s" : ""} for sale`
                : "No active listings right now."}
          </p>
        </div>
        {isOwnProfile && (
          <div className="flex gap-2">
            <Link href="/marketplace"
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-light-accent dark:bg-dark-accent !text-white hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition">
              + New listing
            </Link>
            <button type="button" onClick={() => load(statusFilter)}
              className="px-3 py-2 rounded-xl text-sm border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt hover:bg-light-surface dark:hover:bg-dark-surface transition">
              ↺
            </button>
          </div>
        )}
      </div>

      {/* Filter pills — own profile only */}
      {isOwnProfile && (
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => {
            const active = statusFilter === f.value;
            const count  = f.value ? (counts[f.value] ?? 0) : listings.length;
            return (
              <button key={String(f.value)} type="button" onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition flex items-center gap-1.5
                  ${active
                    ? "bg-light-accent dark:bg-dark-accent text-white border-light-accent dark:border-dark-accent"
                    : "border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text hover:bg-light-surface dark:hover:bg-dark-surface"}`}>
                {f.label}
                <span className={`text-xs px-1.5 rounded-full ${active ? "bg-white/20" : "bg-light-border dark:bg-dark-border"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-12 h-[68px] rounded-lg bg-light-border/60 dark:bg-dark-border/60" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 w-40 bg-light-border/60 dark:bg-dark-border/60 rounded" />
                  <div className="h-3 w-28 bg-light-border/40 dark:bg-dark-border/40 rounded" />
                  <div className="h-4 w-20 bg-light-border/40 dark:bg-dark-border/40 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/5 p-4 text-sm text-red-500">
          Failed to load listings: {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-10 text-center">
          <div className="text-4xl mb-3">🏷️</div>
          <div className="font-bold text-light-primary dark:text-dark-primary mb-1">
            {isOwnProfile
              ? statusFilter
                ? `No ${STATUS_META[statusFilter]?.label.toLowerCase() ?? statusFilter} listings`
                : "No listings yet"
              : "No listings for sale right now"}
          </div>
          {isOwnProfile && (
            <p className="text-sm text-light-textMuted dark:text-dark-textMuted">
              <Link href="/marketplace" className="underline text-light-accent dark:text-dark-accent">
                Create a listing
              </Link>{" "}on the marketplace.
            </p>
          )}
        </div>
      )}

      {/* Rows */}
      {!loading && !error && filtered.length > 0 && (
        <ul className="space-y-3">
          {filtered.map(l => (
            <ListingRow
              key={l.id}
              listing={l}
              token={token}
              isOwnProfile={isOwnProfile}
              onDelisted={handleDelisted}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
