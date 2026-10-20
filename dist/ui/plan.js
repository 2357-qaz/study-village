// The plan for a focus session: before starting, a few things to get done are written down (kept as
// a draft on this device); while reading they float under the time and are checked off with a tap.
// The plan goes with the timer into the session it becomes (core.js startTimer / togglePlan).
import * as C from '../core.js?v=8';
import * as A from '../alerts.js?v=6';
import {$, esc, safe, transact, toast, onRender, state} from './store.js?v=12';

let draft = C.cleanPlan(A.loadPrefs().planDraft);
const keep = () => A.savePrefs({planDraft: draft.map(x => x.text)});

// what startTimer gets; the draft is cleared once the timer has it
export const planDraft = () => draft.map(x => x.text);
export function clearDraft() {
  draft = [];
  keep();
  renderPlan();
}

function renderPlan() {
  const t = state.timer,
    run = t?.plan || [];
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
        `<li><button type="button" class="plan-item" role="checkbox" aria-checked="${x.done}" data-plan="${i}"><i aria-hidden="true"></i><span>${esc(x.text)}</span></button></li>`
    )
    .join('');
  const done = run.filter(x => x.done).length;
  $('#plan-run').dataset.progress = run.length ? `${done}/${run.length}` : '';
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
  const rm = e.target.closest('[data-plan-remove]');
  if (rm) {
    draft.splice(Number(rm.dataset.planRemove), 1);
    keep();
    renderPlan();
    return;
  }
  const item = e.target.closest('[data-plan]');
  if (item) {
    safe(async () => {
      await transact(s => C.togglePlan(s, Number(item.dataset.plan)));
      const p = state.timer?.plan || [];
      if (p.length && p.every(x => x.done)) toast('计划都完成了，剩下的时间慢慢读。');
    })();
  }
});
onRender(renderPlan);
