// Entry point: loads the save (ui/store.js), wires every feature module, then starts timers,
// the 3D village and the optional WebMCP status tool.
import * as C from './core.js?v=4';
import {
  $,
  KEY,
  icons,
  render,
  storageWarning,
  setState,
  setItems3d,
  setVillage,
  village,
  weekData,
  inBuild,
  state
} from './ui/store.js?v=9';
import {setPage} from './ui/nav.js?v=10';
import {renderStats, updateLast, renderProduction} from './ui/home.js?v=9';
import {updateTimer} from './ui/timer.js?v=9';
import {renderBuildings} from './ui/buildings.js?v=9';
import './ui/journal.js?v=9';
import {renderCollections} from './ui/collection.js?v=9';
import {hydrateThumbs} from './ui/thumbs.js?v=9';
import {renderBackup} from './ui/save.js?v=9';
import {buildEntryState, onTile} from './ui/build.js?v=9';
window.addEventListener('storage', e => {
  if (e.key === KEY && e.newValue) {
    try {
      setState(C.validateState(JSON.parse(e.newValue)));
      render();
    } catch {
      storageWarning('其他标签页的存档无法读取，请导出备份后检查。');
    }
  }
});
window.addEventListener('focus', () => {
  try {
    const text = localStorage.getItem(KEY);
    if (text) {
      setState(C.validateState(JSON.parse(text)));
      render();
    }
  } catch {}
});
const today = new Date().toLocaleDateString('zh-CN', {month: 'long', day: 'numeric', weekday: 'long'});
for (const el of [$('#date-label'), ...document.querySelectorAll('[data-date]')]) el.textContent = today;
render();
setPage(location.hash.slice(1) || 'village');
setInterval(() => {
  updateTimer();
  updateLast();
  renderProduction();
}, 1000);
setInterval(() => {
  renderStats();
  renderBackup();
  icons();
}, 60000);
import('./items3d.js?v=4')
  .then(m => {
    setItems3d(m);
    renderCollections();
    icons();
    hydrateThumbs($('#draw-results'));
  })
  .catch(() => {});
import('./scene.js?v=4')
  .then(m => {
    try {
      setVillage(
        m.createVillage($('#scene'), id => {
          if (inBuild()) return;
          const b = C.BUILDINGS.find(x => x.id === id);
          $('#building-label').textContent =
            `${b.name} · ${state.buildings[id] ? `Lv.${state.buildings[id]} · ${C.RESOURCES[b.resource].name} +${b.rate * state.buildings[id]}/h` : '等待建造'}`;
          $('#building-label').hidden = false;
          setPage('buildings');
          const card = document.getElementById(`building-${id}`);
          card?.classList.add('flash');
          setTimeout(() => {
            $('#building-label').hidden = true;
            card?.classList.remove('flash');
          }, 3500);
        })
      );
      village.update(state);
      $('#reset-camera').onclick = () => village.reset();
      village.onTile = onTile;
      buildEntryState();
      renderBuildings();
    } catch {
      sceneError();
    }
  })
  .catch(sceneError);
function sceneError() {
  setVillage(null);
  $('#scene-loading').hidden = false;
  $('#scene-loading').textContent = '当前设备无法显示 3D 场景，学习与村庄管理仍然可用。';
  $('#reset-camera').disabled = true;
  buildEntryState();
  renderBuildings();
}
if (document.modelContext?.registerTool) {
  try {
    Promise.resolve(
      document.modelContext.registerTool({
        name: 'read_village_status',
        description: '读取学习村庄的资源、建筑、累计学习时长、本周时长和当前计时状态。',
        inputSchema: {type: 'object', properties: {}, additionalProperties: false},
        annotations: {readOnlyHint: true},
        execute: () => ({
          resources: state.resources,
          buildings: state.buildings,
          layout: state.layout,
          decorCount: state.decor.length,
          landCount: C.landCount(state),
          population: C.population(state),
          studySeconds: C.studySeconds(state),
          weekSeconds: weekData().reduce((a, b) => a + b.seconds, 0),
          timer: state.timer
            ? {kind: state.timer.kind, elapsed: C.timerElapsed(state.timer), goal: state.timer.goal}
            : null
        })
      })
    ).catch(() => {});
  } catch {}
}
