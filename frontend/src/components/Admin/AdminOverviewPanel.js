// frontend/src/components/Admin/AdminOverviewPanel.js
// -----------------------------------------------------------------------------
// Admin overview panel.
// Shows high-level counts for users + listings using ADMIN_OVERVIEW_QUERY.
// -----------------------------------------------------------------------------

"use client";

import React from "react";
import { useQuery } from "@apollo/client";
import { ADMIN_OVERVIEW_QUERY } from "@/graphql/adminOverview";

export default function AdminOverviewPanel() {
  const { data, loading, error, refetch } = useQuery(ADMIN_OVERVIEW_QUERY, {
    variables: {
      usersLimit: 500,
      listingsLimit: 500,
    },
    fetchPolicy: "cache-first",
  });

  const users = data?.allUsers ?? [];
  const listings = data?.listings ?? [];

  const totalUsers = users.length;
  const adminUsers = users.filter((u) => u.isAdmin).length;
  const bannedUsers = users.filter((u) => u.isBanned).length;

  const totalListings = listings.length;
  const activeListings = listings.filter((l) => l.status === "active").length;
  const soldListings = listings.filter((l) => l.status === "sold").length;
  const cardListings = listings.filter((l) => l.type === "CARD").length;
  const productListings = listings.filter((l) => l.type === "PRODUCT").length;

  if (loading) {
    return (
      <div className="border border-white/5 rounded-xl p-4 md:p-6 bg-black/40">
        <p className="text-sm text-neutral-300 mb-1">
          Loading admin overview…
        </p>
        <p className="text-xs text-neutral-500">
          Fetching users and listings data from the server.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-500/40 rounded-xl p-4 md:p-6 bg-red-950/40">
        <p className="text-sm text-red-300 font-semibold mb-1">
          Failed to load admin overview
        </p>
        <p className="text-xs text-red-200 mb-3">{error.message}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border border-red-400/60 text-red-50 hover:bg-red-500/10"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top intro + refresh */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-50">
            Admin overview
          </h2>
          <p className="text-xs text-neutral-500">
            High-level stats pulled live from your backend.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border border-white/20 text-neutral-50 hover:bg-white/10"
        >
          Refresh
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total users */}
        <StatCard
          label="Total users"
          value={totalUsers}
          sub={`${adminUsers} admin${adminUsers === 1 ? "" : "s"}`}
        />
        {/* Admin users */}
        <StatCard
          label="Admin users"
          value={adminUsers}
          sub={`${bannedUsers} banned`}
        />
        {/* Banned users */}
        <StatCard
          label="Banned users"
          value={bannedUsers}
          sub={`${totalUsers - bannedUsers} active`}
        />
        {/* Total listings */}
        <StatCard
          label="Total listings"
          value={totalListings}
          sub={`${activeListings} active • ${soldListings} sold`}
        />
        {/* Card listings */}
        <StatCard
          label="Card listings"
          value={cardListings}
          sub={`${productListings} product listings`}
        />
      </div>

      {/* Raw info block */}
      <div className="border border-white/5 rounded-xl p-4 md:p-5 bg-black/40">
        <p className="text-xs text-neutral-400 mb-1">
          This panel currently uses:
        </p>
        <ul className="text-[11px] text-neutral-500 space-y-0.5 list-disc list-inside">
          <li>
            <code className="px-1 py-0.5 rounded bg-black/60 border border-white/10">
              allUsers(limit: 500)
            </code>{" "}
            to count total/admin/banned users.
          </li>
          <li>
            <code className="px-1 py-0.5 rounded bg-black/60 border border-white/10">
              listings(limit: 500)
            </code>{" "}
            to count card vs product and active vs sold listings.
          </li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="border border-white/10 rounded-xl p-3.5 bg-black/40">
      <p className="text-[11px] text-neutral-400 mb-1">{label}</p>
      <p className="text-xl font-semibold text-neutral-50">
        {value ?? 0}
      </p>
      {sub && (
        <p className="text-[11px] text-neutral-500 mt-0.5">
          {sub}
        </p>
      )}
    </div>
  );
}
