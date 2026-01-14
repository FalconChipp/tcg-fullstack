// src/hooks/useWishlistData.js
// UPDATED (2026-01-13):
// - Ensures wishlist entries KEEP `status` from API (fixes UI always showing ACTIVE)
// - Normalizes status to uppercase
// - Returns consistent wishlist shape: { entries, total, page, pageSize }
// - Exposes setWishlist + refresh()

"use client";

import { useEffect, useMemo, useState } from "react";

const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;

const STATUS_CHIPS = ["ACTIVE", "GRAIL", "EVENTUAL", "UPGRADE"];

function cleanStr(v) {
  return typeof v === "string" ? v.trim() : "";
}

function normStatus(v) {
  const s = cleanStr(v).toUpperCase();
  return STATUS_CHIPS.includes(s) ? s : "ACTIVE";
}

export default function useWishlistData({
  isOwnProfile,
  userId,
  token,
  page = 1,
  pageSize = 25,
}) {
  const [wishlist, setWishlist] = useState({ entries: [], total: 0, page, pageSize });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [refreshTick, setRefreshTick] = useState(0);
  const refresh = () => setRefreshTick((p) => p + 1);

  const variables = useMemo(
    () => ({
      userId: String(userId || ""),
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 25,
    }),
    [userId, page, pageSize]
  );

  useEffect(() => {
    let aborted = false;

    async function run() {
      if (!userId) {
        setWishlist({ entries: [], total: 0, page, pageSize });
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      // ✅ IMPORTANT: includes status
      const query = `
        query Wishlist($userId: ID!, $page: Int, $pageSize: Int) {
          wishlist(userId: $userId, page: $page, pageSize: $pageSize) {
            entries {
              id
              cardId
              variation
              quantity
              status
              createdAt
              updatedAt
              card {
                id
                name
                number
                setCode
                set { name }
                images { small large }
                variants { key label default }
                latestPrices { provider currency market mid low high gbp variation updatedAt }
              }
            }
            total
            page
            pageSize
          }
        }
      `;

      try {
        const resp = await fetch(WP_GRAPHQL_URL, {
          method: "POST",
          headers,
          cache: "no-store",
          body: JSON.stringify({ query, variables }),
        });

        const json = await resp.json().catch(() => ({}));
        if (aborted) return;

        if (json?.errors?.length) {
          throw new Error(json.errors[0]?.message || "Wishlist query failed");
        }

        const raw = json?.data?.wishlist || { entries: [], total: 0, page, pageSize };

        // ✅ FIX: normalize entries WITHOUT overwriting status
        const entries = Array.isArray(raw.entries)
          ? raw.entries.map((e) => ({
              ...e,
              // keep status from API; normalize it
              status: normStatus(e?.status),
              // ensure `card` stays nested (avoid flatten merges that can clobber fields)
              card: e?.card || null,
            }))
          : [];

        setWishlist({
          entries,
          total: Number(raw.total) || entries.length,
          page: Number(raw.page) || page,
          pageSize: Number(raw.pageSize) || pageSize,
        });

        setLoading(false);
      } catch (e) {
        if (aborted) return;
        setError(e);
        setLoading(false);
      }
    }

    run();
    return () => {
      aborted = true;
    };
  }, [userId, token, page, pageSize, refreshTick]);

  return {
    wishlist,
    setWishlist, // ✅ real setter (authoritative)
    loading,
    error,
    refresh,
  };
}
