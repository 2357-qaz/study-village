// Shared state and helpers. The save, the 3D scene handle and the current page are exported as live
// bindings: other modules read them directly, but only this module reassigns them (via the setters).
import * as C from '../core.js?v=4';
export const KEY = 'timegrove-save-v1',
  BACKUP = KEY + '-previous',
  V1BAK = 'timegrove-save-v1-backup-before-v2';
export const $ = s => document.querySelector(s),
  $$ = s => [...document.querySelectorAll(s)],
  icon = name => `<i data-lucide="${name}"></i>`;
export const esc = s =>
  String(s).replace(
    /[&<>"']/g,
    c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]
  );
export let state = C.initialState(),
  broken = false,
  village = null,
  items3d = null,
  page = 'village';
export const setState = next => (state = next);
export const setBroken = value => (broken = value);
export const setVillage = value => (village = value);
export const setItems3d = value => (items3d = value);
export const setCurrentPage = value => (page = value);
export const inBuild = () => document.body.classList.contains('build-mode');
export const buildOK = () => !!village && typeof village.setBuildMode === 'function';
let toastTimeout;
export function icons() {
  window.lucide?.createIcons();
}
export function storageWarning(msg) {
  $('#storage-alert').hidden = false;
  $('#storage-alert').textContent = msg;
  $('#save-state').textContent = '存档需要处理';
}
// v1 saves are migrated in memory by validateState; the raw v1 text is kept once before the first v2 write.
export function parseSave(text) {
  const raw = JSON.parse(text),
    next = C.validateState(raw);
  if (raw && raw.version === 1 && localStorage.getItem(V1BAK) === null) localStorage.setItem(V1BAK, text);
  return next;
}
try {
  const saved = localStorage.getItem(KEY);
  if (saved) {
    const old = JSON.parse(saved).version === 1;
    setState(parseSave(saved));
    if (old) localStorage.setItem(KEY, JSON.stringify(state));
  } else localStorage.setItem(KEY, JSON.stringify(state));
} catch (e) {
  setBroken(true);
  storageWarning(
    '无法读取或保存此设备的存档。请先导出备份或导入有效存档；当前操作已暂停，避免覆盖原有进度。'
  );
}
export function toast(msg) {
  $('#toast').textContent = msg;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 4500);
}
export async function transact(fn) {
  const task = () => {
    if (broken) throw Error('请先在「存档与规则」中导入有效存档');
    const saved = localStorage.getItem(KEY);
    const next = saved ? parseSave(saved) : C.initialState();
    const result = fn(next);
    C.accrue(next);
    localStorage.setItem(KEY, JSON.stringify(next));
    setState(next);
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
export function safe(fn) {
  return (...args) => {
    try {
      return Promise.resolve(fn(...args)).catch(() => {});
    } catch {
      return undefined;
    }
  };
}
export const fmt = n => Math.floor(n).toLocaleString('zh-CN');
export function duration(s) {
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分钟` : `${m} 分钟`;
}
export function latest() {
  return state.sessions.filter(x => x.kind === 'study').sort((a, b) => b.endedAt - a.endedAt)[0];
}
export function rewardText(r) {
  return Object.entries(r)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `+${Number(v.toFixed(1))} ${C.RESOURCES[k].name}`)
    .join(' · ');
}
export function weekData() {
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
export function confirmAction(title, text) {
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
// Each feature module registers its renderer; render() redraws everything after a state change.
const renderers = [];
export function onRender(fn) {
  renderers.push(fn);
}
export function render() {
  for (const fn of renderers) fn();
  icons();
  village?.update(state);
}
