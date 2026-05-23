"use client";

import React, { useState } from "react";
import { gql, useQuery, useMutation } from "@apollo/client";

const PROOF_QUEUE_QUERY = gql`
  query AdminProofQueue {
    adminProofQueue {
      id
      cardId
      title
      condition
      variation
      price
      currency
      proofCode
      moderationResult
      proofImagePath
      createdAt
      seller {
        id
        username
      }
    }
  }
`;

const APPROVE_PROOF = gql`
  mutation AdminApproveProof($id: ID!) {
    adminApproveProof(id: $id)
  }
`;

const REJECT_PROOF = gql`
  mutation AdminRejectProof($id: ID!, $reason: String) {
    adminRejectProof(id: $id, reason: $reason)
  }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatPrice(price, currency = "GBP") {
  if (price == null) return "—";
  const sym = { GBP: "£", USD: "$", EUR: "€" }[currency] ?? currency + " ";
  return `${sym}${Number(price).toFixed(2)}`;
}

// ─── Proof image ─────────────────────────────────────────────────────────────

function ProofImage({ path, title }) {
  const [broken, setBroken] = useState(false);

  if (!path || broken) {
    return (
      <div className="flex flex-col items-center justify-center w-32 h-32 rounded-xl border-2 border-dashed border-white/10 bg-white/[0.03] text-neutral-600">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <span className="text-[10px] mt-1">No image</span>
      </div>
    );
  }

  // Strip any absolute filesystem prefix from legacy records (e.g. /var/uploads/marketplace_proofs/x.jpg → marketplace_proofs/x.jpg)
  const relativePath = path.replace(/^\/var\/uploads\//, '').replace(/^\/uploads\//, '');
  const src = relativePath.startsWith("http") ? relativePath : `/uploads/${relativePath}`;

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      title={`View proof image for ${title}`}
      className="block shrink-0"
    >
      <img
        src={src}
        alt={`Proof: ${title}`}
        onError={() => setBroken(true)}
        className="w-32 h-32 rounded-xl border border-white/10 object-cover hover:opacity-80 transition ring-0 hover:ring-2 hover:ring-white/20"
      />
      <p className="text-[10px] text-neutral-600 text-center mt-1">Tap to enlarge</p>
    </a>
  );
}

// ─── Reject modal ─────────────────────────────────────────────────────────────

function RejectModal({ listing, onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div
        className="bg-[#0d0f17] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-sm font-semibold text-neutral-50">Reject proof</h3>
          <p className="text-xs text-neutral-500 mt-1">
            The seller will get a notification and a fresh proof code to resubmit.
          </p>
        </div>

        <div className="border border-white/[0.06] rounded-lg p-3 bg-white/[0.02]">
          <p className="text-[11px] text-neutral-400 truncate">
            {listing.title || listing.cardId}
          </p>
          <p className="text-[10px] text-neutral-600 mt-0.5">
            Seller: {listing.seller?.username ?? "—"}
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-neutral-400">
            Reason <span className="text-neutral-600">(optional)</span>
          </label>
          <textarea
            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-neutral-100 placeholder-neutral-700 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
            rows={3}
            placeholder="e.g. Card is not clearly visible, proof code not legible…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2 rounded-lg text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 disabled:opacity-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim() || undefined)}
            disabled={loading}
            className="flex-1 py-2 rounded-lg text-xs font-medium bg-red-600/80 border border-red-500/50 text-white hover:bg-red-600 disabled:opacity-50 transition"
          >
            {loading ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Queue card ───────────────────────────────────────────────────────────────

function QueueCard({ item, onApprove, onReject, busy }) {
  return (
    <div className="border border-white/[0.08] rounded-2xl bg-white/[0.02] overflow-hidden">
      <div className="flex gap-4 p-4">
        <ProofImage path={item.proofImagePath} title={item.title || item.cardId} />

        <div className="flex-1 min-w-0 space-y-2">
          {/* Title + badges */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-50 truncate">
              {item.title || item.cardId}
            </h3>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {item.condition && (
                <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-white/[0.06] text-neutral-400 border border-white/10">
                  {item.condition}
                </span>
              )}
              {item.variation && (
                <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-white/[0.06] text-neutral-400 border border-white/10">
                  {item.variation}
                </span>
              )}
              <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Pending review
              </span>
            </div>
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <div>
              <span className="text-neutral-600">Seller</span>
              <p className="text-neutral-200 font-medium">
                {item.seller?.username ?? <span className="text-neutral-500 font-normal">Unknown</span>}
              </p>
            </div>
            <div>
              <span className="text-neutral-600">Price</span>
              <p className="text-neutral-200 font-medium">
                {formatPrice(item.price, item.currency)}
              </p>
            </div>
            <div>
              <span className="text-neutral-600">Submitted</span>
              <p className="text-neutral-400">{formatDate(item.createdAt)}</p>
            </div>
            <div>
              <span className="text-neutral-600">Proof code</span>
              <p className="text-neutral-400 font-mono text-[10px] truncate">
                {item.proofCode ?? "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="border-t border-white/[0.06] px-4 py-3 flex items-center justify-between gap-3 bg-black/20">
        <p className="text-[10px] text-neutral-600 truncate">
          ID: <span className="font-mono">{item.id}</span>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onReject(item)}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-400/40 text-red-300 hover:bg-red-500/10 hover:border-red-400/60 disabled:opacity-50 transition"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => onApprove(item.id)}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/80 border border-emerald-500/50 text-white hover:bg-emerald-600 disabled:opacity-50 transition"
          >
            Approve listing
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function AdminProofQueuePanel() {
  const [rejectTarget, setRejectTarget] = useState(null);

  const { data, loading, error, refetch } = useQuery(PROOF_QUEUE_QUERY, {
    fetchPolicy: "network-only",
  });

  const [approveProof, { loading: approving }] = useMutation(APPROVE_PROOF, {
    onCompleted: () => refetch(),
  });

  const [rejectProof, { loading: rejecting }] = useMutation(REJECT_PROOF, {
    onCompleted: () => refetch(),
  });

  const items = data?.adminProofQueue ?? [];
  const busy  = approving || rejecting;

  const handleApprove = (id) => {
    if (!confirm("Approve this proof and activate the listing?")) return;
    approveProof({ variables: { id } });
  };

  const handleRejectConfirm = (reason) => {
    rejectProof({ variables: { id: rejectTarget.id, reason } });
    setRejectTarget(null);
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="h-4 w-28 rounded bg-white/10 animate-pulse" />
            <div className="h-3 w-40 rounded bg-white/[0.06] animate-pulse mt-1.5" />
          </div>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-white/[0.06] rounded-2xl p-4 animate-pulse">
            <div className="flex gap-4">
              <div className="w-32 h-32 rounded-xl bg-white/[0.06] shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 rounded bg-white/10" />
                <div className="h-3 w-24 rounded bg-white/[0.06]" />
                <div className="h-3 w-32 rounded bg-white/[0.06] mt-2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="border border-red-500/30 rounded-2xl p-5 bg-red-950/20">
        <p className="text-sm font-semibold text-red-300 mb-1">Failed to load proof queue</p>
        <p className="text-xs text-red-400 mb-4">{error.message}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium border border-red-400/50 text-red-200 hover:bg-red-500/10"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────

  if (!items.length) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-neutral-50">Proof Queue</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Listings awaiting manual photo verification.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 transition"
          >
            Refresh
          </button>
        </div>
        <div className="border border-white/[0.06] rounded-2xl p-10 bg-white/[0.01] flex flex-col items-center text-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-emerald-400" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-200">Queue is clear</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              No listings are currently awaiting manual review.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── List ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {rejectTarget && (
        <RejectModal
          listing={rejectTarget}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
          loading={rejecting}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-neutral-50">Proof Queue</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {items.length} listing{items.length !== 1 ? "s" : ""} awaiting verification.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={busy}
          className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 disabled:opacity-50 transition"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <QueueCard
            key={item.id}
            item={item}
            onApprove={handleApprove}
            onReject={setRejectTarget}
            busy={busy}
          />
        ))}
      </div>
    </div>
  );
}
