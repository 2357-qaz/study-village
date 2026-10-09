// Collectible 3D thumbnails: icons render first, then swap to cached PNGs; any failure silently keeps the icon.
import {icon, items3d} from './store.js?v=9';
const thumbCache = new Map(),
  thumbPending = new Map(),
  thumbFail = new Set();
export const thumbInner = (id, ic) =>
  thumbCache.has(id) ? `<img src="${thumbCache.get(id)}" alt="" decoding="async">` : icon(ic);
export function wantThumb(id) {
  if (thumbCache.has(id)) return Promise.resolve(thumbCache.get(id));
  if (!items3d?.itemThumbnail || thumbFail.has(id)) return Promise.resolve(null);
  if (!thumbPending.has(id))
    thumbPending.set(
      id,
      Promise.resolve()
        .then(() => items3d.itemThumbnail(id))
        .then(u => {
          if (typeof u !== 'string' || !u) throw 0;
          thumbCache.set(id, u);
          return u;
        })
        .catch(() => {
          thumbFail.add(id);
          return null;
        })
        .finally(() => thumbPending.delete(id))
    );
  return thumbPending.get(id);
}
export function hydrateThumbs(root = document) {
  root.querySelectorAll('[data-thumb]').forEach(el => {
    const id = el.dataset.thumb;
    if (el.querySelector('img')) return;
    wantThumb(id).then(u => {
      if (u)
        document.querySelectorAll(`[data-thumb="${id}"]`).forEach(e => {
          if (!e.querySelector('img')) e.innerHTML = `<img src="${u}" alt="" decoding="async">`;
        });
    });
  });
}
