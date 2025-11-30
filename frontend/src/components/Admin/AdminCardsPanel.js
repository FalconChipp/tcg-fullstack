// frontend/src/components/Admin/AdminCardsPanel.js
// -----------------------------------------------------------------------------
// Admin panel: overview of users' collections.
// Reads from adminUserCollections and displays per-user collection stats.
// -----------------------------------------------------------------------------

"use client";

import React, { useState } from "react";
import { gql, useQuery } from "@apollo/client";

const ADMIN_USER_COLLECTIONS_QUERY = gql`
  query AdminUserCollections($limit: Int, $search: String) {
    adminUserCollections(limit: $limit, search: $search) {
      userId
      username
      email
      totalCards
      distinctCards
    }
  }
`;

const DEFAULT_LIMIT = 200;

export default function AdminCardsPanel() {
  const [search, setSearch] = useState("");

  const { data, loading, error, refetch } = useQuery(
    ADMIN_USER_COLLECTIONS_QUERY,
    {
      variables: {
        limit: DEFAULT_LIMIT,
        search: search.trim() || null,
      },
      fetchPolicy: "cache-first",
    }
  );

  const rows = data?.adminUserCollections ?? [];

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    refetch({
      limit: DEFAULT_LIMIT,
      search: search.trim() || null,
    });
  };

  if (loading && !data) {
    return (
      <div className="border border-white/5 rounded-xl p-4 bg-black/40">
        <p className="text-sm text-neutral-300 mb-1">
          Loading collections overview…
        </p>
        <p className="text-xs text-neutral-500">
          Fetching collection summaries for users.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-500/40 rounded-xl p-4 bg-red-950/40">
        <p className="text-sm text-red-300 font-semibold mb-1">
          Failed to load collections
        </p>
        <p className="text-xs text-red-200 mb-3">{error.message}</p>
        <button
          type="button"
          onClick={() =>
            refetch({
              limit: DEFAULT_LIMIT,
              search: search.trim() || null,
            })
          }
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border border-red-400/60 text-red-50 hover:bg-red-500/10"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="space-y-3">
        <Header
          search={search}
          onSearchChange={handleSearchChange}
          onSearchSubmit={handleSearchSubmit}
          onRefresh={() =>
            refetch({
              limit: DEFAULT_LIMIT,
              search: search.trim() || null,
            })
          }
        />
        <div className="border border-white/5 rounded-xl p-4 bg-black/40">
          <p className="text-sm text-neutral-300">
            No collections found for the current filters.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Header
        search={search}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
        onRefresh={() =>
          refetch({
            limit: DEFAULT_LIMIT,
            search: search.trim() || null,
          })
        }
        count={rows.length}
      />

      <div className="overflow-x-auto border border-white/5 rounded-xl bg-black/40">
        <table className="min-w-full text-xs">
          <thead className="bg-white/5 text-neutral-300">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">User</th>
              <th className="px-3 py-2 text-left font-semibold">Email</th>
              <th className="px-3 py-2 text-right font-semibold">
                Total cards
              </th>
              <th className="px-3 py-2 text-right font-semibold">
                Distinct cards
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.userId}
                className="border-t border-white/5 hover:bg-white/5 transition"
              >
                {/* User */}
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-col">
                    <span className="font-medium text-neutral-50">
                      {row.username || "—"}
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      {row.userId}
                    </span>
                  </div>
                </td>

                {/* Email */}
                <td className="px-3 py-2 align-top">
                  <span className="text-[11px] text-neutral-300">
                    {row.email || "—"}
                  </span>
                </td>

                {/* Total cards */}
                <td className="px-3 py-2 align-top text-right">
                  <span className="text-[11px] text-neutral-300">
                    {row.totalCards ?? 0}
                  </span>
                </td>

                {/* Distinct cards */}
                <td className="px-3 py-2 align-top text-right">
                  <span className="text-[11px] text-neutral-300">
                    {row.distinctCards ?? 0}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Header({
  search,
  onSearchChange,
  onSearchSubmit,
  onRefresh,
  count,
}) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-sm font-semibold text-neutral-50">
          Collections overview
        </h2>
        <p className="text-xs text-neutral-500">
          {typeof count === "number"
            ? `Showing ${count} users' collections.`
            : "Shows per-user collection stats (total + distinct cards)."}
        </p>
      </div>

      <form
        onSubmit={onSearchSubmit}
        className="flex items-center gap-2 w-full md:w-auto"
      >
        <input
          type="text"
          placeholder="Search by username or email…"
          value={search}
          onChange={onSearchChange}
          className="flex-1 md:flex-none px-3 py-1.5 text-xs rounded-md bg-black/60 border border-white/15 text-neutral-50 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/40"
        />
        <button
          type="submit"
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border border-white/20 text-neutral-50 hover:bg-white/10"
        >
          Search
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border border-white/20 text-neutral-50 hover:bg-white/10"
        >
          Refresh
        </button>
      </form>
    </div>
  );
}
