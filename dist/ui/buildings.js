// Building management list (建筑管理).
import * as C from '../core.js?v=4';
import {$, icon, transact, toast, safe, onRender, buildOK, state, broken} from './store.js?v=9';
import {enterBuild} from './build.js?v=9';
export function renderBuildings() {
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
document.addEventListener(
  'click',
  safe(async e => {
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
onRender(renderBuildings);
