// SixByFive TCG — Web Push Service Worker
// Handles push events and notification clicks from the Web Push API.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'SixByFive TCG', body: event.data.text() };
  }

  const title   = payload.title || 'SixByFive TCG';
  const options = {
    body:    payload.body   || '',
    icon:    '/icons/icon-192x192.png',
    badge:   '/icons/badge-72x72.png',
    data:    { linkUrl: payload.linkUrl || '/', type: payload.type || null },
    tag:     payload.type   || 'sbf-notification',
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const linkUrl = event.notification.data?.linkUrl || '/';
  const absolute = linkUrl.startsWith('http') ? linkUrl : self.location.origin + linkUrl;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus an existing tab if one is already open on the target URL
      for (const client of windowClients) {
        if (client.url === absolute && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(absolute);
      }
    }),
  );
});
