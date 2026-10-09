// Minimal service worker: only shows timer notifications and focuses the app when one is tapped.
// It deliberately has no fetch handler, so it never caches or serves stale pages.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
      const open = windows.find(w =>
        new URL(w.url).pathname.startsWith(new URL(self.registration.scope).pathname)
      );
      if (open) return open.focus();
      return self.clients.openWindow('./#focus');
    })()
  );
});
