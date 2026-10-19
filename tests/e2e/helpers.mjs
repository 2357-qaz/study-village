// Shared steps for the browser tests.
import {expect} from '@playwright/test';

// A device that has already seen the opening story, plus any other prefs.
export async function prefs(page, extra = {}) {
  await page.addInitScript(p => {
    if (!sessionStorage.getItem('e2e-prefs')) {
      sessionStorage.setItem('e2e-prefs', '1');
      localStorage.setItem('timegrove-prefs', JSON.stringify(p));
    }
  }, {storySeen: 1, ...extra});
}

// Opens the app with a save built in the page: `days` past study sessions of `minutes` each, plus
// optional extra resources and a collection.
export async function openWithSave(page, {days = 4, minutes = 90, resources = 0, collection = null} = {}) {
  await page.goto('/');
  await page.evaluate(
    async ({days, minutes, resources, collection}) => {
      const C = await import('./core.js');
      const now = Date.now(),
        s = C.initialState(now - (days + 16) * 864e5);
      for (let i = 1; i <= days; i++) C.manualStudy(s, minutes, now - i * 864e5, '测试', now);
      for (const k in s.resources) s.resources[k] += resources;
      if (collection) s.collection = collection;
      localStorage.setItem('timegrove-save-v1', JSON.stringify(s));
    },
    {days, minutes, resources, collection}
  );
  await page.reload();
  await expect(page.locator('#home-pages')).toHaveAttribute('data-screen', 'village');
}

export const dock = (page, key) => page.locator(`.screen-dock [data-dock="${key}"]`).click();
export const save = page => page.evaluate(() => JSON.parse(localStorage.getItem('timegrove-save-v1')));
export const bodyHas = (page, cls) => page.evaluate(c => document.body.classList.contains(c), cls);

// Page errors other than WebGL warnings from the software renderer fail the test.
export function collectErrors(page) {
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  return () => errs.filter(e => !/WebGL/.test(e));
}

// The reading room's controls ignore taps until revealed; reveal them like a person would.
export async function revealRoom(page) {
  const room = page.locator('#reading-room');
  if (!(await room.evaluate(r => r.classList.contains('reveal')))) await room.click({position: {x: 40, y: 200}});
  await expect(room).toHaveClass(/reveal/);
}
// Fixed full-screen layers confuse Playwright's "is it covered" check; click where a finger would.
export async function tapAt(page, selector) {
  const box = await page.locator(selector).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
