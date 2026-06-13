"use client";

import React, { useState } from "react";
import { gql, useQuery } from "@apollo/client";

const USERS_QUERY = gql`
  query AdminUsers($limit: Int) {
    allUsers(limit: $limit) {
      id
      username
      email
      isAdmin
      isBanned
      emailVerified
      createdAt
      lastLogin
      profile {
        country
        status
        favouritePokemon
      }
    }
  }
`;

function fmt(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function UserBadge({ label, variant }) {
  const cls = {
    admin:    "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
    banned:   "bg-red-500/10 text-red-300 border-red-500/30",
    unverified: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    user:     "bg-white/[0.04] text-neutral-500 border-white/10",
  }[variant] ?? "bg-white/[0.04] text-neutral-500 border-white/10";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${cls}`}>{label}</span>
  );
}

function RowSkeleton() {
  return (
    <tr className="border-b border-white/[0.04]">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-3 rounded bg-white/[0.06] animate-pulse" style={{ width: `${[60, 80, 40, 50, 45, 55][i]}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function AdminUsersPanel() {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(null);

  const { data, loading, error, refetch } = useQuery(USERS_QUERY, {
    variables: { limit: 200 },
    fetchPolicy: "network-only",
  });

  // allUsers has no server-side search — filter client-side from the fetched batch
  const allFetchedUsers = data?.allUsers ?? [];
  const users = search
    ? allFetchedUsers.filter((u) =>
        u.username?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
      )
    : allFetchedUsers;

  const copy = async (label, value) => {
    try {
      await navigator.clipboard.writeText(String(value ?? ""));
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(draft.trim());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-50">Users</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {loading ? "Loading…" : `${users.length} user${users.length !== 1 ? "s" : ""}${search ? ` matching "${search}"` : " (up to 200)"}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search username or email…"
              className="w-52 px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
            <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 transition">Search</button>
          </form>
          <button type="button" onClick={() => refetch()} disabled={loading} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 disabled:opacity-50 transition">Refresh</button>
        </div>
      </div>

      {copied && (
        <div className="border border-emerald-500/30 rounded-lg px-3 py-2 bg-emerald-500/[0.04] text-xs text-emerald-300">Copied {copied}.</div>
      )}

      {error && (
        <div className="border border-red-500/30 rounded-xl p-3 bg-red-950/20 text-xs text-red-300">{error.message}</div>
      )}

      <div className="overflow-x-auto border border-white/[0.08] rounded-2xl bg-black/30">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["User", "Email", "Status", "Profile", "Joined", "Actions"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading && !data
              ? Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)
              : users.length === 0
              ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-neutral-500">No users found.</td></tr>
              )
              : users.map((u) => {
                const badges = [];
                if (u.isAdmin)               badges.push({ label: "Admin",      variant: "admin" });
                if (u.isBanned)              badges.push({ label: "Banned",     variant: "banned" });
                if (!u.emailVerified)        badges.push({ label: "Unverified", variant: "unverified" });
                if (!badges.length)          badges.push({ label: "User",       variant: "user" });

                return (
                  <tr key={u.id} className="hover:bg-white/[0.03] transition align-top">
                    <td className="px-3 py-3">
                      <p className="font-medium text-neutral-100">{u.username || "—"}</p>
                      <p className="font-mono text-[10px] text-neutral-600 mt-0.5">{u.id}</p>
                    </td>
                    <td className="px-3 py-3 text-neutral-400">{u.email || "—"}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {badges.map((b) => <UserBadge key={b.label} {...b} />)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-neutral-400">
                      {u.profile ? (
                        <div className="space-y-0.5">
                          {u.profile.country         && <p className="text-[11px]">{u.profile.country}</p>}
                          {u.profile.favouritePokemon && <p className="text-[11px] text-neutral-500">Fav: {u.profile.favouritePokemon}</p>}
                          {!u.profile.country && !u.profile.favouritePokemon && <p className="text-[11px] text-neutral-600">Incomplete</p>}
                        </div>
                      ) : <span className="text-[11px] text-neutral-600">No profile</span>}
                    </td>
                    <td className="px-3 py-3 text-neutral-500 whitespace-nowrap">{fmt(u.createdAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" onClick={() => copy("user ID", u.id)} className="px-2 py-1 rounded text-[10px] border border-white/10 text-neutral-400 hover:bg-white/5 transition">Copy ID</button>
                        <button type="button" onClick={() => copy("email", u.email)} className="px-2 py-1 rounded text-[10px] border border-white/10 text-neutral-400 hover:bg-white/5 transition">Copy email</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
