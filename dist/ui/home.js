// Village home screen: weekly stats, residents, resources and building production.
import * as C from '../core.js?v=4';
import {
  $,
  icon,
  fmt,
  latest,
  weekData,
  rewardText,
  transact,
  toast,
  safe,
  onRender,
  state,
  broken
} from './store.js?v=9';
export function renderStats() {
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
export function updateLast() {
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
export function renderProduction() {
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
$('#harvest-button').onclick = safe(async () => {
  const r = await transact(s => C.collect(s));
  toast(`收获啦！${rewardText(r)}`);
});
onRender(renderStats);
onRender(renderProduction);
