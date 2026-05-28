"use client";

import React, { useState } from "react";
import { gql, useQuery, useMutation } from "@apollo/client";

const REVIEW_QUEUE_QUERY = gql`
  query AdminReviewQueue($status: String, $limit: Int, $offset: Int) {
    adminReviewQueue(status: $status, limit: $limit, offset: $offset) {
      id
      sellerId
      cardId
      rating
      review
      reviewStatus
      disputeReason
      updatedAt
    }
  }
`;

const RESOLVE_REVIEW = gql`
  mutation AdminResolveReview($listingId: ID!, $action: String!) {
    adminResolveReview(listingId: $listingId, action: $action)
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function StarRow({ rating }) {
  if (!rating) return <span className="text-neutral-600 text-[11px]">No rating</span>;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill={i < rating ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          className={i < rating ? "text-amber-400" : "text-neutral-600"}
          aria-hidden="true"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
      <span className="ml-1 text-[11px] text-neutral-400">{rating}/5</span>
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending:  { bg: "bg-amber-500/10",  border: "border-amber-500/25",  text: "text-amber-300",  label: "Anomaly hold" },
    disputed: { bg: "bg-orange-500/10", border: "border-orange-500/25", text: "text-orange-300", label: "Disputed"     },
    approved: { bg: "bg-emerald-500/10",border: "border-emerald-500/25",text: "text-emerald-300",label: "Approved"     },
    voided:   { bg: "bg-red-500/10",    border: "border-red-500/25",    text: "text-red-300",    label: "Voided"       },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium border ${s.bg} ${s.border} ${s.text}`}>
      {s.label}
    </span>
  );
}

// ─── Review card ──────────────────────────────────────────────────────────────

function ReviewCard({ item, onApprove, onVoid, busy }) {
  return (
    <div className="border border-white/[0.08] rounded-2xl bg-white/[0.02] overflow-hidden">
      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-neutral-100 truncate font-mono">
                Card: {item.cardId ?? "—"}
              </span>
              <StatusBadge status={item.reviewStatus} />
            </div>
            <div className="flex items-center gap-3 text-[11px] text-neutral-500">
              <span>Seller ID: <span className="font-mono text-neutral-400">{item.sellerId}</span></span>
              <span>·</span>
              <span>{formatDate(item.updatedAt)}</span>
            </div>
          </div>
          <StarRow rating={item.rating} />
        </div>

        {/* Review text */}
        {item.review ? (
          <p className="text-xs text-neutral-300 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 leading-relaxed">
            "{item.review}"
          </p>
        ) : (
          <p className="text-xs text-neutral-600 italic">No written review.</p>
        )}

        {/* Dispute reason */}
        {item.disputeReason && (
          <div className="bg-orange-950/30 border border-orange-500/20 rounded-lg px-3 py-2">
            <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wide mb-0.5">
              Seller dispute reason
            </p>
            <p className="text-xs text-orange-200">{item.disputeReason}</p>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="border-t border-white/[0.06] px-4 py-3 flex items-center justify-between gap-3 bg-black/20">
        <p className="text-[10px] text-neutral-600 font-mono truncate">
          {item.id}
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onVoid(item.id)}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-400/40 text-red-300 hover:bg-red-500/10 hover:border-red-400/60 disabled:opacity-50 transition"
          >
            Void review
          </button>
          <button
            type="button"
            onClick={() => onApprove(item.id)}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/80 border border-emerald-500/50 text-white hover:bg-emerald-600 disabled:opacity-50 transition"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "pending",  label: "Anomaly holds" },
  { id: "disputed", label: "Disputed"      },
];

export default function AdminReviewsPanel() {
  const [activeTab, setActiveTab] = useState("pending");

  const { data, loading, error, refetch } = useQuery(REVIEW_QUEUE_QUERY, {
    variables: { status: activeTab, limit: 50, offset: 0 },
    fetchPolicy: "network-only",
  });

  const [resolveReview, { loading: resolving }] = useMutation(RESOLVE_REVIEW, {
    onCompleted: () => refetch(),
  });

  const items = data?.adminReviewQueue ?? [];
  const busy  = resolving;

  const handleApprove = (listingId) => {
    if (!confirm("Approve this review? It will count toward the seller's reputation.")) return;
    resolveReview({ variables: { listingId, action: "approve" } });
  };

  const handleVoid = (listingId) => {
    if (!confirm("Void this review? It will be removed from the seller's reputation and the seller will be notified if they disputed it.")) return;
    resolveReview({ variables: { listingId, action: "void" } });
  };

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-36 rounded bg-white/10 animate-pulse" />
        <div className="h-3 w-48 rounded bg-white/[0.06] animate-pulse" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-white/[0.06] rounded-2xl p-4 space-y-3 animate-pulse">
            <div className="h-4 w-40 rounded bg-white/10" />
            <div className="h-3 w-56 rounded bg-white/[0.06]" />
            <div className="h-10 rounded-lg bg-white/[0.04]" />
          </div>
        ))}
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="border border-red-500/30 rounded-2xl p-5 bg-red-950/20">
        <p className="text-sm font-semibold text-red-300 mb-1">Failed to load review queue</p>
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

  // ── Main ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-neutral-50">Review Queue</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Buyer reviews held for moderation or flagged by sellers.
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

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              "px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeTab === tab.id
                ? "bg-white/10 text-neutral-50"
                : "text-neutral-500 hover:text-neutral-300",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {!items.length && (
        <div className="border border-white/[0.06] rounded-2xl p-10 bg-white/[0.01] flex flex-col items-center text-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-emerald-400" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-200">Queue is clear</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              No {activeTab === "pending" ? "anomaly-held" : "disputed"} reviews to action.
            </p>
          </div>
        </div>
      )}

      {/* List */}
      {items.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] text-neutral-500">
            {items.length} review{items.length !== 1 ? "s" : ""} awaiting action
          </p>
          {items.map((item) => (
            <ReviewCard
              key={item.id}
              item={item}
              onApprove={handleApprove}
              onVoid={handleVoid}
              busy={busy}
            />
          ))}
        </div>
      )}
    </div>
  );
}
