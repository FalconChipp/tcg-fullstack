// src/hooks/useNotifications.js
//
// UPDATED (2026-01-30):
// - FIX: Use dedicated Socket.IO path "/realtime/socket.io" to avoid express-status-monitor collision
// - FIX: Use polling + upgrade:false while websocket is unstable
// - ADD: Debug logs for connect/connect_error/disconnect
// - KEEP: existing polling fallback + GraphQL notification fetch logic

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  dismissNotification,
  mapNotification,
} from "@/graphql/notifications";

const SOCKET_PATH = "/realtime/socket.io"; // ✅ must match backend

function normalizeOriginUrl(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s.replace(/\/+$/, "");
  return `https://${s}`.replace(/\/+$/, "");
}

function getBackendOrigin() {
  const realtime = process.env.NEXT_PUBLIC_REALTIME_URL;
  if (realtime) return normalizeOriginUrl(realtime);

  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (backend) return normalizeOriginUrl(backend);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (apiBase) return normalizeOriginUrl(apiBase);

  return normalizeOriginUrl("http://localhost:4018");
}

export function useNotifications({ token, pageSize = 10, pollMs = 30000 } = {}) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const timerRef = useRef(null);
  const socketRef = useRef(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [{ notifications, total: totalCount }, unreadCount] = await Promise.all([
        fetchNotifications({ token, page: 1, pageSize, filter: { isDismissed: false } }),
        fetchUnreadCount({ token }),
      ]);

      setItems((notifications || []).map(mapNotification));
      setTotal(totalCount || 0);
      setPage(1);
      setUnread(unreadCount || 0);
    } catch (e) {
      setError(e.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [token, pageSize]);

  // polling refresh
  useEffect(() => {
    load();
    if (!token) return;

    if (pollMs > 0) {
      timerRef.current = setInterval(load, pollMs);
      return () => clearInterval(timerRef.current);
    }
  }, [load, token, pollMs]);

  // reset when logged out
  useEffect(() => {
    if (token) return;
    setItems([]);
    setUnread(0);
    setTotal(0);
    setPage(1);
  }, [token]);

  // socket push refresh
  useEffect(() => {
    if (!token) return;

    const origin = getBackendOrigin();

    // clear existing
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    console.log("[Notifications] creating socket", {
      origin,
      path: SOCKET_PATH,
      transports: ["polling"],
      upgrade: false,
      tokenPresent: !!token,
    });

    const socket = io(origin, {
      path: SOCKET_PATH, // ✅ NEW
      auth: { token },

      // ✅ while websocket is unstable
      transports: ["polling"],
      upgrade: false,

      reconnection: true,
      reconnectionAttempts: 10,
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => console.log("[Notifications] socket connected", { id: socket.id }));
    socket.on("disconnect", (reason) => console.warn("[Notifications] socket disconnected", reason));
    socket.on("connect_error", (err) =>
      console.error("[Notifications] socket connect_error", err?.message || err)
    );

    // Your server-side event name must match this:
    // If your backend emits "notification" or "newNotification", align it here.
    socket.on("notification", () => {
      load();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, load]);

  const markAllRead = useCallback(async () => {
    if (!token) return;
    try {
      await markAllNotificationsRead({ token });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch (e) {
      console.error("markAllRead failed", e);
    }
  }, [token]);

  const markOneRead = useCallback(
    async (id) => {
      if (!token) return;
      try {
        await markNotificationRead({ token, id });
        setItems((prev) => {
          let didUpdate = false;
          const next = prev.map((n) => {
            if (n.id === id && !n.read) {
              didUpdate = true;
              return { ...n, read: true };
            }
            return n;
          });
          if (didUpdate) setUnread((u) => Math.max(0, u - 1));
          return next;
        });
      } catch (e) {
        console.error("markOneRead failed", e);
      }
    },
    [token]
  );

  const dismissOne = useCallback(
    async (id) => {
      if (!token) return;
      try {
        await dismissNotification({ token, id });
        setItems((prev) => {
          const removed = prev.find((n) => n.id === id);
          if (removed && !removed.read) setUnread((u) => Math.max(0, u - 1));
          return prev.filter((n) => n.id !== id);
        });
        setTotal((prev) => Math.max(0, prev - 1));
      } catch (e) {
        console.error("dismissOne failed", e);
      }
    },
    [token]
  );

  const loadMore = useCallback(async () => {
    if (!token || loadingMore) return;
    if (items.length >= total) return;

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { notifications, total: totalCount } = await fetchNotifications({
        token,
        page: nextPage,
        pageSize,
        filter: { isDismissed: false },
      });

      setItems((prev) => [...prev, ...(notifications || []).map(mapNotification)]);
      setTotal(totalCount || total);
      setPage(nextPage);
    } catch (e) {
      console.error("loadMore failed", e);
    } finally {
      setLoadingMore(false);
    }
  }, [token, loadingMore, items.length, total, page, pageSize]);

  return {
    items,
    unread,
    total,
    loading,
    loadingMore,
    error,
    hasMore: items.length < total,
    reload: load,
    markAllRead,
    markOneRead,
    dismissOne,
    loadMore,
  };
}
