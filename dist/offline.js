// Offline support: registers the service worker, warms its cache and asks for persistent storage.
const CACHE = 'timegrove-runtime-v1';
async function warm() {
  const urls = new Set([location.href.split('#')[0], new URL('./', location.href).href]);
  for (const e of performance.getEntriesByType('resource')) urls.add(e.name);
  const cache = await caches.open(CACHE);
  // Cache current versions before pruning old copies, so a partial update
  // cannot discard the only offline version of a resource.
  const current = new Map([...urls].map(h => [new URL(h).pathname, new URL(h).search]));
  for (const href of urls) {
    const url = new URL(href);
    if (url.origin !== location.origin || url.pathname.endsWith('/sw.js')) continue;
    try {
      if (!(await cache.match(href))) await cache.add(href);
    } catch {}
  }
  for (const req of await cache.keys()) {
    const url = new URL(req.url);
    const latestSearch = current.get(url.pathname);
    if (url.search && latestSearch !== undefined && url.search !== latestSearch) {
      const latest = new URL(url.pathname + latestSearch, url.origin);
      if (await cache.match(latest.href)) await cache.delete(req);
    }
  }
}
export async function requestPersist() {
  try {
    if (!navigator.storage?.persist || (await navigator.storage.persisted())) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
export async function storageStatus() {
  try {
    if (!navigator.storage?.persisted) return 'unsupported';
    return (await navigator.storage.persisted()) ? 'persisted' : 'best-effort';
  } catch {
    return 'unsupported';
  }
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(warm)
    .catch(() => {});
}
// Installed apps get persistence without a prompt; browsers get asked only after a meaningful action.
if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) requestPersist();
