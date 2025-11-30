// frontend/src/components/Admin/AdminBindersPanel.js
// -----------------------------------------------------------------------------
// Admin panel: list binders and allow delete.
// Uses adminBinders + adminDeleteBinder from the backend.
// -----------------------------------------------------------------------------

"use client";

import React from "react";
import { gql, useQuery, useMutation } from "@apollo/client";

const BINDERS = gql`
  query AdminBinders {
    adminBinders {
      id
      name
    }
  }
`;

const DELETE_BINDER = gql`
  mutation AdminDeleteBinder($id: ID!) {
    adminDeleteBinder(id: $id)
  }
`;

export default function AdminBindersPanel() {
  const { data, loading, error, refetch } = useQuery(BINDERS, {
    fetchPolicy: "cache-first",
  });

  const [deleteBinder, { loading: deleting }] = useMutation(DELETE_BINDER, {
    onCompleted: () => refetch(),
  });

  const binders = data?.adminBinders ?? [];

  const handleDelete = (binder) => {
    if (!confirm(`Delete binder "${binder.name}" (${binder.id})?`)) return;
    deleteBinder({ variables: { id: binder.id } });
  };

  if (loading) {
    return (
      <div className="border border-white/5 rounded-xl p-4 bg-black/40">
        <p className="text-sm text-neutral-300 mb-1">Loading binders…</p>
        <p className="text-xs text-neutral-500">
          Fetching binders from the server.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-500/40 rounded-xl p-4 bg-red-950/40">
        <p className="text-sm text-red-300 font-semibold mb-1">
          Failed to load binders
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

  if (!binders.length) {
    return (
      <div className="border border-white/5 rounded-xl p-4 bg-black/40">
        <p className="text-sm text-neutral-300">No binders found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-50">Binders</h2>
          <p className="text-xs text-neutral-500">
            Showing {binders.length} binders.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={deleting}
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border border-white/20 text-neutral-50 hover:bg-white/10 disabled:opacity-60"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto border border-white/5 rounded-xl bg-black/40">
        <table className="min-w-full text-xs">
          <thead className="bg-white/5 text-neutral-300">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">ID</th>
              <th className="px-3 py-2 text-left font-semibold">Name</th>
              <th className="px-3 py-2 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {binders.map((b) => (
              <tr
                key={b.id}
                className="border-t border-white/5 hover:bg-white/5 transition"
              >
                <td className="px-3 py-2 align-top font-mono text-[11px] text-neutral-400">
                  {b.id}
                </td>
                <td className="px-3 py-2 align-top">
                  <span className="text-sm text-neutral-50">{b.name}</span>
                </td>
                <td className="px-3 py-2 align-top">
                  <button
                    type="button"
                    onClick={() => handleDelete(b)}
                    disabled={deleting}
                    className="px-2 py-1 rounded-md border border-red-400/60 text-[10px] text-red-200 hover:bg-red-500/20 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
