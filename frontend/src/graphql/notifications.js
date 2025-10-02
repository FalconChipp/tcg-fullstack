// src/graphql/notifications.js
// NEW: GraphQL ops + tiny client helpers for notifications & prefs

import { executeQuery } from '@/utils/graphqlUtils';

/* ============================= QUERIES ============================= */

export const NOTIFICATION_QUERIES = {
  LIST: /* GraphQL */ `
    query MyNotifications($page: Int, $pageSize: Int, $filter: NotificationFilterInput) {
      myNotifications(page: $page, pageSize: $pageSize, filter: $filter) {
        notifications {
          id
          type
          title
          body
          iconUrl
          linkUrl
          isRead
          isDismissed
          createdAt
        }
        total
        page
        pageSize
      }
    }
  `,
  UNREAD_COUNT: /* GraphQL */ `
    query UnreadCount {
      unreadNotificationCount
    }
  `,
  PREFS: /* GraphQL */ `
    query MyNotificationPrefs {
      myNotificationPrefs {
        inappEnabled
        emailEnabled
        pushEnabled
        digest
        quietStart
        quietEnd
      }
    }
  `,
};

/* =========================== MUTATIONS ============================ */

export const NOTIFICATION_MUTATIONS = {
  MARK_READ: /* GraphQL */ `
    mutation MarkNotificationRead($id: ID!) {
      markNotificationRead(id: $id)
    }
  `,
  MARK_ALL_READ: /* GraphQL */ `
    mutation MarkAllNotificationsRead {
      markAllNotificationsRead
    }
  `,
  DISMISS: /* GraphQL */ `
    mutation DismissNotification($id: ID!) {
      dismissNotification(id: $id)
    }
  `,
  SET_PREFS: /* GraphQL */ `
    mutation SetNotificationPrefs(
      $inappEnabled: Boolean
      $emailEnabled: Boolean
      $pushEnabled: Boolean
      $digest: String
      $quietStart: String
      $quietEnd: String
    ) {
      setNotificationPrefs(
        inappEnabled: $inappEnabled
        emailEnabled: $emailEnabled
        pushEnabled: $pushEnabled
        digest: $digest
        quietStart: $quietStart
        quietEnd: $quietEnd
      )
    }
  `,
};

/* ============================= HELPERS ============================ */

export async function fetchNotifications({ token, page = 1, pageSize = 10, filter = {} }) {
  const data = await executeQuery(NOTIFICATION_QUERIES.LIST, { page, pageSize, filter }, token);
  return data?.myNotifications || { notifications: [], total: 0, page, pageSize };
}

export async function fetchUnreadCount({ token }) {
  const data = await executeQuery(NOTIFICATION_QUERIES.UNREAD_COUNT, {}, token);
  return data?.unreadNotificationCount ?? 0;
}

export async function fetchPrefs({ token }) {
  const data = await executeQuery(NOTIFICATION_QUERIES.PREFS, {}, token);
  return data?.myNotificationPrefs;
}

export async function setPrefs({ token, input }) {
  const data = await executeQuery(NOTIFICATION_MUTATIONS.SET_PREFS, input, token);
  return data?.setNotificationPrefs === true;
}

export async function markNotificationRead({ token, id }) {
  const data = await executeQuery(NOTIFICATION_MUTATIONS.MARK_READ, { id }, token);
  return data?.markNotificationRead === true;
}

export async function markAllNotificationsRead({ token }) {
  const data = await executeQuery(NOTIFICATION_MUTATIONS.MARK_ALL_READ, {}, token);
  return data?.markAllNotificationsRead === true;
}

export async function dismissNotification({ token, id }) {
  const data = await executeQuery(NOTIFICATION_MUTATIONS.DISMISS, { id }, token);
  return data?.dismissNotification === true;
}

// Map backend Notification -> UI shape expected by NotificationDropdown
export function mapNotification(n) {
  return {
    id: n.id,
    type: (n.type || 'info'),
    title: n.title || '',
    body: n.body || '',
    iconUrl: n.iconUrl || null,
    linkUrl: n.linkUrl || null,
    read: !!n.isRead,
    dismissed: !!n.isDismissed,
    date: n.createdAt,
  };
}
