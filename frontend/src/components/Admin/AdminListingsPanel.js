"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { ADMIN_LISTINGS_QUERY, ADMIN_DELETE_CARD_LISTING as DELETE_LISTING } from '@/graphql/admin';

const PAGE_SIZE = 100;

const STATUS_OPTS = ["all", "active", "sold", "cancelled", "pending_proof", "proof_rejected"];

function StatusBadge({ status }) {
  const cls = {
    active:          "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    sold:            "bg-sky-500/10 text-sky-300 border-sky-500/30",
    cancelled:       "bg-neutral-500/10 text-neutral-500 border-white/10",
    pending_proof:   "bg-amber-500/10 text-amber-300 border-amber-500/30",
    proof_rejected:  "bg-red-500/10 text-red-300 border-red-500/30",
  }[status] ?? "bg-white/[0.04] text-neutral-400 border-white/10";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${cls}`}>
      {status?.replace(/_/g, " ") ?? "—"}
    </span>
  );
}

function fmt(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminListingsPanel() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [offset, setOffset] = useState(0);

  const { data, loading, error, refetch } = useQuery(ADMIN_LISTINGS_QUERY, {
    variables: {
      status: statusFilter === "all" ? null : statusFilter,
      limit: PAGE_SIZE,
      offset,
    },
    fetchPolicy: "network-only",
  });

  const [deleteListing, { loading: deleting }] = useMutation(DELETE_LISTING, {
    onCompleted: () => refetch(),
  });

  const listings = data?.adminListings ?? [];
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  const handleDelete = (l) => {
    if (!confirm(`Delete listing ${l.id}?\n"${l.title || l.cardId}" × ${l.quantity} @ £${Number(l.price ?? 0).toFixed(2)}`)) return;
    deleteListing({ variables: { id: l.id } });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-50">Marketplace Listings</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {loading ? "Loading…" : `${listings.length} listing${listings.length !== 1 ? "s" : ""} — page ${page}.`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-white/10 overflow-hidden text-[11px]">
            {STATUS_OPTS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { setStatusFilter(opt); setOffset(0); }}
                className={["px-3 py-1.5 font-medium capitalize transition", statusFilter === opt ? "bg-white/10 text-neutral-100" : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"].join(" ")}
              >
                {opt.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => refetch()} disabled={loading || deleting} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 disabled:opacity-50 transition">Refresh</button>
        </div>
      </div>

      {error && <div className="border border-red-500/30 rounded-xl p-3 bg-red-950/20 text-xs text-red-300">{error.message}</div>}

      <div className="overflow-x-auto border border-white/[0.08] rounded-2xl bg-black/30">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["ID", "Title / Card", "Seller", "Price", "Qty", "Condition", "Status", "Listed", "Actions"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading && !data ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  {Array.from({ length: 9 }).map((__, j) => (
                    <td key={j} className="px-3 py-3"><div className="h-3 rounded bg-white/[0.06] animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : listings.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-neutral-500">No listings found.</td></tr>
            ) : (
              listings.map((l) => (
                <tr key={l.id} className="hover:bg-white/[0.03] transition align-top">
                  <td className="px-3 py-3 font-mono text-[10px] text-neutral-600 max-w-[80px] truncate">{l.id}</td>
                  <td className="px-3 py-3">
                    <p className="text-neutral-200 font-medium max-w-[180px] truncate">{l.title || "—"}</p>
                    <p className="font-mono text-[10px] text-neutral-600">{l.cardId}</p>
                  </td>
                  <td className="px-3 py-3 font-mono text-[10px] text-neutral-500 max-w-[100px] truncate">{l.sellerId}</td>
                  <td className="px-3 py-3 font-medium text-neutral-100 whitespace-nowrap">£{Number(l.price ?? 0).toFixed(2)}</td>
                  <td className="px-3 py-3 text-neutral-400">{l.quantity ?? "—"}</td>
                  <td className="px-3 py-3 text-neutral-400 capitalize">{l.condition?.toLowerCase() || "—"}</td>
                  <td className="px-3 py-3"><StatusBadge status={l.status} /></td>
                  <td className="px-3 py-3 text-neutral-500 whitespace-nowrap">{fmt(l.createdAt)}</td>
                  <td className="px-3 py-3">
                    <button type="button" disabled={deleting} onClick={() => handleDelete(l)} className="px-2 py-1 rounded text-[10px] border border-red-400/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50 transition">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.06]">
          <button type="button" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 disabled:opacity-40 transition">← Prev</button>
          <span className="text-[11px] text-neutral-500">Page {page}</span>
          <button type="button" disabled={listings.length < PAGE_SIZE} onClick={() => setOffset((o) => o + PAGE_SIZE)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 disabled:opacity-40 transition">Next →</button>
        </div>
      </div>
    </div>
  );
}
