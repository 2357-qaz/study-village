// Focus / rest timer, manual study entries and timer alert toggles.
import * as C from '../core.js?v=4';
import * as A from '../alerts.js?v=5';
import {
  $,
  $$,
  toast,
  safe,
  transact,
  rewardText,
  confirmAction,
  onRender,
  state,
  broken
} from './store.js?v=8';
let mode = 'study',
  minutes = 25,
  readyNotified = false;
const BASE_TITLE = document.title;
export function renderTimer() {
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
export function updateTimer() {
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
    A.timerFinished(t.kind);
  }
  if (!t) readyNotified = false;
  document.title = A.timerTitle(t, remain, BASE_TITLE);
  A.scheduleEnd(remain, !!t && t.runningSince !== null, updateTimer);
}
export function renderAlerts() {
  const prefs = A.loadPrefs(),
    notifyOn = prefs.notify && A.notificationsSupported() && Notification.permission === 'granted';
  $('#alert-sound').setAttribute('aria-pressed', String(prefs.sound));
  $('#alert-notify').setAttribute('aria-pressed', String(notifyOn));
  $('#alert-notify').hidden = !A.notificationsSupported();
}
function localDateTime(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function openManual() {
  $('#manual-error').textContent = '';
  const end = $('#manual-form input[name=end]');
  end.value = localDateTime(Date.now());
  end.max = end.value;
  end.min = localDateTime(Date.now() - 365 * 24 * C.HOUR);
  $('#manual-dialog').showModal();
}
document.addEventListener('click', e => {
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
});
$('#start-button').onclick = safe(async () => {
  A.primeAudio();
  await transact(s => C.startTimer(s, mode, minutes, $('#topic').value));
  toast(mode === 'study' ? '村庄等你回来。安心专注吧。' : '伸个懒腰，给自己一点空白。');
});
$('#pause-button').onclick = safe(() => {
  A.primeAudio();
  return transact(s => (s.timer?.runningSince === null ? C.resumeTimer(s) : C.pauseTimer(s)));
});
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
$('#alert-sound').onclick = () => {
  const on = !A.loadPrefs().sound;
  A.savePrefs({sound: on});
  if (on) {
    A.primeAudio();
    A.chime();
  }
  renderAlerts();
};
$('#alert-notify').onclick = safe(async () => {
  const prefs = A.loadPrefs();
  if (prefs.notify && Notification.permission === 'granted') {
    A.savePrefs({notify: false});
    renderAlerts();
    return;
  }
  const result = await A.enableNotifications();
  A.savePrefs({notify: result === 'granted'});
  renderAlerts();
  if (result === 'granted') toast('好的，计时结束时会发送通知（需要保持页面在后台打开）。');
  else if (result === 'denied') toast('通知权限被拒绝了，可以在浏览器的网站设置里重新开启。');
});
document.addEventListener('pointerdown', () => A.loadPrefs().sound && A.primeAudio(), {once: true});
onRender(renderTimer);
onRender(renderAlerts);
