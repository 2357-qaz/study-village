// Timer-finished alerts (sound, vibration, system notification, tab title) and backup reminders.
// Preferences are per device and live outside the save file, so the save format is unchanged.

const PREFS_KEY = 'timegrove-prefs';
const DAY = 24 * 3600 * 1000;
export const BACKUP_INTERVALS = [
  {days: 3, label: '每 3 天'},
  {days: 7, label: '每周'},
  {days: 14, label: '每两周'},
  {days: 0, label: '关闭'}
];
const DEFAULTS = {
  sound: true,
  notify: false,
  backupEvery: 7,
  lastExportAt: 0,
  lastExportStudy: 0,
  snoozeUntil: 0
};

export function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return {...DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {})};
  } catch {
    return {...DEFAULTS};
  }
}

export function savePrefs(patch) {
  const next = {...loadPrefs(), ...patch};
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: preferences simply fall back to defaults next time.
  }
  return next;
}

/* ---------- backup reminder ---------- */

// Remind when the interval has passed since the last export (or since the village was founded)
// AND at least an hour of new study has happened since then — no nagging when nothing changed.
export function backupDue(prefs, {createdAt, studySeconds}, now = Date.now()) {
  if (!prefs.backupEvery || now < prefs.snoozeUntil) return null;
  const since = prefs.lastExportAt || createdAt;
  const newStudy = studySeconds - (prefs.lastExportAt ? prefs.lastExportStudy : 0);
  if (now - since < prefs.backupEvery * DAY || newStudy < 3600) return null;
  return {days: Math.floor((now - since) / DAY), newStudy, never: !prefs.lastExportAt};
}

export function describeLastExport(prefs, now = Date.now()) {
  if (!prefs.lastExportAt) return '尚未导出过存档';
  const days = Math.floor((now - prefs.lastExportAt) / DAY);
  return days < 1 ? '今天已导出存档' : `上次导出：${days} 天前`;
}

// On phones the share sheet lets people save straight to Files / iCloud / a cloud drive.
// Resolves true when the file was handed over, false when the person cancelled.
export async function saveBackupFile(text, name) {
  const file = typeof File === 'function' ? new File([text], name, {type: 'application/json'}) : null;
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (coarse && file && navigator.canShare?.({files: [file]})) {
    try {
      await navigator.share({files: [file], title: '时光村落存档'});
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') return false;
      // Share sheet unavailable for this file type: fall through to a normal download.
    }
  }
  const url = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/* ---------- timer alerts ---------- */

let audio = null;

// Browsers only allow sound after a user gesture, so call this from the start/resume click.
export function primeAudio() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch {
    audio = null;
  }
}

// A soft three-note wind-chime, synthesised so no audio file is needed.
export function chime() {
  if (!audio) return;
  const start = audio.currentTime + 0.05;
  [659.25, 783.99, 1046.5].forEach((freq, i) => {
    const at = start + i * 0.22;
    const osc = audio.createOscillator();
    const overtone = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    overtone.type = 'sine';
    osc.frequency.value = freq;
    overtone.frequency.value = freq * 2.01;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);
    osc.connect(gain);
    overtone.connect(gain);
    gain.connect(audio.destination);
    for (const o of [osc, overtone]) {
      o.start(at);
      o.stop(at + 1.7);
    }
  });
}

export const notificationsSupported = () => 'Notification' in window && 'serviceWorker' in navigator;

// Asks for permission and registers the tiny service worker that shows and focuses notifications.
// Resolves to 'granted', 'denied', 'default' or 'unsupported'.
export async function enableNotifications() {
  if (!notificationsSupported()) return 'unsupported';
  const result = await Notification.requestPermission();
  if (result === 'granted') await navigator.serviceWorker.register('./sw.js').catch(() => {});
  return result;
}

async function showNotification(title, body) {
  const options = {body, tag: 'timegrove-timer', renotify: true, icon: './icons/icon-192-v1.png'};
  try {
    const reg = await navigator.serviceWorker.getRegistration('./');
    if (reg) return await reg.showNotification(title, options);
  } catch {
    // Fall back to a page notification below.
  }
  try {
    new Notification(title, options);
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
  }
}

export function timerFinished(kind, prefs = loadPrefs()) {
  const study = kind === 'study';
  if (prefs.sound) {
    chime();
    navigator.vibrate?.([180, 90, 180]);
  }
  if (prefs.notify && notificationsSupported() && Notification.permission === 'granted' && document.hidden)
    showNotification(
      study ? '专注完成啦' : '休息结束',
      study ? '回到时光村落打卡，领取这段时间的奖励吧。' : '休息好了吗？村庄在等你回来。'
    );
}

// The tab title doubles as a countdown, so a background tab still shows progress.
export function timerTitle(timer, remain, baseTitle) {
  if (!timer) return baseTitle;
  const clock = `${String(Math.floor(remain / 60)).padStart(2, '0')}:${String(remain % 60).padStart(2, '0')}`;
  if (remain === 0) return `✓ ${timer.kind === 'study' ? '专注完成' : '休息结束'} · 时光村落`;
  return `${timer.runningSince === null ? '⏸' : '⏱'} ${clock} · 时光村落`;
}

// One-shot timeout at the exact end time; background tabs throttle repeating intervals
// much more aggressively than a single timeout.
let endTimeout = 0;
export function scheduleEnd(remainSeconds, running, onEnd) {
  clearTimeout(endTimeout);
  if (running && remainSeconds > 0) endTimeout = setTimeout(onEnd, remainSeconds * 1000 + 250);
}
