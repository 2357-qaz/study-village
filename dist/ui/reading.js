// Reading room around the timer: renders the room still (lazily), positions the light, clock and
// dream shell over it, switches to the immersive reading view while a timer exists on the focus
// screen, reveals the controls on tap, runs the wall clock only while reading, and keeps the
// screen awake if asked to.
import * as C from '../core.js?v=7';
import * as A from '../alerts.js?v=6';
import {$, onRender, state} from './store.js?v=11';
import {setPage} from './nav.js?v=12';

const room = $('#reading-room'),
  img = $('#room-img'),
  pager = $('#home-pages'),
  motion = matchMedia('(prefers-reduced-motion: reduce)');
let mod = null,
  lastKey = '',
  revealTimer = 0,
  wake = null,
  clockAt = new Date();

const onFocus = () => pager.dataset.screen === 'focus';
const reading = () => !!state.timer && onFocus();

function hourNow() {
  const q = new URLSearchParams(location.search);
  if (q.has('hour')) return Number(q.get('hour'));
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

async function paintRoom() {
  const w = room.clientWidth,
    h = room.clientHeight;
  if (!w || !h) return;
  const warm = C.warmth(state),
    opts = {
      width: w,
      height: h,
      hour: hourNow(),
      warmth: warm,
      snow: C.snowfall(warm),
      cover: C.snowCover(warm)
    },
    key = [w, h, Math.floor(opts.hour * 2), opts.snow > 0, Math.round(warm * 4)].join('|');
  if (key === lastKey) return;
  lastKey = key;
  try {
    mod ??= await import('../reading-room.js?v=1');
    const r = mod.renderRoom(opts);
    if (key !== lastKey) return; // a newer size arrived meanwhile
    const [sx, sy] = r.points.shell,
      [cx, cy] = r.points.clock,
      [lx, ly] = r.points.lamp,
      [wx, wy] = r.points.window,
      pct = v => `${(v * 100).toFixed(2)}%`;
    Object.entries({sx, sy, cx, cy, lx, ly, wx, wy}).forEach(([k, v]) =>
      room.style.setProperty(`--${k}`, pct(v))
    );
    room.style.setProperty('--cr', pct(r.clockR));
    // drift of the dream light from the shell to the window, in room-size units
    room.style.setProperty('--mdx', ((wx - sx) * 100).toFixed(2));
    room.style.setProperty('--mdy', ((wy - sy) * 100).toFixed(2));
    room.dataset.daypart = r.daypart;
    img.src = r.url;
    room.classList.add('ready');
  } catch {
    room.classList.add('no-room'); // no WebGL: the timer still works on a plain panel
  }
}

function tick() {
  const t = state.timer;
  if (t && t.kind === 'study' && t.runningSince !== null) clockAt = new Date();
  const hh = (clockAt.getHours() % 12) + clockAt.getMinutes() / 60,
    mm = clockAt.getMinutes() + clockAt.getSeconds() / 60;
  room.style.setProperty('--ha', `${hh * 30}deg`);
  room.style.setProperty('--ma', `${mm * 6}deg`);
  const goal = t ? t.goal : 1,
    p = t ? Math.min(1, C.timerElapsed(t) / goal) : 0;
  room.style.setProperty('--p', p.toFixed(3));
  room.classList.toggle('done', !!t && p >= 1);
  room.classList.toggle('paused', !!t && t.runningSince === null);
  room.classList.toggle('resting', (t?.kind || '') === 'rest');
}

async function syncWake() {
  const want = reading() && A.loadPrefs().wakeLock && !document.hidden && 'wakeLock' in navigator;
  if (want && !wake) {
    try {
      wake = await navigator.wakeLock.request('screen');
      wake.addEventListener('release', () => (wake = null));
    } catch {
      wake = null;
    }
  } else if (!want && wake) {
    wake.release().catch(() => {});
    wake = null;
  }
}

function sync() {
  const on = reading();
  if (document.body.classList.contains('reading-mode') !== on) {
    document.body.classList.toggle('reading-mode', on);
    room.classList.remove('reveal');
    if (on) reveal(); // show the controls briefly when the reading view opens
    requestAnimationFrame(paintRoom); // the room changes shape between the card and full screen
  }
  $('#wake-toggle').setAttribute('aria-pressed', String(!!A.loadPrefs().wakeLock));
  $('#wake-toggle').hidden = !('wakeLock' in navigator);
  tick();
  syncWake();
}

function reveal() {
  room.classList.add('reveal');
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => room.classList.remove('reveal'), 3500);
}

room.addEventListener('click', e => {
  if (!document.body.classList.contains('reading-mode')) return;
  if (e.target.closest('button')) return reveal(); // keep controls up while using them
  if (room.classList.contains('reveal')) {
    clearTimeout(revealTimer);
    room.classList.remove('reveal');
  } else reveal();
});
document.addEventListener('keydown', e => {
  if (
    document.body.classList.contains('reading-mode') &&
    !document.querySelector('dialog:modal') &&
    e.key !== 'Tab'
  )
    reveal();
});
$('#room-exit').onclick = () => setPage('village');
$('#wake-toggle').onclick = () => {
  A.savePrefs({wakeLock: !A.loadPrefs().wakeLock});
  sync();
};
new MutationObserver(sync).observe(pager, {attributes: true, attributeFilter: ['data-screen']});
new ResizeObserver(() => requestAnimationFrame(paintRoom)).observe(room);
document.addEventListener('visibilitychange', syncWake);
motion.addEventListener?.('change', tick);
setInterval(tick, 1000);
setInterval(paintRoom, 10 * 60 * 1000); // time of day and weather move on
onRender(() => {
  sync();
  paintRoom();
});
