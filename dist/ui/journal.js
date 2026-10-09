// Study journal: totals, weekly chart and session history.
import * as C from '../core.js?v=4';
import {$, icon, esc, duration, weekData, icons, onRender, state} from './store.js?v=9';
let historyLimit = 30;
function sessionHTML(x) {
  return `<div class="session-row"><span class="session-icon">${icon(x.kind === 'study' ? 'book-open' : 'coffee')}</span><div><div class="session-topic">${esc(x.kind === 'study' ? x.topic : '好好休息')}</div><div class="session-meta">${new Date(x.endedAt).toLocaleString('zh-CN', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'})} · ${x.manual ? '补记学习' : x.kind === 'study' ? '专注打卡' : '休息打卡'}</div></div><span class="session-duration">${duration(x.seconds)}</span></div>`;
}
function renderJournal() {
  const sessions = [...state.sessions].sort((a, b) => b.endedAt - a.endedAt),
    empty = `<div class="empty-state">${icon('notebook-pen')}这里还没有足迹。<br>开始第一段专注，写下村庄的第一章。</div>`;
  $('#recent-sessions').innerHTML = sessions.slice(0, 2).map(sessionHTML).join('') || empty;
  $('#all-sessions').innerHTML = sessions.slice(0, historyLimit).map(sessionHTML).join('') || empty;
  $('#load-more').hidden = sessions.length <= historyLimit;
  $('#lifetime-hours').textContent = duration(C.studySeconds(state));
  $('#session-count').textContent = `${sessions.filter(x => x.kind === 'study').length} 次`;
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
