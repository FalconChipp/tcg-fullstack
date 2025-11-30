// frontend/src/components/Admin/AdminListingsPanel.js
// -----------------------------------------------------------------------------
// Admin panel: marketplace listings for CARD listings only.
// Uses listings(type: CARD, ...) + deleteListing(id: ID!) on the backend.
// -----------------------------------------------------------------------------

"use client";

import React from "react";
import { gql, useQuery, useMutation } from "@apollo/client";

// Query only CARD listings via the unified marketplace API
const CARD_LISTINGS = gql`
  query AdminCardListings($limit: Int, $offset: Int) {
    listings(type: CARD, limit: $limit, offset: $offset) {
      __typename
      ... on CardListing {
        id
        cardId
        quantity
        price
        status
      }
    }
  }
`;

// Use the generic deleteListing mutation
const DELETE_LISTING = gql`
  mutation AdminDeleteListing($id: ID!) {
    deleteListing(id: $id)
  }
`;

const PAGE_SIZE = 100;

export default function AdminListingsPanel() {
  const { data, loading, error, refetch } = useQuery(CARD_LISTINGS, {
    variables: { limit: PAGE_SIZE, offset: 0 },
    fetchPolicy: "cache-first",
  });

  const [deleteListing, { loading: deleting }] = useMutation(DELETE_LISTING, {
    onCompleted: () => refetch(),
  });

  // Filter to CardListing only (defensive in case other types ever leak in)
  const listings =
    data?.listings?.filter((l) => l.__typename === "CardListing") ?? [];

  const handleDelete = (l) => {
    if (
      !confirm(
        `Delete listing ${l.id} for card ${l.cardId} (${l.quantity} @ £${l.price})?`
      )
    ) {
      return;
    }

    deleteListing({ variables: { id: l.id } });
  };

  if (loading) {
    return (
      <div className="border border-white/5 rounded-xl p-4 bg-black/40">
        <p className="text-sm text-neutral-300 mb-1">
          Loading marketplace listings…
        </p>
        <p className="text-xs text-neutral-500">
          Fetching card listings from the server.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-500/40 rounded-xl p-4 bg-red-950/40">
        <p className="text-sm text-red-300 font-semibold mb-1">
          Failed to load listings
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

  if (!listings.length) {
    return (
      <div className="border border-white/5 rounded-xl p-4 bg-black/40">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-sm font-semibold text-neutral-50">
            Marketplace listings
          </h2>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border border-white/20 text-neutral-50 hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
        <p className="text-sm text-neutral-300">
          No card listings found.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-50">
            Marketplace listings (cards)
          </h2>
          <p className="text-xs text-neutral-500">
            Showing {listings.length} card listings (limit {PAGE_SIZE}).
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
              <th className="px-3 py-2 text-left font-semibold">Card</th>
              <th className="px-3 py-2 text-left font-semibold">Quantity</th>
              <th className="px-3 py-2 text-left font-semibold">Price</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => (
              <tr
                key={l.id}
                className="border-t border-white/5 hover:bg-white/5 transition"
              >
                <td className="px-3 py-2 align-top font-mono text-[11px] text-neutral-400">
                  {l.id}
                </td>
                <td className="px-3 py-2 align-top">
                  <span className="text-[11px] text-neutral-300">
                    {l.cardId}
                  </span>
                </td>
                <td className="px-3 py-2 align-top">
                  <span className="text-[11px] text-neutral-300">
                    {l.quantity}
                  </span>
                </td>
                <td className="px-3 py-2 align-top">
                  <span className="text-[11px] text-neutral-300">
                    £{Number(l.price ?? 0).toFixed(2)}
                  </span>
                </td>
                <td className="px-3 py-2 align-top">
                  <span className="text-[11px] text-neutral-300">
                    {l.status}
                  </span>
                </td>
                <td className="px-3 py-2 align-top">
                  <button
                    type="button"
                    onClick={() => handleDelete(l)}
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
