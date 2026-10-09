// Build mode (建造模式): full-screen island editing on top of the 3D scene.
import * as C from '../core.js?v=4';
import {
  $,
  $$,
  icon,
  esc,
  fmt,
  icons,
  toast,
  safe,
  transact,
  confirmAction,
  onRender,
  inBuild,
  buildOK,
  state,
  broken,
  village
} from './store.js?v=8';
import {setPage} from './nav.js?v=8';
import {thumbInner, hydrateThumbs} from './thumbs.js?v=8';
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
export function buildEntryState() {
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
export function onTile(info) {
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
export function enterBuild(pick) {
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
export function exitBuild() {
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
export function renderBuild() {
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
onRender(() => {
  if (inBuild()) renderBuild();
});
