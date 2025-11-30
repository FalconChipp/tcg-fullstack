// frontend/src/components/Admin/AdminUsersPanel.js
// -----------------------------------------------------------------------------
// Admin panel: list users with basic status info + simple actions.
// Reuses ADMIN_OVERVIEW_QUERY and consumes allUsers.
// -----------------------------------------------------------------------------

"use client";

import React from "react";
import { useQuery } from "@apollo/client";
import { ADMIN_OVERVIEW_QUERY } from "@/graphql/adminOverview";

export default function AdminUsersPanel() {
  const { data, loading, error, refetch } = useQuery(ADMIN_OVERVIEW_QUERY, {
    variables: {
      usersLimit: 200,
    },
    fetchPolicy: "cache-first",
  });

  const users = data?.allUsers ?? [];

  const handleCopy = async (label, value) => {
    try {
      await navigator.clipboard.writeText(String(value ?? ""));
      console.log(`[AdminUsersPanel] Copied ${label}:`, value);
    } catch (err) {
      console.warn(`[AdminUsersPanel] Failed to copy ${label}`, err);
    }
  };

  const formatDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="border border-white/5 rounded-xl p-4 bg-black/40">
        <p className="text-sm text-neutral-300 mb-2">Loading users…</p>
        <p className="text-xs text-neutral-500">
          Fetching up to 200 accounts from the server.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-500/40 rounded-xl p-4 bg-red-950/40">
        <p className="text-sm text-red-300 font-semibold mb-1">
          Failed to load users
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

  if (!users.length) {
    return (
      <div className="border border-white/5 rounded-xl p-4 bg-black/40">
        <p className="text-sm text-neutral-300">
          No users found.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-50">Users</h2>
          <p className="text-xs text-neutral-500">
            Showing {users.length} users (limited to 200).
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

      {/* Table */}
      <div className="overflow-x-auto border border-white/5 rounded-xl bg-black/40">
        <table className="min-w-full text-xs">
          <thead className="bg-white/5 text-neutral-300">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">User</th>
              <th className="px-3 py-2 text-left font-semibold">Email</th>
              <th className="px-3 py-2 text-left font-semibold">Flags</th>
              <th className="px-3 py-2 text-left font-semibold">Profile</th>
              <th className="px-3 py-2 text-left font-semibold">Created</th>
              <th className="px-3 py-2 text-left font-semibold">Last login</th>
              <th className="px-3 py-2 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const profile = u.profile;
              const flags = [];
              if (u.isAdmin) flags.push("Admin");
              if (u.isBanned) flags.push("Banned");
              if (!flags.length) flags.push("User");

              return (
                <tr
                  key={u.id}
                  className="border-t border-white/5 hover:bg-white/5 transition"
                >
                  {/* User */}
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col">
                      <span className="font-medium text-neutral-50">
                        {u.username || "—"}
                      </span>
                      <span className="text-[11px] text-neutral-500">
                        {u.id}
                      </span>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-3 py-2 align-top">
                    <span className="text-[11px] text-neutral-300">
                      {u.email || "—"}
                    </span>
                  </td>

                  {/* Flags */}
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap gap-1">
                      {flags.map((flag) => (
                        <span
                          key={flag}
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-white/5 text-neutral-100"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Profile */}
                  <td className="px-3 py-2 align-top">
                    {profile ? (
                      <div className="space-y-0.5">
                        {profile.country && (
                          <p className="text-[11px] text-neutral-300">
                            {profile.country}
                          </p>
                        )}
                        {profile.status && (
                          <p className="text-[11px] text-neutral-400">
                            {profile.status}
                          </p>
                        )}
                        {profile.favouritePokemon && (
                          <p className="text-[11px] text-neutral-500">
                            Fav: {profile.favouritePokemon}
                          </p>
                        )}
                        {!profile.country &&
                          !profile.status &&
                          !profile.favouritePokemon && (
                            <p className="text-[11px] text-neutral-500">
                              Profile incomplete
                            </p>
                          )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-neutral-500">
                        No profile
                      </span>
                    )}
                  </td>

                  {/* Created */}
                  <td className="px-3 py-2 align-top">
                    <span className="text-[11px] text-neutral-400">
                      {formatDate(u.createdAt)}
                    </span>
                  </td>

                  {/* Last login */}
                  <td className="px-3 py-2 align-top">
                    <span className="text-[11px] text-neutral-400">
                      {formatDate(u.lastLogin)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopy("user ID", u.id)}
                        className="px-2 py-1 rounded-md border border-white/15 text-[10px] text-neutral-100 hover:bg-white/10"
                      >
                        Copy ID
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy("email", u.email)}
                        className="px-2 py-1 rounded-md border border-white/15 text-[10px] text-neutral-100 hover:bg-white/10"
                      >
                        Copy email
                      </button>

                      {/* Drop your original ban/unban/make-admin actions in here later */}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
