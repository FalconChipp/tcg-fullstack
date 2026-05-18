// src/graphql/notifications.js
// Typed documents from the shared api-client package.
// Helper functions are preserved for non-Apollo (raw fetch) usage via executeQuery.

import { print } from 'graphql';
import {
  MyNotificationsDocument,
  UnreadNotificationCountDocument,
  MyNotificationPrefsDocument,
  MarkNotificationReadDocument,
  MarkAllNotificationsReadDocument,
  DismissNotificationDocument,
  SetNotificationPrefsDocument,
} from '@sixbyfive/api-client';
import { executeQuery } from '@/utils/graphqlUtils';

// ── Typed documents (use with Apollo useQuery / useMutation) ──────────────────

export {
  MyNotificationsDocument,
  UnreadNotificationCountDocument,
  MyNotificationPrefsDocument,
  MarkNotificationReadDocument,
  MarkAllNotificationsReadDocument,
  DismissNotificationDocument,
  SetNotificationPrefsDocument,
};

// ── Raw-fetch helpers (kept for backwards compatibility) ──────────────────────

export async function fetchNotifications({ token, page = 1, pageSize = 10, filter = {} }) {
  const data = await executeQuery(print(MyNotificationsDocument), { page, pageSize, filter }, token);
  return data?.myNotifications || { notifications: [], total: 0, page, pageSize };
}

export async function fetchUnreadCount({ token }) {
  const data = await executeQuery(print(UnreadNotificationCountDocument), {}, token);
  return data?.unreadNotificationCount ?? 0;
}

export async function fetchPrefs({ token }) {
  const data = await executeQuery(print(MyNotificationPrefsDocument), {}, token);
  return data?.myNotificationPrefs;
}

export async function setPrefs({ token, input }) {
  const data = await executeQuery(print(SetNotificationPrefsDocument), input, token);
  return data?.setNotificationPrefs === true;
}

export async function markNotificationRead({ token, id }) {
  const data = await executeQuery(print(MarkNotificationReadDocument), { id }, token);
  return data?.markNotificationRead === true;
}

export async function markAllNotificationsRead({ token }) {
  const data = await executeQuery(print(MarkAllNotificationsReadDocument), {}, token);
  return data?.markAllNotificationsRead === true;
}

export async function dismissNotification({ token, id }) {
  const data = await executeQuery(print(DismissNotificationDocument), { id }, token);
  return data?.dismissNotification === true;
}

// ── UI shape mapper ───────────────────────────────────────────────────────────

export function mapNotification(n) {
  return {
    id: n.id,
    type: n.type || 'info',
    title: n.title || '',
    body: n.body || '',
    iconUrl: n.iconUrl || null,
    linkUrl: n.linkUrl || null,
    read: !!n.isRead,
    dismissed: !!n.isDismissed,
    date: n.createdAt,
  };
}
