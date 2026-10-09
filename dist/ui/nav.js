// Page navigation: the two swipeable home screens and the secondary pages in a dialog.
import {$, $$, render, safe, setCurrentPage} from './store.js?v=8';
function markScreen(p) {
  setCurrentPage(p);
  $('#home-pages').dataset.screen = p;
  $$('.home-screen').forEach(el => {
    const active = el.id === `page-${p}`;
    el.hidden = !active;
    el.setAttribute('aria-hidden', String(!active));
    if (active) el.scrollTop = 0;
  });
  $$('.screen-dock [data-page]').forEach(b => {
    const active = b.dataset.page === p;
    b.classList.toggle('selected', active);
    if (active) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  if (location.hash !== `#${p}`) history.replaceState(null, '', `#${p}`);
}
export function setPage(p) {
  if (!['village', 'focus', 'buildings', 'journal', 'collection', 'wish'].includes(p)) p = 'village';
  $('#menu-dialog').close();
  if (p === 'village' || p === 'focus') {
    $('#secondary-dialog').close();
    markScreen(p);
    return;
  }
  setCurrentPage(p);
  const titles = {
    buildings: ['建筑管理', '让村庄更丰盛', '建造与升级，让时间带来更多馈赠。'],
    journal: ['学习手记', '认真度过的时间，都在这里。', '不必每一天都完美，回头看看，你已经走了很远。'],
    collection: ['奇物柜', '收集一小片世界的惊奇。', '让每一段专注，成为值得珍藏的回忆。'],
    wish: ['星砂寻宝', '让星光落进你的口袋。', '每次 30 星砂；连续 20 次内必遇史诗或传说。']
  };
  $$('#secondary-dialog .page').forEach(el => {
    el.hidden = el.id !== `page-${p}`;
    el.classList.toggle('active', !el.hidden);
  });
  $('#page-label').textContent = titles[p][0];
  $('#page-title').textContent = titles[p][1];
  $('#page-subtitle').textContent = titles[p][2];
  $('#secondary-dialog').classList.toggle('wish-mode', p === 'wish');
  if (!$('#secondary-dialog').open) $('#secondary-dialog').showModal();
  $('#secondary-dialog').scrollTop = 0;
  render();
}
$('#menu-button').onclick = () => $('#menu-dialog').showModal();
$('#secondary-back').onclick = () => {
  $('#secondary-dialog').close();
  $('#menu-dialog').showModal();
};
// Each gesture selects one complete screen; the two screens never share a scroll position.
const pager = $('#home-pages');
let swipe = null,
  wheelTotal = 0,
  wheelAt = 0,
  switchedAt = 0;
function canScrollScreen(screen, direction) {
  return direction > 0
    ? screen.scrollTop + screen.clientHeight < screen.scrollHeight - 3
    : screen.scrollTop > 3;
}
function switchScreen(direction) {
  const current = pager.dataset.screen || 'village';
  const next = direction > 0 ? 'focus' : 'village';
  if (next === current || Date.now() - switchedAt < 450) return;
  switchedAt = Date.now();
  setPage(next);
}
pager.addEventListener(
  'touchstart',
  e => {
    swipe = null;
    if (document.body.classList.contains('build-mode')) return;
    if (e.touches.length !== 1 || e.target.closest('input,textarea,select')) return;
    const t = e.touches[0];
    swipe = {
      x: t.clientX,
      y: t.clientY,
      dx: 0,
      dy: 0,
      axis: null,
      screen: e.target.closest('.home-screen'),
      switching: false
    };
  },
  {passive: true}
);
pager.addEventListener(
  'touchmove',
  e => {
    if (!swipe || e.touches.length !== 1) {
      swipe = null;
      return;
    }
    swipe.dx = e.touches[0].clientX - swipe.x;
    swipe.dy = e.touches[0].clientY - swipe.y;
    if (!swipe.axis && Math.max(Math.abs(swipe.dx), Math.abs(swipe.dy)) > 8)
      swipe.axis = Math.abs(swipe.dy) > Math.abs(swipe.dx) * 1.2 ? 'vertical' : 'horizontal';
    if (swipe.axis !== 'vertical' || !swipe.screen) return;
    const direction = swipe.dy < 0 ? 1 : -1;
    if (!canScrollScreen(swipe.screen, direction)) {
      if (e.cancelable) e.preventDefault();
      swipe.switching = true;
    }
  },
  {passive: false}
);
pager.addEventListener(
  'touchend',
  e => {
    const gesture = swipe;
    swipe = null;
    if (!gesture || !gesture.switching || gesture.axis !== 'vertical' || Math.abs(gesture.dy) < 42) return;
    if (e.cancelable) e.preventDefault();
    switchScreen(gesture.dy < 0 ? 1 : -1);
  },
  {passive: false}
);
pager.addEventListener(
  'touchcancel',
  () => {
    swipe = null;
  },
  {passive: true}
);
pager.addEventListener(
  'wheel',
  e => {
    if (
      document.body.classList.contains('build-mode') ||
      e.defaultPrevented ||
      e.ctrlKey ||
      Math.abs(e.deltaX) > Math.abs(e.deltaY) ||
      e.target.closest('input,textarea,select')
    )
      return;
    const screen = e.target.closest('.home-screen');
    if (!screen || canScrollScreen(screen, Math.sign(e.deltaY))) return;
    e.preventDefault();
    const now = Date.now(),
      delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? screen.clientHeight : 1);
    if (now - wheelAt > 220 || Math.sign(wheelTotal) !== Math.sign(delta)) wheelTotal = 0;
    wheelAt = now;
    wheelTotal += delta;
    if (Math.abs(wheelTotal) > 45) {
      switchScreen(Math.sign(wheelTotal));
      wheelTotal = 0;
    }
  },
  {passive: false}
);
document.addEventListener(
  'click',
  safe(e => {
    const nav = e.target.closest('[data-page]');
    if (nav) setPage(nav.dataset.page);
    const close = e.target.closest('[data-close]');
    if (close) document.getElementById(close.dataset.close).close();
  })
);
window.addEventListener('hashchange', () => setPage(location.hash.slice(1)));
