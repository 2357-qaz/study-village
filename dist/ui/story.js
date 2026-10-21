// The town's story: three cards shown once per device (also to existing players after this update),
// replayable from the settings sheet. Device preference only; the save file is untouched.
import {$, icons, onRender, state} from './store.js?v=13';
import * as A from '../alerts.js?v=7';
const PAGES = [
  {
    icon: 'cloud-fog',
    title: '雾中的小镇',
    text: '海的中央，有一座被雾围住的小镇。镇上的钟停着，房子空着，颜色淡得像一张旧照片。'
  },
  {
    icon: 'book-open',
    title: '旧梦书屋',
    text: '雾里唯一亮着灯的地方，是旧梦书屋。架上摆满苍白的梦壳，据说是很久以前在岛上游荡的金色小兽留下的。书屋的钟，只在有人读梦时才会走动。'
  },
  {
    icon: 'sparkles',
    title: '读梦的人',
    text: '你是新来的读梦人。每一段安静的专注，就是读完一个旧梦：梦里的光散进小镇，化成木材、石料与补给，落下的碎光就是星砂。读得越久，小镇越暖，也会有人愿意留下来。'
  }
];
let page = 0;
// All pages sit stacked in one grid cell, so the sheet keeps the height of the longest page.
$('#story-pages').innerHTML = PAGES.map(
  p => `<section class="story-page"><h2>${p.title}</h2><p>${p.text}</p></section>`
).join('');
function draw() {
  const p = PAGES[page];
  $('#story-art').innerHTML = `<i data-lucide="${p.icon}"></i>`;
  $('#story-art').classList.toggle('warm', page === PAGES.length - 1);
  document.querySelectorAll('.story-page').forEach((s, i) => {
    s.classList.toggle('on', i === page);
    s.setAttribute('aria-hidden', String(i !== page));
    s.querySelector('h2').id = i === page ? 'story-title' : '';
  });
  $('#story-dots').innerHTML = PAGES.map((_, i) => `<i class="${i === page ? 'on' : ''}"></i>`).join('');
  $('#story-next').textContent = page === PAGES.length - 1 ? '点亮书屋的灯' : '继续';
  $('#story-skip').hidden = page === PAGES.length - 1;
  icons();
}
export function openStory() {
  page = 0;
  draw();
  $('#story-dialog').showModal();
  $('#story-dialog').focus(); // no focus ring on the buttons when the sheet opens
  // Mark as seen as soon as it is shown: the dialog 'close' event is not reliable enough to depend on.
  A.savePrefs({storySeen: 1});
}
$('#story-next').onclick = () => {
  if (page < PAGES.length - 1) {
    page++;
    draw();
  } else $('#story-dialog').close();
};
$('#story-skip').onclick = () => $('#story-dialog').close();
$('#story-button').onclick = () => {
  $('#settings-dialog').close();
  openStory();
};
// First visit on this device: tell the story only at a quiet moment — never over a running timer,
// another sheet or build mode. Until then it waits and is tried again on the next update or return.
let storyWait = 0;
function storyWhenQuiet() {
  if (storyWait || A.loadPrefs().storySeen) return;
  storyWait = setTimeout(() => {
    storyWait = 0;
    const busy =
      state.timer ||
      document.hidden ||
      document.querySelector('dialog[open]') ||
      document.body.classList.contains('build-mode') ||
      document.body.classList.contains('reading-mode');
    if (!busy && !A.loadPrefs().storySeen) openStory();
  }, 400);
}
onRender(storyWhenQuiet);
document.addEventListener('visibilitychange', storyWhenQuiet);
document.addEventListener('close', storyWhenQuiet, true); // another sheet just closed
storyWhenQuiet();
