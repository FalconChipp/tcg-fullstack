"use client";

import React from "react";
import { useQuery } from "@apollo/client";
import { ADMIN_OVERVIEW_QUERY } from "@/graphql/adminOverview";

function StatCard({ label, value, sub, accent }) {
  const accentMap = {
    green:  "border-emerald-500/20 bg-emerald-500/[0.04]",
    red:    "border-red-500/20 bg-red-500/[0.04]",
    amber:  "border-amber-500/20 bg-amber-500/[0.04]",
    blue:   "border-sky-500/20 bg-sky-500/[0.04]",
    purple: "border-violet-500/20 bg-violet-500/[0.04]",
    default:"border-white/[0.08] bg-white/[0.02]",
  };

  const valueColor = {
    green:  "text-emerald-300",
    red:    "text-red-300",
    amber:  "text-amber-300",
    blue:   "text-sky-300",
    purple: "text-violet-300",
    default:"text-neutral-50",
  };

  const cls = accentMap[accent] ?? accentMap.default;
  const vcls = valueColor[accent] ?? valueColor.default;

  return (
    <div className={`border rounded-xl p-4 ${cls}`}>
      <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums ${vcls}`}>
        {value ?? 0}
      </p>
      {sub && (
        <p className="text-[11px] text-neutral-500 mt-1.5">{sub}</p>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="border border-white/[0.06] rounded-xl p-4 bg-white/[0.02] animate-pulse"
        >
          <div className="h-3 w-20 rounded bg-white/10 mb-3" />
          <div className="h-7 w-12 rounded bg-white/10 mb-2" />
          <div className="h-2.5 w-24 rounded bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}

export default function AdminOverviewPanel() {
  const { data, loading, error, refetch } = useQuery(ADMIN_OVERVIEW_QUERY, {
    variables: { usersLimit: 500, listingsLimit: 500 },
    fetchPolicy: "cache-first",
  });

  const users    = data?.allUsers    ?? [];
  const listings = data?.listings    ?? [];

  const totalUsers    = users.length;
  const adminUsers    = users.filter((u) => u.isAdmin).length;
  const bannedUsers   = users.filter((u) => u.isBanned).length;
  const verifiedUsers = users.filter((u) => u.emailVerified).length;

  const totalListings   = listings.length;
  const activeListings  = listings.filter((l) => l.status === "ACTIVE" || l.status === "active").length;
  const soldListings    = listings.filter((l) => l.status === "SOLD"   || l.status === "sold").length;
  const pendingListings = listings.filter((l) => String(l.status).toLowerCase().includes("pending")).length;
  const cardListings    = listings.filter((l) => l.type === "CARD").length;
  const productListings = listings.filter((l) => l.type === "PRODUCT").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-50">Overview</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Platform-wide metrics at a glance.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={loading}
          className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium border border-white/15 text-neutral-300 hover:bg-white/5 disabled:opacity-50 transition"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="border border-red-500/30 rounded-xl p-4 bg-red-950/30">
          <p className="text-sm text-red-300 font-medium mb-1">Failed to load overview</p>
          <p className="text-xs text-red-400">{error.message}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 inline-flex items-center rounded-lg px-3 py-1.5 text-xs border border-red-400/50 text-red-200 hover:bg-red-500/10"
          >
            Try again
          </button>
        </div>
      )}

      {loading && !data ? (
        <Skeleton />
      ) : (
        <>
          {/* Users */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-600">
              Users
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Total users"
                value={totalUsers}
                sub={`${verifiedUsers} verified emails`}
              />
              <StatCard
                label="Admins"
                value={adminUsers}
                sub={`${((adminUsers / totalUsers) * 100 || 0).toFixed(1)}% of users`}
                accent="purple"
              />
              <StatCard
                label="Banned"
                value={bannedUsers}
                sub={bannedUsers > 0 ? "Review ban list" : "All clear"}
                accent={bannedUsers > 0 ? "red" : "default"}
              />
              <StatCard
                label="Unverified"
                value={totalUsers - verifiedUsers}
                sub="Awaiting email confirmation"
                accent={totalUsers - verifiedUsers > 0 ? "amber" : "default"}
              />
            </div>
          </section>

          {/* Listings */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-600">
              Marketplace
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Total listings"
                value={totalListings}
                sub={`${cardListings} cards · ${productListings} products`}
              />
              <StatCard
                label="Active"
                value={activeListings}
                sub={`${((activeListings / totalListings) * 100 || 0).toFixed(1)}% of all`}
                accent="green"
              />
              <StatCard
                label="Sold"
                value={soldListings}
                sub="Completed sales"
                accent="blue"
              />
              <StatCard
                label="Pending / proof"
                value={pendingListings}
                sub="Awaiting moderation or payment"
                accent={pendingListings > 0 ? "amber" : "default"}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
