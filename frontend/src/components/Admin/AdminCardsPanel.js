"use client";

import React, { useState } from "react";
import { useQuery } from "@apollo/client";
import { ADMIN_USER_COLLECTIONS_QUERY as COLLECTIONS_QUERY } from '@/graphql/admin';

const LIMIT = 200;

export default function AdminCardsPanel() {
  const [draft, setDraft]   = useState("");
  const [search, setSearch] = useState("");

  const { data, loading, error, refetch } = useQuery(COLLECTIONS_QUERY, {
    variables: { limit: LIMIT, search: search || null },
    fetchPolicy: "network-only",
  });

  const rows = data?.adminUserCollections ?? [];

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(draft.trim());
  };

  const maxCards = Math.max(...rows.map((r) => r.totalCards ?? 0), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-50">Collections</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {loading ? "Loading…" : `${rows.length} user${rows.length !== 1 ? "s" : ""}${search ? ` matching "${search}"` : ` (up to ${LIMIT})`}.`}
          </p>
        </div>
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search username or email…"
            className="w-52 px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 transition">Search</button>
          <button type="button" onClick={() => refetch()} disabled={loading} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 disabled:opacity-50 transition">Refresh</button>
        </form>
      </div>

      {error && <div className="border border-red-500/30 rounded-xl p-3 bg-red-950/20 text-xs text-red-300">{error.message}</div>}

      <div className="overflow-x-auto border border-white/[0.08] rounded-2xl bg-black/30">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["User", "Email", "Total cards", "Distinct cards", "Collection size"].map((h) => (
                <th key={h} className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 ${h.startsWith("Total") || h.startsWith("Distinct") ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading && !data ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  {[55, 70, 20, 20, 40].map((w, j) => (
                    <td key={j} className="px-3 py-3"><div className="h-3 rounded bg-white/[0.06] animate-pulse" style={{ width: `${w}%` }} /></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-neutral-500">No collections found.</td></tr>
            ) : (
              rows.map((row) => {
                const barPct = Math.round(((row.totalCards ?? 0) / maxCards) * 100);
                return (
                  <tr key={row.userId} className="hover:bg-white/[0.03] transition align-middle">
                    <td className="px-3 py-3">
                      <p className="font-medium text-neutral-100">{row.username || "—"}</p>
                      <p className="font-mono text-[10px] text-neutral-600">{row.userId}</p>
                    </td>
                    <td className="px-3 py-3 text-neutral-400">{row.email || "—"}</td>
                    <td className="px-3 py-3 text-right font-semibold text-neutral-100 tabular-nums">{(row.totalCards ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-neutral-400 tabular-nums">{(row.distinctCards ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500/50" style={{ width: `${barPct}%` }} />
                        </div>
                        <span className="text-[10px] text-neutral-600 w-8 text-right tabular-nums">{barPct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
