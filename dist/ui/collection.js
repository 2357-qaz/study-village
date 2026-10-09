// Wonders: the cabinet (奇物柜), the item viewer and stardust wishes (星砂寻宝) with their animation.
import * as C from '../core.js?v=4';
import * as A from '../alerts.js?v=5';
import {
  $,
  icon,
  fmt,
  icons,
  safe,
  toast,
  transact,
  onRender,
  state,
  broken,
  items3d,
  page
} from './store.js?v=9';
import {thumbInner, wantThumb, hydrateThumbs} from './thumbs.js?v=9';
let drawBusy = false,
  viewer = null,
  viewToken = 0;
const RARITY_ORDER = ['legendary', 'epic', 'rare', 'common'],
  RARITY_STARS = {common: 2, rare: 3, epic: 4, legendary: 5},
  WISH_LOG = 'timegrove-wish-log';
let cabinetFilter = 'all';
function wishLog() {
  try {
    const log = JSON.parse(localStorage.getItem(WISH_LOG) || '[]');
    return Array.isArray(log) ? log : [];
  } catch {
    return [];
  }
}
function addWishLog(results) {
  const at = Date.now(),
    log = [...results.map(r => ({t: at, id: r.id})).reverse(), ...wishLog()].slice(0, 60);
  try {
    localStorage.setItem(WISH_LOG, JSON.stringify(log));
  } catch {}
}
export function renderCollections() {
  const owned = C.COLLECTIONS.filter(c => state.collection[c.id]),
    total = C.COLLECTIONS.length;
  $('#collection-count').textContent = owned.length;
  // cabinet
  $('#cabinet-count').textContent = `${owned.length} / ${total}`;
  $('#cabinet-ring').style.strokeDasharray = `${(owned.length / total) * 119.4} 119.4`;
  $('#cabinet-filters').innerHTML = ['all', ...RARITY_ORDER]
    .map(r => {
      const pool = r === 'all' ? C.COLLECTIONS : C.COLLECTIONS.filter(c => c.rarity === r),
        have = pool.filter(c => state.collection[c.id]).length;
      return `<button role="tab" class="cab-filter ${r === 'all' ? '' : 'r-' + r}" data-filter="${r}" aria-selected="${cabinetFilter === r}">${r === 'all' ? '全部' : C.RARITIES[r].name}<small>${have}/${pool.length}</small></button>`;
    })
    .join('');
  $('#collection-grid').innerHTML = C.COLLECTIONS.filter(
    c => cabinetFilter === 'all' || c.rarity === cabinetFilter
  )
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity))
    .map(c => {
      const qty = state.collection[c.id] || 0;
      return `<article class="collectible ${c.rarity} ${qty ? '' : 'unowned'}" ${qty ? `data-item="${c.id}" tabindex="0" role="button" aria-label="查看${c.name}"` : ''}>${qty > 1 ? `<span class="item-count">× ${qty}</span>` : ''}<div class="item-art" data-thumb="${c.id}">${thumbInner(c.id, c.icon)}</div><span class="item-stars" aria-label="${C.RARITIES[c.rarity].name}">${'★'.repeat(RARITY_STARS[c.rarity])}</span><h3>${qty ? c.name : '？？？'}</h3><p>${qty ? c.text : '还在远方，等待与你相遇。'}</p></article>`;
    })
    .join('');
  // wish page
  const stars = state.resources.stars,
    costLabel = need =>
      stars >= need ? `${icon('sparkles')}${need}` : `还差 ${fmt(Math.ceil(need - stars))} 星砂`;
  $('#wish-balance').textContent = fmt(stars);
  $('#pity-count').textContent = `${state.pity} / 20`;
  $('#pity-segs').innerHTML = Array.from(
    {length: 20},
    (_, i) => `<i class="${i < state.pity ? 'on' : ''}"></i>`
  ).join('');
  $('#pity-label').textContent =
    state.pity >= 19 ? '下一次必得史诗或传说' : `再 ${20 - state.pity} 次内必得史诗或传说`;
  $('#draw-balance').textContent = state.draws ? `已寻宝 ${state.draws} 次` : '';
  $('#draw-one-cost').innerHTML = costLabel(30);
  $('#draw-five-cost').innerHTML = costLabel(150);
  $('#draw-one').disabled = stars < 30 || drawBusy || broken;
  $('#draw-five').disabled = stars < 150 || drawBusy || broken;
  const log = wishLog().slice(0, 20);
  $('#wish-log').innerHTML = log.length
    ? log
        .map(e => {
          const c = C.COLLECTIONS.find(x => x.id === e.id);
          if (!c) return '';
          const when = new Date(e.t).toLocaleString('zh-CN', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          return `<div class="wish-log-row r-${c.rarity}"><span class="wl-art" data-thumb="${c.id}">${thumbInner(c.id, c.icon)}</span><b>${c.name}</b><span class="wl-stars">${'★'.repeat(RARITY_STARS[c.rarity])}</span><time>${when}</time></div>`;
        })
        .join('')
    : `<div class="empty-state">${icon('sparkles')}还没有寻宝记录。<br>攒够 30 星砂，去看看今晚的流星吧。</div>`;
  if ($('#secondary-dialog').open && page === 'collection') hydrateThumbs($('#collection-grid'));
  if ($('#secondary-dialog').open && page === 'wish') hydrateThumbs($('#page-wish'));
}
$('#cabinet-filters').addEventListener('click', e => {
  const b = e.target.closest('[data-filter]');
  if (!b) return;
  cabinetFilter = b.dataset.filter;
  renderCollections();
  icons();
});
function closeViewer() {
  viewToken++;
  try {
    viewer?.dispose?.();
  } catch {}
  viewer = null;
  $('#item-viewer').innerHTML = '';
}
function openItem(id) {
  const c = C.COLLECTIONS.find(x => x.id === id),
    qty = state.collection[id];
  if (!c || !qty) return;
  closeViewer();
  const el = $('#item-viewer'),
    fallback = `<div class="item-fallback ${c.rarity}">${icon(c.icon)}</div>`;
  $('#item-name').textContent = c.name;
  $('#item-meta').textContent = `${C.RARITIES[c.rarity].name} · 已收藏 × ${qty}`;
  $('#item-text').textContent = c.text;
  el.innerHTML = fallback;
  icons();
  $('#item-dialog').showModal();
  if (!items3d?.mountItemViewer) return;
  const token = viewToken;
  try {
    el.innerHTML = '';
    Promise.resolve(items3d.mountItemViewer(el, id)).then(
      v => {
        if (token !== viewToken || !$('#item-dialog').open) {
          try {
            v?.dispose?.();
          } catch {}
        } else viewer = v;
      },
      () => {
        if (token === viewToken) {
          el.innerHTML = fallback;
          icons();
        }
      }
    );
  } catch {
    el.innerHTML = fallback;
    icons();
  }
}
$('#item-dialog').addEventListener('close', closeViewer);
$('#collection-grid').addEventListener('keydown', e => {
  const it = e.target.closest?.('[data-item]');
  if (it && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    openItem(it.dataset.item);
  }
});
document.addEventListener('click', e => {
  const it = e.target.closest('[data-item]');
  if (it) openItem(it.dataset.item);
});
let wishModule = null;
async function search(count) {
  if (drawBusy) return;
  drawBusy = true;
  A.primeAudio();
  renderCollections();
  try {
    // The draw is committed to the save before any animation plays.
    const result = await transact(s =>
      C.draw(s, count, () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296)
    );
    addWishLog(result);
    renderCollections();
    try {
      wishModule ??= await import('../wish.js?v=7');
      await playWishStage(result);
    } catch {
      showResultDialog(result);
    }
    const fresh = result.filter(r => r.isNew).length;
    if (fresh) toast(`奇物柜里多了 ${fresh} 件新奇物！`);
  } finally {
    drawBusy = false;
    renderCollections();
    icons();
  }
}
async function playWishStage(result) {
  const stage = $('#wish-stage');
  stage.showModal();
  try {
    await wishModule.playWish(stage, result, {
      thumb: id => wantThumb(id),
      viewer: items3d?.mountItemViewer
        ? (el, id) => items3d.mountItemViewer(el, id, {pedestal: false, spin: 0.9})
        : null,
      iconHTML: c => `<span class="ws-icon">${window.lucide ? icon(c.icon) : ''}</span>`,
      rarityName: r => C.RARITIES[r].name,
      audio: A.loadPrefs().sound ? A.audioContext() : null,
      reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
    });
  } finally {
    stage.close();
    stage.innerHTML = '';
  }
}
$('#wish-stage').addEventListener('cancel', e => e.preventDefault());
function showResultDialog(result) {
  $('#draw-results').innerHTML = result
    .map(
      c =>
        `<article class="draw-result ${c.rarity}"><span class="dr-art" data-thumb="${c.id}">${thumbInner(c.id, c.icon)}</span><div><span>${C.RARITIES[c.rarity].name} · ${c.isNew ? '首次发现' : '再次相遇'}</span><h3>${c.name}</h3><p>${c.text}</p></div></article>`
    )
    .join('');
  icons();
  hydrateThumbs($('#draw-results'));
  $('#result-dialog').showModal();
}
$('#draw-one').onclick = safe(() => search(1));
$('#draw-five').onclick = safe(() => search(5));
onRender(renderCollections);
