// Service worker: offline cache (network-first, so online visits never see stale code) and timer notifications.
// Cache keys are full URLs, so the ?v= cache-busting strings keep working.
const CACHE = 'timegrove-runtime-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event =>
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys())
        if (k.startsWith('timegrove-') && k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })()
  )
);
// Fetch from network and refresh the cache; on failure fall back to the cached copy.
async function fromNetwork(request) {
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE).then(
      c => c.put(request, copy),
      () => {}
    );
  }
  return response;
}
async function cached(request) {
  const nav = request.mode === 'navigate';
  return (
    (await caches.match(request, nav ? {ignoreSearch: true} : undefined)) ||
    (nav && ((await caches.match('./')) || (await caches.match('./index.html')))) ||
    undefined
  );
}
async function respond(request) {
  const network = fromNetwork(request);
  network.catch(() => {}); // avoid unhandled rejection when the cache won the race
  try {
    if (request.mode !== 'navigate') return await network;
    // Navigations: after 4s serve the cache if there is one, while the network fetch keeps updating it.
    const slow = new Promise(resolve => setTimeout(() => resolve(cached(request)), 4000));
    return (await Promise.race([network, slow])) || (await network);
  } catch (error) {
    return (await cached(request)) || new Response('Offline', {status: 503});
  }
}
self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.endsWith('/sw.js')) return;
  event.respondWith(respond(request));
});
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
