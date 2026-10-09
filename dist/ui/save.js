// Save management: export / import, the backup reminder and the settings dialog.
import * as C from '../core.js?v=4';
import * as A from '../alerts.js?v=5';
import {
  $,
  KEY,
  BACKUP,
  toast,
  safe,
  duration,
  confirmAction,
  render,
  onRender,
  setState,
  setBroken,
  state,
  broken
} from './store.js?v=9';
export function renderBackup() {
  const prefs = A.loadPrefs(),
    due = broken
      ? null
      : A.backupDue(prefs, {createdAt: state.createdAt, studySeconds: C.studySeconds(state)});
  $('#backup-nudge').hidden = !due;
  if (due) {
    $('#backup-nudge-title').textContent = due.never ? '给村庄留一份备份吧' : `已经 ${due.days} 天没有备份了`;
    $('#backup-nudge-text').textContent =
      `${due.never ? '至今' : '上次备份后'}已学习 ${duration(due.newStudy)}。存档只在这个浏览器里，导出一份，换设备或清理浏览器也不怕。`;
  }
  $('#backup-last').textContent = A.describeLastExport(prefs);
  $('#backup-every').innerHTML = A.BACKUP_INTERVALS.map(
    o => `<option value="${o.days}" ${o.days === prefs.backupEvery ? 'selected' : ''}>${o.label}</option>`
  ).join('');
}
$('#settings-button').onclick = $('#rules-button').onclick = () => {
  $('#menu-dialog').close();
  $('#settings-dialog').showModal();
};
async function exportSave() {
  let text;
  try {
    text = localStorage.getItem(KEY) || JSON.stringify(state);
  } catch {
    toast('无法读取本机存档，请检查浏览器存储设置。');
    return;
  }
  if (!(await A.saveBackupFile(text, `timegrove-${new Date().toISOString().slice(0, 10)}.json`))) return;
  A.savePrefs({lastExportAt: Date.now(), lastExportStudy: C.studySeconds(state), snoozeUntil: 0});
  renderBackup();
  toast('存档已导出，记得放在网盘或其他安全的地方。');
}
$('#export-save').onclick = safe(exportSave);
$('#backup-nudge-export').onclick = safe(exportSave);
$('#backup-nudge-later').onclick = () => {
  A.savePrefs({snoozeUntil: Date.now() + 3 * 24 * 3600 * 1000});
  renderBackup();
  toast('好的，3 天后再提醒你。');
};
$('#backup-every').onchange = e => {
  A.savePrefs({backupEvery: Number(e.target.value), snoozeUntil: 0});
  renderBackup();
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
    setState(imported);
    setBroken(false);
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
onRender(renderBackup);
