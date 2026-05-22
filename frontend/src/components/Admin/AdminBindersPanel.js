"use client";

import React, { useState } from "react";
import { gql, useQuery, useMutation } from "@apollo/client";

const BINDERS_QUERY = gql`
  query AdminBinders {
    adminBinders {
      id
      userId
      name
      visibility
      isDeleted
      createdAt
    }
  }
`;

const DELETE_BINDER = gql`
  mutation AdminDeleteBinder($id: ID!) {
    adminDeleteBinder(id: $id)
  }
`;

function fmt(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function VisibilityBadge({ visibility }) {
  const cls = {
    public:  "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    private: "bg-neutral-500/10 text-neutral-500 border-white/10",
    friends: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  }[visibility?.toLowerCase()] ?? "bg-white/[0.04] text-neutral-400 border-white/10";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${cls}`}>
      {visibility ?? "—"}
    </span>
  );
}

export default function AdminBindersPanel() {
  const [search, setSearch] = useState("");

  const { data, loading, error, refetch } = useQuery(BINDERS_QUERY, {
    fetchPolicy: "network-only",
  });

  const [deleteBinder, { loading: deleting }] = useMutation(DELETE_BINDER, {
    onCompleted: () => refetch(),
  });

  const allBinders = data?.adminBinders ?? [];
  const binders = search.trim()
    ? allBinders.filter((b) =>
        b.name?.toLowerCase().includes(search.toLowerCase()) ||
        b.userId?.toLowerCase().includes(search.toLowerCase())
      )
    : allBinders;

  const handleDelete = (b) => {
    if (!confirm(`Delete binder "${b.name}" (${b.id})?`)) return;
    deleteBinder({ variables: { id: b.id } });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-50">Binders</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {loading ? "Loading…" : `${binders.length} binder${binders.length !== 1 ? "s" : ""}${search ? " (filtered)" : ""}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name or owner ID…"
            className="w-52 px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          <button type="button" onClick={() => refetch()} disabled={loading || deleting} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 disabled:opacity-50 transition">Refresh</button>
        </div>
      </div>

      {error && <div className="border border-red-500/30 rounded-xl p-3 bg-red-950/20 text-xs text-red-300">{error.message}</div>}

      <div className="overflow-x-auto border border-white/[0.08] rounded-2xl bg-black/30">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["Name", "Owner ID", "Visibility", "Created", "Actions"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading && !data ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  {[60, 90, 40, 50, 30].map((w, j) => (
                    <td key={j} className="px-3 py-3"><div className="h-3 rounded bg-white/[0.06] animate-pulse" style={{ width: `${w}%` }} /></td>
                  ))}
                </tr>
              ))
            ) : binders.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-neutral-500">No binders found.</td></tr>
            ) : (
              binders.map((b) => (
                <tr key={b.id} className="hover:bg-white/[0.03] transition align-top">
                  <td className="px-3 py-3">
                    <p className="font-medium text-neutral-100">{b.name}</p>
                    {b.isDeleted && <span className="text-[10px] text-red-400">deleted</span>}
                  </td>
                  <td className="px-3 py-3 font-mono text-[10px] text-neutral-500 max-w-[140px] truncate">{b.userId}</td>
                  <td className="px-3 py-3"><VisibilityBadge visibility={b.visibility} /></td>
                  <td className="px-3 py-3 text-neutral-500 whitespace-nowrap">{fmt(b.createdAt)}</td>
                  <td className="px-3 py-3">
                    {!b.isDeleted && (
                      <button type="button" disabled={deleting} onClick={() => handleDelete(b)} className="px-2 py-1 rounded text-[10px] border border-red-400/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50 transition">Delete</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
