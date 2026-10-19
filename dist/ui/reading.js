// Reading room around the timer: renders the room still (lazily), positions the light, clock and
// dream shell over it, switches to the immersive reading view while a timer exists on the focus
// screen, reveals the controls on tap, runs the wall clock only while reading, and keeps the
// screen awake if asked to.
import * as C from '../core.js?v=7';
import * as A from '../alerts.js?v=6';
import {$, onRender, state} from './store.js?v=11';
import {setPage} from './nav.js?v=13';

const room = $('#reading-room'),
  img = $('#room-img'),
  pager = $('#home-pages'),
  motion = matchMedia('(prefers-reduced-motion: reduce)');
let mod = null,
  sculptReady = null,
  lastKey = '',
  lastOpts = null,
  pose = '',
  lookUntil = 0,
  turnUntil = 0,
  nextTurn = 0,
  hadTimer = false,
  greeted = false,
  revealTimer = 0,
  wake = null,
  wakeBusy = false,
  fails = 0,
  retryTimer = 0,
  poseFailedAt = 0,
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
    mod ??= await import('../reading-room.js?v=4');
    sculptReady ??= mod.loadCompanion();
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
    room.classList.remove('no-room');
    fails = 0;
    await sculptReady; // her sculpted parts (or, failing that, the simple shapes)
    if (key !== lastKey) return;
    lastOpts = opts;
    pose = '';
    poseFailedAt = 0;
    showPose();
    warmPoses();
  } catch {
    // no WebGL right now (blocked, lost or out of memory): the timer works on a plain panel, and the
    // room is tried again a few times with growing pauses, and on any later resize or visit
    room.classList.add('no-room');
    lastKey = '';
    if (!retryTimer && fails < 4)
      retryTimer = setTimeout(() => {
        retryTimer = 0;
        paintRoom();
      }, [2000, 6000, 20000, 60000][fails++]);
  }
}

/* ---------- the companion: a still layer per pose, cross-faded ---------- */
const faces = [...room.querySelectorAll('.companion-img')];
function poseNow(now = Date.now()) {
  const t = state.timer;
  if (t && C.timerElapsed(t) >= t.goal) return 'tea';
  if (now < lookUntil) return 'look';
  if (now < turnUntil) return 'turn';
  return 'read';
}
function showPose() {
  if (!mod || !lastOpts) return;
  const want = poseNow();
  if (want === pose || Date.now() - poseFailedAt < 15000) return;
  let layer;
  try {
    layer = mod.renderCompanion(lastOpts, want);
  } catch {
    poseFailedAt = Date.now(); // try again later instead of every tick
    return;
  }
  pose = want;
  const [on, off] = faces[0].classList.contains('on') ? faces : [faces[1], faces[0]];
  off.onload = () => {
    off.classList.add('on');
    on.classList.remove('on');
  };
  off.src = layer.url;
}
// render the other poses while the page is idle, so switching later is instant
function warmPoses() {
  const opts = lastOpts,
    queue = ['look', 'turn', 'tea'],
    idle = window.requestIdleCallback || (f => setTimeout(f, 400));
  const next = () => {
    if (opts !== lastOpts || !queue.length) return;
    try {
      mod.renderCompanion(opts, queue.shift());
    } catch {}
    idle(next);
  };
  idle(next);
}
function say(text, ms = 6000) {
  const el = $('#room-say');
  el.textContent = text;
  el.classList.add('on');
  setTimeout(() => el.classList.remove('on'), ms);
}
// she looks up when you start reading, turns a page now and then, and greets you after a long absence
function behave(now = Date.now()) {
  const t = state.timer,
    running = t && t.kind === 'study' && t.runningSince !== null;
  if (t && !hadTimer) lookUntil = now + 3500;
  hadTimer = !!t;
  if (running && now > nextTurn) {
    if (nextTurn) turnUntil = now + 1400;
    nextTurn = now + 50000 + Math.random() * 60000;
  }
  if (!greeted && onFocus() && !t) {
    greeted = true;
    const last = state.sessions.reduce((m, s) => Math.max(m, s.endedAt), 0);
    if (last && now - last > 3 * 864e5) {
      lookUntil = now + 6000;
      say('她抬起头：你回来啦。');
    }
  }
  showPose();
}

function tick() {
  behave();
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

// One request at a time; when it settles the state is checked again, so leaving the room while the
// browser is still deciding releases the lock it then grants.
const wantWake = () => reading() && A.loadPrefs().wakeLock && !document.hidden && 'wakeLock' in navigator;
async function syncWake() {
  if (wakeBusy) return;
  if (wantWake() && !wake) {
    wakeBusy = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => {
        if (wake === lock) wake = null;
      });
      wake = lock;
    } catch {
      wake = null;
      // A denied or unavailable wake lock must not trigger an immediate retry loop.
      // The next user action or page/visibility change may request it again.
      return;
    } finally {
      wakeBusy = false;
    }
    // Recheck on success: the user may have left the room while permission was pending.
    syncWake();
  } else if (!wantWake() && wake) {
    const lock = wake;
    wake = null;
    lock.release().catch(() => {});
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
