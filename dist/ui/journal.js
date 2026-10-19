// Study journal: totals, weekly chart and session history (study sessions read as dreams).
import * as C from '../core.js?v=7';
import {$, icon, esc, duration, weekData, icons, onRender, state} from './store.js?v=11';
let historyLimit = 30;
// Each study session is a dream read in 旧梦书屋 (its shell glows on the shelf); `nth` counts them.
function sessionHTML(x, nth) {
  const dream = x.kind === 'study',
    when = new Date(x.endedAt).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    how = x.manual ? '补记' : dream ? '专注' : '休息打卡';
  return `<div class="session-row${dream ? ' dream' : ''}"><span class="session-icon">${icon(dream ? 'shell' : 'coffee')}</span><div><div class="session-topic">${esc(dream ? x.topic : '好好休息')}</div><div class="session-meta">${dream ? `第 ${nth.get(x)} 个梦 · ` : ''}${when} · ${how}</div></div><span class="session-duration">${duration(x.seconds)}</span></div>`;
}
function renderJournal() {
  const sessions = [...state.sessions].sort((a, b) => b.endedAt - a.endedAt),
    nth = new Map(
      sessions
        .filter(x => x.kind === 'study')
        .reverse()
        .map((x, i) => [x, i + 1])
    ),
    row = x => sessionHTML(x, nth),
    empty = `<div class="empty-state">${icon('notebook-pen')}这里还没有足迹。<br>开始第一段专注，写下村庄的第一章。</div>`;
  $('#recent-sessions').innerHTML = sessions.slice(0, 2).map(row).join('') || empty;
  $('#all-sessions').innerHTML = sessions.slice(0, historyLimit).map(row).join('') || empty;
  $('#load-more').hidden = sessions.length <= historyLimit;
  $('#lifetime-hours').textContent = duration(C.studySeconds(state));
  $('#session-count').textContent = `${nth.size} 个`;
  const days = weekData(),
    max = Math.max(3600, ...days.map(x => x.seconds));
  $('#journal-week').textContent = duration(days.reduce((n, d) => n + d.seconds, 0));
  $('#weekly-chart').innerHTML = days
    .map(
      (d, i) =>
        `<div class="chart-column ${new Date(d.start).toDateString() === new Date().toDateString() ? 'today' : ''}"><span class="chart-value">${Math.floor(d.seconds / 60)} 分</span><div class="chart-bar" style="height:${Math.max(2, (d.seconds / max) * 155)}px"></div><span>周${'一二三四五六日'[i]}</span></div>`
    )
    .join('');
}
$('#load-more').onclick = () => {
  historyLimit += 30;
  renderJournal();
  icons();
};
onRender(renderJournal);
