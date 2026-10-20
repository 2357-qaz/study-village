// The plan for a focus session: before starting, a few things to get done are written down (kept as
// a draft on this device); while reading they float under the time and are checked off with a tap.
// The plan goes with the timer into the session it becomes (core.js startTimer / togglePlan); what
// was not done comes back as the next draft, and the last plan can be taken up again in one tap.
import * as C from '../core.js?v=9';
import * as A from '../alerts.js?v=7';
import {$, esc, safe, transact, toast, onRender, state} from './store.js?v=13';

let draft = C.cleanPlan(A.loadPrefs().planDraft);
const keep = () => A.savePrefs({planDraft: draft.map(x => x.text)});

// what startTimer gets; the draft is cleared once the timer has it
export const planDraft = () => draft.map(x => x.text);
export function clearDraft() {
  draft = [];
  keep();
  renderPlan();
}

// Puts unfinished items back into the draft (skipping ones already there); returns how many went in.
export function carryOver(texts) {
  const have = new Set(draft.map(x => x.text)),
    add = C.cleanPlan(texts).filter(x => !have.has(x.text) && have.add(x.text)),
    room = add.slice(0, C.PLAN_MAX - draft.length);
  draft.push(...room);
  keep();
  renderPlan();
  return room.length;
}
const lastPlan = () => [...state.sessions].reverse().find(x => x.kind === 'study' && x.plan?.length)?.plan;

function renderPlan() {
  const t = state.timer,
    run = t?.plan || [],
    last = !t && !draft.length && lastPlan();
  $('#plan-reuse').hidden = !last;
  if (last) $('#plan-reuse span').textContent = `沿用上次的计划 · ${last.length} 项`;
  $('#plan-draft').innerHTML = draft
    .map(
      (x, i) =>
        `<li><span>${esc(x.text)}</span><button type="button" class="plan-remove" data-plan-remove="${i}" aria-label="删去「${esc(x.text)}」">×</button></li>`
    )
    .join('');
  $('#plan-input').disabled = draft.length >= C.PLAN_MAX;
  $('#plan-input').placeholder =
    draft.length >= C.PLAN_MAX
      ? `一次最多 ${C.PLAN_MAX} 项`
      : draft.length
        ? '再添一项，回车添加'
        : '这段时间要完成的事，回车添加';
  $('#plan-run').hidden = !run.length;
  $('#plan-run').innerHTML = run
    .map(
      (x, i) =>
        `<li><button type="button" class="plan-item" role="checkbox" aria-checked="${x.done}" data-plan="${i}" style="--i: ${i}"><i aria-hidden="true"></i><span>${esc(x.text)}</span></button></li>`
    )
    .join('');
  const done = run.filter(x => x.done).length;
  $('#plan-meter').hidden = !run.length;
  $('#plan-meter').classList.toggle('all-done', !!run.length && done === run.length);
  $('#plan-meter').style.setProperty('--done', run.length ? done / run.length : 0);
  $('#plan-meter span').textContent = done === run.length ? '计划全部完成' : `计划 ${done}/${run.length}`;
}

// A checked item pops, plays a note a step higher than the last, and sends a point of light up into
// the dream shell, where it opens like a small bloom.
function celebrate(i, step) {
  const el = $(`#plan-run [data-plan="${i}"]`);
  if (!el) return;
  el.classList.add('just-done');
  if (A.loadPrefs().sound) A.pling(step);
  const ring = $('#timer-ring').getBoundingClientRect();
  if (!ring.width || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const from = el.querySelector('i').getBoundingClientRect(),
    [x0, y0] = [from.left + from.width / 2, from.top + from.height / 2],
    [x1, y1] = [ring.left + ring.width / 2, ring.top + ring.height / 2],
    spark = document.createElement('span');
  spark.className = 'plan-spark';
  spark.setAttribute('aria-hidden', 'true');
  document.body.append(spark);
  const at = (x, y, k) => `translate(${x}px, ${y}px) scale(${k})`;
  spark
    .animate(
      [
        {transform: at(x0, y0, 0.6), opacity: 0},
        {transform: at(x0, y0 - 8, 1.2), opacity: 1, offset: 0.12},
        {transform: at((x0 + x1) / 2 + 40, Math.min(y0, y1) - 30, 1), opacity: 1, offset: 0.5},
        {transform: at(x1, y1, 0.7), opacity: 1, offset: 0.82},
        {transform: at(x1, y1, 4), opacity: 0}
      ],
      {duration: 1300, easing: 'ease-in-out'}
    )
    .finished.catch(() => {})
    .finally(() => spark.remove());
}

$('#plan-input').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.isComposing) return; // let an IME finish its word first
  e.preventDefault();
  const [item] = C.cleanPlan([e.target.value]);
  if (!item) return;
  if (draft.length >= C.PLAN_MAX) return toast(`一次最多 ${C.PLAN_MAX} 项计划`);
  draft.push(item);
  e.target.value = '';
  keep();
  renderPlan();
});
document.addEventListener('click', e => {
  if (e.target.closest('#plan-reuse')) {
    carryOver((lastPlan() || []).map(x => x.text));
    return;
  }
  const rm = e.target.closest('[data-plan-remove]');
  if (rm) {
    draft.splice(Number(rm.dataset.planRemove), 1);
    keep();
    renderPlan();
    return;
  }
  const item = e.target.closest('[data-plan]');
  if (item) {
    const i = Number(item.dataset.plan);
    if (A.loadPrefs().sound) A.primeAudio();
    safe(async () => {
      await transact(s => C.togglePlan(s, i));
      const p = state.timer?.plan || [],
        done = p.filter(x => x.done).length;
      if (!p[i]?.done) return;
      celebrate(i, done - 1);
      if (done === p.length) {
        $('#plan-run').classList.add('all-done');
        setTimeout(() => $('#plan-run').classList.remove('all-done'), 1800);
        if (A.loadPrefs().sound) setTimeout(A.chime, 500);
        toast('计划都完成了！打卡时会多得一些星砂，剩下的时间慢慢读。');
      }
    })();
  }
});
onRender(renderPlan);
