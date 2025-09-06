// hooks/useWishlistData.js
"use client";

import { useCallback, useEffect, useState } from "react";
import { WISHLIST_QUERIES, executeQuery } from "@/utils/graphqlUtils";

export default function useWishlistData({ isOwnProfile, userId, token, page = 1, pageSize = 25 }) {
  const [data, setData] = useState({ entries: [], total: 0, page, pageSize });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = isOwnProfile ? WISHLIST_QUERIES.MY_WISHLIST : WISHLIST_QUERIES.USER_WISHLIST;
      const vars = isOwnProfile ? { page, pageSize } : { userId, page, pageSize };
      const res = await executeQuery(query, vars, token);
      const payload = isOwnProfile ? res?.myWishlist : res?.wishlist;
      if (!payload) throw new Error("Failed to fetch wishlist");
      setData({
        entries: Array.isArray(payload.entries) ? payload.entries : [],
        total: payload.total || 0,
        page: payload.page || page,
        pageSize: payload.pageSize || pageSize,
      });
    } catch (e) {
      setError(e?.message || "Failed to fetch wishlist");
    } finally {
      setLoading(false);
    }
  }, [isOwnProfile, userId, token, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  return {
    wishlist: data,          // { entries, total, page, pageSize }
    setWishlist: setData,    // keep same shape for your existing updaters
    loading,
    error,
    refresh: load,
  };
}
