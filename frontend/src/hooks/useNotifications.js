// src/hooks/useNotifications.js
// NEW: simple polling hook to load notifications + unread badge

"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  dismissNotification,
  mapNotification
} from '@/graphql/notifications';

export function useNotifications({ token, pageSize = 10, pollMs = 30000 } = {}) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [{ notifications }, unreadCount] = await Promise.all([
        fetchNotifications({ token, page: 1, pageSize, filter: { isDismissed: false } }),
        fetchUnreadCount({ token }),
      ]);
      setItems((notifications || []).map(mapNotification));
      setUnread(unreadCount || 0);
    } catch (e) {
      setError(e.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [token, pageSize]);

  useEffect(() => {
    load();
    if (!token) return;
    if (pollMs > 0) {
      timerRef.current = setInterval(load, pollMs);
      return () => clearInterval(timerRef.current);
    }
  }, [load, token, pollMs]);

  const markAllRead = useCallback(async () => {
    if (!token) return;
    try {
      await markAllNotificationsRead({ token });
      setItems(prev => prev.map(n => ({ ...n, read: true })));
      setUnread(0);
    } catch (e) {
      console.error('markAllRead failed', e);
    }
  }, [token]);

  const markOneRead = useCallback(async (id) => {
    if (!token) return;
    try {
      await markNotificationRead({ token, id });
      setItems(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
      setUnread(u => Math.max(0, u - 1));
    } catch (e) {
      console.error('markOneRead failed', e);
    }
  }, [token]);

  const dismissOne = useCallback(async (id) => {
    if (!token) return;
    try {
      await dismissNotification({ token, id });
      setItems(prev => prev.filter(n => n.id !== id));
    } catch (e) {
      console.error('dismissOne failed', e);
    }
  }, [token]);

  return { items, unread, loading, error, reload: load, markAllRead, markOneRead, dismissOne };
}
