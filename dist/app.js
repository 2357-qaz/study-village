import * as C from './core.js?v=4';
const KEY = 'timegrove-save-v1',
  BACKUP = KEY + '-previous',
  V1BAK = 'timegrove-save-v1-backup-before-v2';
const $ = s => document.querySelector(s),
  $$ = s => [...document.querySelectorAll(s)],
  icon = name => `<i data-lucide="${name}"></i>`;
const esc = s =>
  String(s).replace(
    /[&<>"']/g,
    c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]
  );
let state = C.initialState(),
  mode = 'study',
  minutes = 25,
  page = 'village',
  village = null,
  drawBusy = false,
  historyLimit = 30,
  broken = false,
  toastTimeout,
  readyNotified = false;
function icons() {
  window.lucide?.createIcons();
}
function storageWarning(msg) {
  $('#storage-alert').hidden = false;
  $('#storage-alert').textContent = msg;
  $('#save-state').textContent = '存档需要处理';
}
// v1 saves are migrated in memory by validateState; the raw v1 text is kept once before the first v2 write.
function parseSave(text) {
  const raw = JSON.parse(text),
    next = C.validateState(raw);
  if (raw && raw.version === 1 && localStorage.getItem(V1BAK) === null) localStorage.setItem(V1BAK, text);
  return next;
}
try {
  const saved = localStorage.getItem(KEY);
  if (saved) {
    const old = JSON.parse(saved).version === 1;
    state = parseSave(saved);
    if (old) localStorage.setItem(KEY, JSON.stringify(state));
  } else localStorage.setItem(KEY, JSON.stringify(state));
} catch (e) {
  broken = true;
  storageWarning(
    '无法读取或保存此设备的存档。请先导出备份或导入有效存档；当前操作已暂停，避免覆盖原有进度。'
  );
}
function toast(msg) {
  $('#toast').textContent = msg;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 4500);
}
async function transact(fn) {
  const task = () => {
    if (broken) throw Error('请先在「存档与规则」中导入有效存档');
    const saved = localStorage.getItem(KEY);
    const next = saved ? parseSave(saved) : C.initialState();
    const result = fn(next);
    C.accrue(next);
    localStorage.setItem(KEY, JSON.stringify(next));
    state = next;
    render();
    return result;
  };
  try {
    return await (navigator.locks?.request
      ? navigator.locks.request(KEY, task)
      : Promise.resolve().then(task));
  } catch (e) {
    toast(e.message || '操作未完成，进度没有改变');
    throw e;
  }
}
function safe(fn) {
  return (...args) => {
    try {
      return Promise.resolve(fn(...args)).catch(() => {});
    } catch {
      return undefined;
    }
  };
}
const fmt = n => Math.floor(n).toLocaleString('zh-CN');
function duration(s) {
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分钟` : `${m} 分钟`;
}
function latest() {
  return state.sessions.filter(x => x.kind === 'study').sort((a, b) => b.endedAt - a.endedAt)[0];
}
function rewardText(r) {
  return Object.entries(r)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `+${Number(v.toFixed(1))} ${C.RESOURCES[k].name}`)
    .join(' · ');
}
function weekData() {
  const start = C.weekStart(),
    days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const end = new Date(d);
    end.setDate(end.getDate() + 1);
    days.push({start: +d, seconds: C.secondsBetween(state, +d, +end)});
  }
  return days;
}
function markScreen(p) {
  page = p;
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
function setPage(p) {
  if (!['village', 'focus', 'buildings', 'journal', 'collection'].includes(p)) p = 'village';
  $('#menu-dialog').close();
  if (p === 'village' || p === 'focus') {
    $('#secondary-dialog').close();
    markScreen(p);
    return;
  }
  page = p;
  const titles = {
    buildings: ['建筑管理', '让村庄更丰盛', '建造与升级，让时间带来更多馈赠。'],
    journal: ['学习手记', '认真度过的时间，都在这里。', '不必每一天都完美，回头看看，你已经走了很远。'],
    collection: ['奇物收藏', '收集一小片世界的惊奇。', '让每一段专注，成为值得珍藏的回忆。']
  };
  $$('#secondary-dialog .page').forEach(el => {
    el.hidden = el.id !== `page-${p}`;
    el.classList.toggle('active', !el.hidden);
  });
  $('#page-label').textContent = titles[p][0];
  $('#page-title').textContent = titles[p][1];
  $('#page-subtitle').textContent = titles[p][2];
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

function renderStats() {
  const days = weekData(),
    week = days.reduce((n, d) => n + d.seconds, 0),
    m = Math.floor(week / 60),
    pop = C.population(state);
  $('#weekly-total').innerHTML =
    `${Math.floor(m / 60)} <small>小时</small> ${String(m % 60).padStart(2, '0')} <small>分</small>`;
  $('#population').innerHTML = `${pop} <small>位</small>`;
  $('#population-caption').textContent =
    `再学习 ${Math.ceil((3600 - (C.studySeconds(state) % 3600)) / 60)} 分钟，迎来新邻居`;
  const built = Object.values(state.buildings).filter(Boolean).length;
  $('#village-progress').textContent = `${built} 座建筑 · ${pop} 位居民`;
  $('#village-level').textContent = pop >= 20 ? '繁盛小镇' : pop >= 8 ? '成长村落' : '初生聚落';
  const max = Math.max(3600, ...days.map(x => x.seconds));
  $('#mini-bars').innerHTML = days
    .map(x => `<span style="height:${Math.max(12, (x.seconds / max) * 100)}%"></span>`)
    .join('');
  $('#resources').innerHTML = Object.entries(C.RESOURCES)
    .map(
      ([k, r]) =>
        `<div class="resource-item">${icon(r.icon)}<span>${r.name}</span><strong>${fmt(state.resources[k])}</strong></div>`
    )
    .join('');
  const last = latest();
  if (last) {
    $('#last-caption').textContent = `上次：${last.topic}`;
  } else {
    $('#last-caption').textContent = '第一段专注，正等着你';
  }
  updateLast();
  $('#week-caption').textContent = week
    ? `本周 ${state.sessions.filter(x => x.kind === 'study' && x.endedAt >= C.weekStart()).length} 次学习打卡`
    : '从本周一开始，慢慢积累';
}
function updateLast() {
  const l = latest();
  if (!l) {
    $('#last-study').textContent = '尚未开始';
    return;
  }
  const diff = Math.max(0, Date.now() - l.endedAt),
    m = Math.floor(diff / 60000);
  $('#last-study').textContent =
    m < 1
      ? '刚刚'
      : m < 60
        ? `${m} 分钟`
        : m < 1440
          ? `${Math.floor(m / 60)} 小时 ${m % 60} 分`
          : `${Math.floor(m / 1440)} 天 ${Math.floor((m % 1440) / 60)} 小时`;
}
function renderProduction() {
  const projected = structuredClone(state);
  C.accrue(projected);
  const total = Object.values(projected.pending).reduce((a, b) => a + b, 0);
  $('#harvest-label').textContent = total >= 1 ? `领取产出 · ${fmt(total)}` : '正在积攒';
  $('#harvest-button').disabled = total < 1 || broken;
  $('#production-caption').textContent = Object.entries(C.rates(state))
    .filter(([, v]) => v)
    .map(([k, v]) => `${C.RESOURCES[k].name} +${v}/h`)
    .join(' · ');
}
function renderTimer() {
  const t = state.timer;
  if (t) {
    mode = t.kind;
    minutes = Math.ceil(t.goal / 60);
  }
  $$('[data-mode]').forEach(b => {
    b.classList.toggle('selected', b.dataset.mode === mode);
    b.setAttribute('aria-selected', String(b.dataset.mode === mode));
    b.disabled = !!t;
  });
  $('#durations').innerHTML = (mode === 'study' ? [25, 45, 60] : [5, 10, 15])
    .map(
      m =>
        `<button data-minutes="${m}" class="${minutes === m ? 'selected' : ''}" ${t ? 'disabled' : ''}>${m} 分钟</button>`
    )
    .join('');
  $('#topic').disabled = !!t || mode === 'rest';
  if (t) $('#topic').value = t.topic;
  $('#topic').placeholder = mode === 'rest' ? '放下屏幕，喝口水，看看远处' : '这次想学点什么？';
  $('#start-button').hidden = !!t;
  $('#timer-actions').hidden = !t;
  $('#manual-button').hidden = !!t;
  $('#cancel-timer').hidden = !t;
  $('#start-button span').textContent = mode === 'study' ? '开始专注' : '开始休息';
  $('#focus-reward').innerHTML =
    mode === 'study'
      ? `预计获得 <span>木材 +${minutes * 2}</span>石料 +${minutes}`
      : `可奖励休息 ${Math.floor(C.restCredit(state) / 60)} 分钟 · 每分钟 +2 补给`;
  $('#timer-kicker').textContent = mode === 'study' ? '下一块砖，从此刻开始' : '休息，也是生长的一部分';
  updateTimer();
}
function updateTimer() {
  const t = state.timer,
    goal = t ? t.goal : minutes * 60,
    elapsed = t ? C.timerElapsed(t) : 0,
    remain = Math.max(0, Math.ceil(goal - elapsed));
  $('#timer-display').textContent =
    `${String(Math.floor(remain / 60)).padStart(2, '0')}:${String(remain % 60).padStart(2, '0')}`;
  $('#timer-ring').style.setProperty('--progress', `${(elapsed / goal) * 100}%`);
  $('#focus-status').textContent = t
    ? remain === 0
      ? '等待打卡'
      : t.runningSince === null
        ? '已暂停'
        : mode === 'study'
          ? '专注进行中'
          : '正在休息'
    : '准备出发';
  $('#timer-note').textContent = t
    ? remain === 0
      ? '辛苦了，领取你的奖励吧'
      : t.runningSince === null
        ? '随时可以继续'
        : '时间正化作村庄的一部分'
    : '一小步，也算数。';
  $('#pause-button').textContent = t?.runningSince === null ? '继续' : '暂停';
  $('#pause-button').disabled = remain === 0;
  $('#finish-button').disabled = elapsed < 60;
  $('#start-button').disabled = broken || (mode === 'rest' && C.restCredit(state) < 60);
  if (t && remain === 0 && !readyNotified) {
    readyNotified = true;
    toast(mode === 'study' ? '这一段专注完成了，记得打卡领取奖励。' : '休息结束，欢迎回来。');
  }
  if (!t) readyNotified = false;
}
function renderBuildings() {
  const pop = C.population(state);
  $('#buildings').innerHTML = C.BUILDINGS.map(b => {
    const level = state.buildings[b.id] | 0,
      cost = C.costFor(state, b.id),
      lock = !level && pop < b.pop,
      can = Object.entries(cost).every(([k, v]) => state.resources[k] >= v),
      place = !level && buildOK();
    return `<article class="building-card ${!level ? 'locked' : ''}" id="building-${b.id}"><div class="building-top"><span class="building-icon" style="color:${b.color}">${icon(b.icon)}</span><span class="level-badge">${level ? `Lv.${level}` : '待建造'}</span></div><h3>${b.name}</h3><p class="production">${C.RESOURCES[b.resource].name} +${b.rate * Math.max(1, level)}/小时${!level ? ' · 建成后' : ''}</p><p class="production">占地 ${b.size}×${b.size}${b.coastal ? ' · 需临海' : ''}${!level && b.pop ? ` · 需 ${b.pop} 位居民` : ''}</p>${lock ? `<p class="lock-note">${icon('lock')}还需 ${b.pop - pop} 位居民</p>` : ''}<div class="cost">${
      level === 5
        ? '已达最高等级'
        : Object.entries(cost)
            .map(([k, v]) => `<span title="${C.RESOURCES[k].name}">${icon(C.RESOURCES[k].icon)}${v}</span>`)
            .join('')
    }</div><button ${place ? `data-place="${b.id}"` : `data-upgrade="${b.id}"`} class="${level ? 'secondary-button' : 'primary-button'}" ${level === 5 || !can || lock || broken ? 'disabled' : ''}>${level === 5 ? '已满级' : level ? `升级 · Lv.${level + 1}` : place ? '选择位置建造' : '建造设施'} ${level < 5 ? icon(place ? 'map-pin' : 'plus') : ''}</button></article>`;
  }).join('');
}
function sessionHTML(x) {
  return `<div class="session-row"><span class="session-icon">${icon(x.kind === 'study' ? 'book-open' : 'coffee')}</span><div><div class="session-topic">${esc(x.kind === 'study' ? x.topic : '好好休息')}</div><div class="session-meta">${new Date(x.endedAt).toLocaleString('zh-CN', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'})} · ${x.manual ? '补记学习' : x.kind === 'study' ? '专注打卡' : '休息打卡'}</div></div><span class="session-duration">${duration(x.seconds)}</span></div>`;
}
function renderJournal() {
  const sessions = [...state.sessions].sort((a, b) => b.endedAt - a.endedAt),
    empty = `<div class="empty-state">${icon('notebook-pen')}这里还没有足迹。<br>开始第一段专注，写下村庄的第一章。</div>`;
  $('#recent-sessions').innerHTML = sessions.slice(0, 2).map(sessionHTML).join('') || empty;
  $('#all-sessions').innerHTML = sessions.slice(0, historyLimit).map(sessionHTML).join('') || empty;
  $('#load-more').hidden = sessions.length <= historyLimit;
  $('#lifetime-hours').textContent = duration(C.studySeconds(state));
  $('#session-count').textContent = `${sessions.filter(x => x.kind === 'study').length} 次`;
  const days = weekData(),
    max = Math.max(3600, ...days.map(x => x.seconds));
  $('#journal-week').textContent = duration(days.reduce((n, d) => n + d.seconds, 0));
  $('#weekly-chart').innerHTML = days
    .map(
      (d, i) =>
        `<div class="chart-column ${new Date(d.start).toDateString() === new Date().toDateString() ? 'today' : ''}"><span class="chart-value">${Math.floor(d.seconds / 60)} 分</span><div class="chart-bar" style="height:${Math.max(2, (d.seconds / max) * 155)}px"></div><span>周${'一二三四五六日'[i]}</span></div>`
    )
    .join('');
}
function renderCollections() {
  const count = Object.keys(state.collection).length;
  $('#collection-count').textContent = count;
  $('#cabinet-count').textContent = `${count} / ${C.COLLECTIONS.length}`;
  $('#collection-grid').innerHTML = C.COLLECTIONS.map(c => {
    const qty = state.collection[c.id] || 0;
    return `<article class="collectible ${c.rarity} ${qty ? '' : 'unowned'}" ${qty ? `data-item="${c.id}" tabindex="0" role="button" aria-label="查看${c.name}"` : ''}>${qty ? `<span class="item-count">× ${qty}</span>` : ''}<div class="item-art" ${qty ? `data-thumb="${c.id}"` : ''}>${qty ? thumbInner(c.id, c.icon) : icon(c.icon)}</div><h3>${c.name}</h3><p>${qty ? c.text : '还在远方，等待与你相遇。'}</p><span class="rarity">${C.RARITIES[c.rarity].name} · ${qty ? '已收藏' : '未发现'}</span></article>`;
  }).join('');
  if ($('#secondary-dialog').open && page === 'collection') hydrateThumbs($('#collection-grid'));
  $('#draw-balance').textContent = `拥有 ${fmt(state.resources.stars)} 星砂 · 已寻找 ${state.draws} 次`;
  $('#pity-label').textContent = `再 ${20 - state.pity} 次内必得史诗或传说`;
  $('#draw-one').disabled = state.resources.stars < 30 || drawBusy || broken;
  $('#draw-five').disabled = state.resources.stars < 150 || drawBusy || broken;
}
// Collectible 3D thumbnails: icons render first, then swap to cached PNGs; any failure silently keeps the icon.
let items3d = null,
  viewer = null,
  viewToken = 0;
const thumbCache = new Map(),
  thumbPending = new Map(),
  thumbFail = new Set();
const thumbInner = (id, ic) =>
  thumbCache.has(id) ? `<img src="${thumbCache.get(id)}" alt="" decoding="async">` : icon(ic);
function wantThumb(id) {
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
function hydrateThumbs(root = document) {
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
function render() {
  renderStats();
  renderProduction();
  renderTimer();
  renderBuildings();
  renderJournal();
  renderCollections();
  if (inBuild()) renderBuild();
  icons();
  village?.update(state);
}
function localDateTime(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function openManual() {
  $('#manual-error').textContent = '';
  const end = $('#manual-form input[name=end]');
  end.value = localDateTime(Date.now());
  end.max = end.value;
  end.min = localDateTime(Date.now() - 365 * 24 * C.HOUR);
  $('#manual-dialog').showModal();
}
function confirmAction(title, text) {
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = text;
  $('#confirm-dialog').showModal();
  return new Promise(resolve => {
    const dlg = $('#confirm-dialog');
    $('#confirm-yes').onclick = () => {
      dlg.close('yes');
    };
    $('#confirm-no').onclick = () => dlg.close('no');
    dlg.onclose = () => resolve(dlg.returnValue === 'yes');
    dlg.oncancel = () => {
      dlg.returnValue = 'no';
    };
  });
}
document.addEventListener(
  'click',
  safe(async e => {
    const nav = e.target.closest('[data-page]');
    if (nav) setPage(nav.dataset.page);
    const close = e.target.closest('[data-close]');
    if (close) document.getElementById(close.dataset.close).close();
    const d = e.target.closest('[data-minutes]');
    if (d && !state.timer) {
      minutes = Number(d.dataset.minutes);
      renderTimer();
    }
    const m = e.target.closest('[data-mode]');
    if (m && !state.timer) {
      mode = m.dataset.mode;
      minutes = mode === 'study' ? 25 : 5;
      renderTimer();
    }
    const it = e.target.closest('[data-item]');
    if (it) openItem(it.dataset.item);
    const pl = e.target.closest('[data-place]');
    if (pl && buildOK()) {
      enterBuild(pl.dataset.place);
      return;
    }
    const up = e.target.closest('[data-upgrade]');
    if (up) {
      const id = up.dataset.upgrade;
      const level = await transact(s => C.upgrade(s, id));
      toast(
        `${C.BUILDINGS.find(b => b.id === id).name} ${level === 1 ? '建成了！' : `升到了 Lv.${level}！`}`
      );
    }
  })
);
$('#start-button').onclick = safe(async () => {
  await transact(s => C.startTimer(s, mode, minutes, $('#topic').value));
  toast(mode === 'study' ? '村庄等你回来。安心专注吧。' : '伸个懒腰，给自己一点空白。');
});
$('#pause-button').onclick = safe(() =>
  transact(s => (s.timer?.runningSince === null ? C.resumeTimer(s) : C.pauseTimer(s)))
);
$('#finish-button').onclick = safe(async () => {
  const before = C.population(state);
  const r = await transact(s => C.finishTimer(s));
  toast(`打卡成功！${rewardText(r)}${C.population(state) > before ? ' · 新居民搬来了！' : ''}`);
});
$('#cancel-timer').onclick = safe(async () => {
  if (await confirmAction('放弃本次计时？', '尚未打卡的时间不会计入学习，也不会获得奖励。'))
    await transact(s => {
      s.timer = null;
    });
});
$('#harvest-button').onclick = safe(async () => {
  const r = await transact(s => C.collect(s));
  toast(`收获啦！${rewardText(r)}`);
});
$('#manual-button').onclick = openManual;
$('#journal-manual').onclick = openManual;
$('#manual-form').onsubmit = async e => {
  e.preventDefault();
  const data = new FormData(e.target);
  try {
    const r = await transact(s =>
      C.manualStudy(s, Number(data.get('minutes')), +new Date(data.get('end')), data.get('topic'))
    );
    $('#manual-dialog').close();
    toast(`学习已记下！${rewardText(r)}`);
  } catch (error) {
    $('#manual-error').textContent = error.message;
  }
};
$('#settings-button').onclick = $('#rules-button').onclick = () => {
  $('#menu-dialog').close();
  $('#settings-dialog').showModal();
};
function exportFile(text, name) {
  const a = document.createElement('a'),
    url = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#export-save').onclick = () => {
  try {
    const text = localStorage.getItem(KEY) || JSON.stringify(state);
    exportFile(text, `timegrove-${new Date().toISOString().slice(0, 10)}.json`);
    toast('存档已导出，记得妥善保存。');
  } catch {
    toast('无法读取本机存档，请检查浏览器存储设置。');
  }
};
$('#import-save').onclick = () => $('#import-file').click();
$('#import-file').onchange = safe(async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    toast('存档文件过大，请使用 10 MB 以内的 JSON 存档');
    return;
  }
  let imported;
  try {
    imported = C.validateState(JSON.parse(await file.text()));
  } catch (error) {
    toast(error.message);
    return;
  }
  if (
    !(await confirmAction(
      '导入并替换当前村庄？',
      `存档包含 ${duration(C.studySeconds(imported))} 学习、${C.population(imported)} 位居民。建议先导出当前存档；替换后无法合并两个村庄。`
    ))
  )
    return;
  const work = () => {
    const old = localStorage.getItem(KEY);
    if (old) localStorage.setItem(BACKUP, old);
    localStorage.setItem(KEY, JSON.stringify(imported));
    state = imported;
    broken = false;
    $('#storage-alert').hidden = true;
    $('#save-state').textContent = '进度自动保存在此设备';
    render();
  };
  try {
    await (navigator.locks?.request ? navigator.locks.request(KEY, work) : Promise.resolve().then(work));
    toast('村庄已经搬过来了。欢迎回家。');
  } catch {
    toast('存档未能保存，请检查浏览器存储空间。');
  }
});
async function search(count) {
  if (drawBusy) return;
  drawBusy = true;
  renderCollections();
  try {
    const result = await transact(s =>
      C.draw(s, count, () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296)
    );
    $('#draw-results').innerHTML = result
      .map(
        c =>
          `<article class="draw-result ${c.rarity}"><span class="dr-art" data-thumb="${c.id}">${thumbInner(c.id, c.icon)}</span><div><span>${C.RARITIES[c.rarity].name} · ${c.isNew ? '首次发现' : '再次相遇'}</span><h3>${c.name}</h3><p>${c.text}</p></div></article>`
      )
      .join('');
    icons();
    hydrateThumbs($('#draw-results'));
    $('#result-dialog').showModal();
  } finally {
    drawBusy = false;
    renderCollections();
    icons();
  }
}
$('#draw-one').onclick = safe(() => search(1));
$('#draw-five').onclick = safe(() => search(5));
$('#load-more').onclick = () => {
  historyLimit += 30;
  renderJournal();
  icons();
};
window.addEventListener('storage', e => {
  if (e.key === KEY && e.newValue) {
    try {
      state = C.validateState(JSON.parse(e.newValue));
      render();
    } catch {
      storageWarning('其他标签页的存档无法读取，请导出备份后检查。');
    }
  }
});
window.addEventListener('hashchange', () => setPage(location.hash.slice(1)));
window.addEventListener('focus', () => {
  try {
    const text = localStorage.getItem(KEY);
    if (text) {
      state = C.validateState(JSON.parse(text));
      render();
    }
  } catch {}
});
$('#date-label').textContent = new Date().toLocaleDateString('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long'
});
// ---- Build mode (建造模式) ----
const inBuild = () => document.body.classList.contains('build-mode');
const buildOK = () => !!village && typeof village.setBuildMode === 'function';
const decorDefs = () =>
  Array.isArray(C.DECOR) ? C.DECOR : Object.entries(C.DECOR).map(([id, v]) => ({id, ...v}));
const decorDef = t => decorDefs().find(d => d.id === t);
const bdef = id => C.BUILDINGS.find(b => b.id === id);
const canAfford = c => Object.entries(c || {}).every(([k, v]) => state.resources[k] >= v);
const costChips = c =>
  Object.entries(c || {})
    .map(
      ([k, v]) =>
        `<span class="${state.resources[k] >= v ? '' : 'lack'}" title="${C.RESOURCES[k].name}">${icon(C.RESOURCES[k].icon)}${v}</span>`
    )
    .join('') || '<span>免费</span>';
let bm = {tab: 'manage', tool: null, ghost: null, sel: null, pick: false, busy: false};
const TERRAIN_INFO = {
  reclaim: '海岸外一格填成沙滩（不含最外圈）',
  g: '换成草地，免费',
  s: '换成沙滩，免费',
  f: '换成花甸',
  r: '换成岩地',
  p: '铺成石径',
  w: '挖成池塘，可架木桥，免费',
  raise: '抬升一级（最高 3 级），费用随高度增加',
  lower: '降低一级，免费',
  sea: '平地沉回大海，免费'
};
const TERRAIN_COST = {f: {food: 2}, r: {stone: 2}, p: {stone: 3}};
const baseLand = (() => {
  try {
    return [...C.defaultIsland().terrain].filter(c => c !== '.').length;
  } catch {
    return 0;
  }
})();
function reclaimCost() {
  const n = Math.max(0, C.landCount(state) - baseLand);
  return {stone: 6 + Math.floor(n / 12), wood: 4 + Math.floor(n / 20), food: 2 + Math.floor(n / 30)};
}
function buildEntryState() {
  const ok = buildOK(),
    msg = ok
      ? '进入建造模式'
      : village
        ? '当前 3D 场景尚不支持自由建造'
        : '当前设备无法显示 3D 场景，无法使用自由建造';
  ['#build-button', '#free-build-button'].forEach(id => {
    const b = $(id);
    b.disabled = !ok;
    b.title = msg;
  });
}
function objInfo(key) {
  if (!key) return null;
  const id = key.slice(2);
  if (key[0] === 'b') {
    const b = bdef(id);
    return b && state.buildings[id]
      ? {kind: 'building', id, def: b, name: b.name, level: state.buildings[id], r: state.layout?.[id]?.r | 0}
      : null;
  }
  const d = state.decor.find(x => x.id === id);
  return d ? {kind: 'decor', id, d, name: decorDef(d.type)?.name || d.type, r: d.r | 0} : null;
}
function toolName(t) {
  if (t.kind === 'building') return bdef(t.id).name;
  if (t.kind === 'decor') return decorDef(t.type)?.name || t.type;
  if (t.kind === 'move') return `移动${objInfo(t.key)?.name || ''}`;
  return '';
}
function applyTool(t) {
  bm.tool = t;
  bm.ghost = null;
  village.setGhost(null);
  village.setTool(t);
}
function selectObj(key) {
  bm.sel = key;
  village.setSelection(key);
}
function setTab(tab) {
  bm.tab = tab;
  bm.pick = false;
  applyTool(null);
  if (tab !== 'manage') selectObj(null);
  renderBuild();
}
function ghostAt(x, z) {
  const t = bm.tool;
  if (!t || t.kind === 'terrain') return;
  let r,
    cost = null,
    pop = null;
  if (t.kind === 'building') {
    const b = bdef(t.id);
    r = C.canPlace(state, 'building', t.id, x, z, null);
    cost = C.costFor(state, t.id);
    pop = b.pop;
  } else if (t.kind === 'decor') {
    r = C.canPlace(state, 'decor', t.type, x, z, null, t.item);
    cost = decorDef(t.type)?.cost;
  } else {
    const o = objInfo(t.key);
    if (!o) {
      applyTool(null);
      return;
    }
    r =
      o.kind === 'building'
        ? C.canPlace(state, 'building', o.id, x, z, t.key)
        : C.canPlace(state, 'decor', o.d.type, x, z, t.key, o.d.item);
  }
  let ok = !!r.ok,
    reason = r.reason || '这里不能放置';
  if (ok && pop !== null && C.population(state) < pop) {
    ok = false;
    reason = `需要 ${pop} 位居民`;
  } else if (ok && cost && !canAfford(cost)) {
    ok = false;
    reason = '资源不足';
  }
  bm.ghost = {x, z, valid: ok, reason};
  village.setGhost({x, z, valid: ok});
  renderAction();
  renderHint();
}
function onTile(info) {
  if (!inBuild() || !info || bm.busy) return;
  const t = bm.tool;
  if (!t) {
    selectObj(info.key || null);
    renderBuild();
    return;
  }
  if (t.kind === 'terrain') {
    transact(s => C.editTerrain(s, t.tool, info.x, info.z)).catch(() => {});
    return;
  }
  ghostAt(info.x, info.z);
}
function enterBuild(pick) {
  if (!buildOK()) {
    toast('当前设备无法显示 3D 场景，无法使用自由建造');
    return;
  }
  if (inBuild()) return;
  setPage('village');
  $('#menu-dialog').close();
  bm = {tab: pick ? 'building' : 'manage', tool: null, ghost: null, sel: null, pick: false, busy: false};
  document.body.classList.add('build-mode');
  $('#build-hud').hidden = false;
  $('#build-hud').classList.remove('folded');
  village.setBuildMode(true);
  village.onTile = onTile;
  renderBuild();
  if (pick) pickBuilding(pick);
}
function exitBuild() {
  if (!inBuild()) return;
  document.body.classList.remove('build-mode');
  $('#build-hud').hidden = true;
  try {
    village.setBuildMode(false);
    village.setTool(null);
    village.setGhost(null);
    village.setSelection(null);
  } catch {}
  bm = {tab: 'manage', tool: null, ghost: null, sel: null, pick: false, busy: false};
}
function pickBuilding(id) {
  const b = bdef(id),
    lv = state.buildings[id] | 0;
  if (lv) return;
  if (C.population(state) < b.pop) {
    toast(`需要 ${b.pop} 位居民`);
    return;
  }
  if (!canAfford(C.costFor(state, id))) {
    toast('资源不足');
    return;
  }
  bm.tab = 'building';
  selectObj(null);
  applyTool({kind: 'building', id, r: 0});
  renderBuild();
}
function pickDecor(type) {
  const d = decorDef(type);
  if (!canAfford(d.cost)) {
    toast('资源不足');
    return;
  }
  if (type === 'display') {
    if (!C.COLLECTIONS.some(c => state.collection[c.id])) {
      toast('还没有收藏品可以展示，先去寻找奇物吧');
      return;
    }
    applyTool(null);
    bm.pick = true;
    renderBuild();
    return;
  }
  applyTool({kind: 'decor', type, r: 0});
  renderBuild();
}
async function doUpgrade(id) {
  try {
    const level = await transact(s => C.upgrade(s, id));
    toast(`${bdef(id).name} 升到了 Lv.${level}！`);
  } catch {}
}
async function confirmPlace() {
  const t = bm.tool,
    g = bm.ghost;
  if (!t || !g?.valid || bm.busy) return;
  bm.busy = true;
  try {
    if (t.kind === 'building') {
      await transact(s => {
        C.placeBuilding(s, t.id, g.x, g.z, t.r);
        if (s.layout[t.id]) s.layout[t.id].r = t.r;
      });
      toast(`${bdef(t.id).name} 建成了！`);
      bm.tab = 'manage';
      applyTool(null);
      selectObj('b:' + t.id);
    } else if (t.kind === 'decor') {
      await transact(s => C.placeDecor(s, t.type, g.x, g.z, t.r, t.item));
      toast(`${decorDef(t.type).name} 已放置`);
      bm.ghost = null;
      village.setGhost(null);
    } else if (t.kind === 'move') {
      const o = objInfo(t.key);
      if (o.kind === 'building')
        await transact(s => {
          C.placeBuilding(s, o.id, g.x, g.z, t.r);
          if (s.layout[o.id]) s.layout[o.id].r = t.r;
        });
      else
        await transact(s => {
          C.moveDecor(s, o.id, g.x, g.z);
          const d = s.decor.find(x => x.id === o.id);
          for (let n = (((t.r - d.r) % 4) + 4) % 4; n > 0; n--) C.rotateDecor(s, o.id);
        });
      toast(`${o.name} 已移动`);
      applyTool(null);
    }
  } catch {
  } finally {
    bm.busy = false;
    renderBuild();
  }
}
async function buildAction(act, id) {
  const t = bm.tool;
  switch (act) {
    case 'tab':
      return setTab(id);
    case 'pick-building':
      return pickBuilding(id);
    case 'pick-decor':
      return pickDecor(id);
    case 'pick-item':
      applyTool({kind: 'decor', type: 'display', r: 0, item: id});
      bm.pick = false;
      return renderBuild();
    case 'pick-back':
      bm.pick = false;
      return renderBuild();
    case 'pick-terrain':
      applyTool({kind: 'terrain', tool: id});
      return renderBuild();
    case 'select':
      selectObj(id);
      return renderBuild();
    case 'upgrade':
      return doUpgrade(id);
    case 'rotate':
      if (!t || t.kind === 'terrain') return;
      bm.tool = {...t, r: (t.r + 1) % 4};
      village.setTool(bm.tool);
      if (bm.ghost) village.setGhost({x: bm.ghost.x, z: bm.ghost.z, valid: bm.ghost.valid});
      return renderAction();
    case 'confirm':
      return confirmPlace();
    case 'cancel':
      bm.pick = false;
      applyTool(null);
      return renderBuild();
    case 'move': {
      const o = objInfo(bm.sel);
      if (!o) return;
      applyTool({kind: 'move', key: bm.sel, r: o.r});
      const pos = o.kind === 'building' ? state.layout[o.id] : o.d;
      ghostAt(pos.x, pos.z);
      return renderBuild();
    }
    case 'rotsel': {
      const o = objInfo(bm.sel);
      if (!o) return;
      return void transact(s =>
        o.kind === 'building' ? C.rotateBuilding(s, o.id) : C.rotateDecor(s, o.id)
      ).catch(() => {});
    }
    case 'upgradesel': {
      const o = objInfo(bm.sel);
      if (o) return doUpgrade(o.id);
      return;
    }
    case 'detail': {
      const o = objInfo(bm.sel);
      if (!o || o.kind !== 'building') return;
      setPage('buildings');
      const card = document.getElementById(`building-${o.id}`);
      card?.classList.add('flash');
      card?.scrollIntoView({block: 'center'});
      setTimeout(() => card?.classList.remove('flash'), 3500);
      return;
    }
    case 'remove': {
      const o = objInfo(bm.sel);
      if (!o || o.kind !== 'decor') return;
      if (!(await confirmAction(`拆除${o.name}？`, '拆除不返还资源，此操作无法撤销。'))) return;
      try {
        await transact(s => C.removeDecor(s, o.id));
        toast(`${o.name} 已拆除`);
        selectObj(null);
      } catch {}
      return renderBuild();
    }
  }
}
function renderBuildTop() {
  $('#bh-res').innerHTML =
    Object.entries(C.RESOURCES)
      .map(([k, r]) => `<span title="${r.name}">${icon(r.icon)}${fmt(state.resources[k])}</span>`)
      .join('') + `<span title="居民">${icon('users-round')}${C.population(state)}</span>`;
}
function renderHint() {
  const t = bm.tool;
  let h;
  if (!t) {
    const o = objInfo(bm.sel);
    h = o
      ? `已选中 ${o.name}${o.kind === 'building' ? ` · Lv.${o.level}` : ''}`
      : bm.tab === 'manage'
        ? '点击岛上的建筑或装饰进行整理'
        : bm.tab === 'building'
          ? '选择一座建筑，再点击岛上空地放置'
          : bm.tab === 'decor'
            ? '选择装饰，可连续放置多个'
            : '选择一种地貌工具，再点击地块';
  } else if (t.kind === 'terrain') {
    const tool = C.TERRAIN_TOOLS.find(x => x.id === t.tool);
    h = `${tool?.name || ''}：点击地块应用 · ${TERRAIN_INFO[t.tool] || ''}`;
  } else if (t.kind === 'move') h = bm.ghost && !bm.ghost.valid ? bm.ghost.reason : '点击岛上空地选择新位置';
  else h = bm.ghost ? (bm.ghost.valid ? '位置合适，点「确认」放置' : bm.ghost.reason) : '点击岛上空地放置';
  $('#bh-hint').textContent = h;
}
function renderTabs() {
  $$('#build-hud [data-tab]').forEach(b => {
    const on = b.dataset.tab === bm.tab;
    b.classList.toggle('selected', on);
    b.setAttribute('aria-selected', String(on));
  });
}
function renderAction() {
  const el = $('#bh-action'),
    t = bm.tool,
    o = objInfo(bm.sel);
  let h = '';
  const btn = (a, ic, label, extra = '', cls = '') =>
    `<button data-bact="${a}" class="${cls}" ${extra}>${icon(ic)}${label}</button>`;
  if (t && t.kind !== 'terrain') {
    const g = bm.ghost;
    h = `<div class="bh-act-msg ${g && !g.valid ? 'bad' : ''}"><b>${esc(toolName(t))}</b><span>${esc(!g ? '点击岛上空地选择位置' : g.valid ? '位置合适' : g.reason)}</span></div><div class="bh-act-btns">${btn('rotate', 'rotate-cw', '旋转')}${btn('confirm', 'check', '确认', g && g.valid && !broken ? '' : 'disabled', 'ok')}${btn('cancel', 'x', '取消')}</div>`;
  } else if (t) {
    const tool = C.TERRAIN_TOOLS.find(x => x.id === t.tool);
    h = `<div class="bh-act-msg"><b>${esc(tool?.name || '')}</b><span>${esc(TERRAIN_INFO[t.tool] || '')}</span></div><div class="bh-act-btns">${btn('cancel', 'x', '结束')}</div>`;
  } else if (o) {
    const max = o.kind === 'building' && o.level >= 5,
      cost = o.kind === 'building' && !max ? C.costFor(state, o.id) : null;
    h = `<div class="bh-act-msg"><b>${esc(o.name)}</b><span>${o.kind === 'building' ? `Lv.${o.level} · ${C.RESOURCES[o.def.resource].name} +${o.def.rate * o.level}/h` : '装饰'}</span></div><div class="bh-act-btns">${btn('move', 'move', '移动')}${btn('rotsel', 'rotate-cw', '旋转')}${o.kind === 'building' ? btn('upgradesel', 'arrow-up', max ? '满级' : '升级', max || !canAfford(cost) || broken ? 'disabled' : '') + btn('detail', 'info', '详情') : btn('remove', 'trash-2', '拆除', '', 'danger')}</div>${cost ? `<div class="bh-act-cost">升级 Lv.${o.level + 1} 需要 ${costChips(cost)}</div>` : ''}`;
  }
  el.hidden = !h;
  el.innerHTML = h;
  icons();
}
function renderPalette() {
  const pal = $('#bh-palette'),
    left = pal.scrollLeft,
    pop = C.population(state);
  let h = '';
  const card = (a, id, sel, dim, inner) =>
    `<button class="bh-card ${sel ? 'sel' : ''} ${dim ? 'dim' : ''}" data-bact="${a}" data-id="${id}">${inner}</button>`;
  if (bm.tab === 'building') {
    h = C.BUILDINGS.map(b => {
      const lv = state.buildings[b.id] | 0,
        cost = C.costFor(state, b.id),
        r = C.RESOURCES[b.resource].name,
        ic = `<span class="bh-ic" style="color:${b.color}">${icon(b.icon)}</span>`;
      if (lv) {
        const max = lv >= 5;
        return `<article class="bh-card built"><span class="bh-row">${ic}<span class="bh-lv">Lv.${lv}</span></span><h4>${b.name}</h4><p>${r} +${b.rate * lv}/h</p><span class="bh-cost">${max ? '<span>已满级</span>' : costChips(cost)}</span><button data-bact="upgrade" data-id="${b.id}" ${max || !canAfford(cost) || broken ? 'disabled' : ''}>${icon('arrow-up')}升级</button></article>`;
      }
      const lock = pop < b.pop,
        ok = !lock && canAfford(cost);
      return card(
        'pick-building',
        b.id,
        bm.tool?.kind === 'building' && bm.tool.id === b.id,
        !ok,
        `<span class="bh-row">${ic}<span class="bh-lv">待建造</span></span><h4>${b.name}</h4><p>${r} +${b.rate}/h</p><span class="bh-cost">${costChips(cost)}</span>${lock ? `<em class="bh-lock">需 ${b.pop} 位居民</em>` : ok ? '' : '<em class="bh-lock">资源不足</em>'}`
      );
    }).join('');
  } else if (bm.tab === 'decor' && bm.pick) {
    const owned = C.COLLECTIONS.filter(c => state.collection[c.id]);
    h =
      `<button class="bh-card back" data-bact="pick-back">${icon('arrow-left')}<h4>返回</h4><p>选择要展示的奇物</p></button>` +
      owned
        .map(c =>
          card(
            'pick-item',
            c.id,
            false,
            false,
            `<span class="bh-ic item" data-thumb="${c.id}">${thumbInner(c.id, c.icon)}</span><h4>${c.name}</h4><p>${C.RARITIES[c.rarity].name} × ${state.collection[c.id]}</p>`
          )
        )
        .join('');
  } else if (bm.tab === 'decor') {
    h = decorDefs()
      .map(d =>
        card(
          'pick-decor',
          d.id,
          bm.tool?.kind === 'decor' && bm.tool.type === d.id,
          !canAfford(d.cost),
          `<span class="bh-ic">${icon(d.icon)}</span><h4>${d.name}</h4><p>${d.id === 'display' ? '展示收藏品' : '可连续放置'}</p><span class="bh-cost">${costChips(d.cost)}</span>`
        )
      )
      .join('');
  } else if (bm.tab === 'terrain') {
    h = C.TERRAIN_TOOLS.map(t => {
      const cost = t.id === 'reclaim' ? reclaimCost() : TERRAIN_COST[t.id];
      return card(
        'pick-terrain',
        t.id,
        bm.tool?.kind === 'terrain' && bm.tool.tool === t.id,
        false,
        `<span class="bh-ic">${icon(t.icon)}</span><h4>${t.name}</h4><p>${TERRAIN_INFO[t.id] || ''}</p><span class="bh-cost">${t.id === 'raise' ? '<span>石料 4×(高度+1)</span>' : costChips(cost)}</span>`
      );
    }).join('');
  } else {
    const built = C.BUILDINGS.filter(b => state.buildings[b.id]);
    h =
      `<div class="bh-note">${icon('hand')}<p>点击岛上的建筑或装饰，进行移动、旋转、升级或拆除。</p></div>` +
      built
        .map(b =>
          card(
            'select',
            'b:' + b.id,
            bm.sel === 'b:' + b.id,
            false,
            `<span class="bh-row"><span class="bh-ic" style="color:${b.color}">${icon(b.icon)}</span><span class="bh-lv">Lv.${state.buildings[b.id]}</span></span><h4>${b.name}</h4>`
          )
        )
        .join('');
  }
  pal.innerHTML = h;
  pal.scrollLeft = left;
  if (bm.tab === 'decor' && bm.pick) hydrateThumbs(pal);
}
function renderBuild() {
  if (!inBuild()) return;
  if (bm.sel && !objInfo(bm.sel)) {
    bm.sel = null;
    village.setSelection(null);
  }
  if (bm.tool?.kind === 'move' && !objInfo(bm.tool.key)) applyTool(null);
  else if (bm.ghost && bm.tool && bm.tool.kind !== 'terrain') ghostAt(bm.ghost.x, bm.ghost.z);
  renderBuildTop();
  renderTabs();
  renderPalette();
  renderAction();
  renderHint();
  icons();
}
$('#build-hud').addEventListener(
  'click',
  safe(e => {
    if (e.target.closest('#bh-done')) {
      exitBuild();
      return;
    }
    if (e.target.closest('#bh-fold')) {
      const h = $('#build-hud');
      h.classList.toggle('folded');
      $('#bh-fold').setAttribute('aria-expanded', String(!h.classList.contains('folded')));
      return;
    }
    const tab = e.target.closest('[data-tab]');
    if (tab) return buildAction('tab', tab.dataset.tab);
    const a = e.target.closest('[data-bact]');
    if (a && !a.disabled) return buildAction(a.dataset.bact, a.dataset.id);
  })
);
$('#build-button').onclick = $('#free-build-button').onclick = () => enterBuild();
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && inBuild() && !document.querySelector('dialog[open]')) {
    e.preventDefault();
    exitBuild();
  }
});
render();
setPage(location.hash.slice(1) || 'village');
setInterval(() => {
  updateTimer();
  updateLast();
  renderProduction();
}, 1000);
setInterval(() => {
  renderStats();
  icons();
}, 60000);
import('./items3d.js?v=4')
  .then(m => {
    items3d = m;
    renderCollections();
    icons();
    hydrateThumbs($('#draw-results'));
  })
  .catch(() => {});
import('./scene.js?v=4')
  .then(m => {
    try {
      village = m.createVillage($('#scene'), id => {
        if (inBuild()) return;
        const b = C.BUILDINGS.find(x => x.id === id);
        $('#building-label').textContent =
          `${b.name} · ${state.buildings[id] ? `Lv.${state.buildings[id]} · ${C.RESOURCES[b.resource].name} +${b.rate * state.buildings[id]}/h` : '等待建造'}`;
        $('#building-label').hidden = false;
        setPage('buildings');
        const card = document.getElementById(`building-${id}`);
        card?.classList.add('flash');
        setTimeout(() => {
          $('#building-label').hidden = true;
          card?.classList.remove('flash');
        }, 3500);
      });
      village.update(state);
      $('#reset-camera').onclick = () => village.reset();
      village.onTile = onTile;
      buildEntryState();
      renderBuildings();
    } catch {
      sceneError();
    }
  })
  .catch(sceneError);
function sceneError() {
  village = null;
  $('#scene-loading').hidden = false;
  $('#scene-loading').textContent = '当前设备无法显示 3D 场景，学习与村庄管理仍然可用。';
  $('#reset-camera').disabled = true;
  buildEntryState();
  renderBuildings();
}
if (document.modelContext?.registerTool) {
  try {
    Promise.resolve(
      document.modelContext.registerTool({
        name: 'read_village_status',
        description: '读取学习村庄的资源、建筑、累计学习时长、本周时长和当前计时状态。',
        inputSchema: {type: 'object', properties: {}, additionalProperties: false},
        annotations: {readOnlyHint: true},
        execute: () => ({
          resources: state.resources,
          buildings: state.buildings,
          layout: state.layout,
          decorCount: state.decor.length,
          landCount: C.landCount(state),
          population: C.population(state),
          studySeconds: C.studySeconds(state),
          weekSeconds: weekData().reduce((a, b) => a + b.seconds, 0),
          timer: state.timer
            ? {kind: state.timer.kind, elapsed: C.timerElapsed(state.timer), goal: state.timer.goal}
            : null
        })
      })
    ).catch(() => {});
  } catch {}
}
