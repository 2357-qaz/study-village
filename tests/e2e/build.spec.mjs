// Build mode: enter, place a building, decorate, show an item, reshape terrain, move a building and
// leave again. Taps go through the village's own projection so they land on the right tile.
import {test, expect} from '@playwright/test';
import {prefs, openWithSave, save, collectErrors} from './helpers.mjs';

test('building, decorating, terrain and moving in build mode', async ({page}, testInfo) => {
  test.setTimeout(80_000);
  const errors = collectErrors(page);
  const touch = testInfo.project.name === 'phone';
  const height = page.viewportSize().height;
  await prefs(page);
  await page.goto('/?hour=10#village');
  await expect(page.locator('#home-pages')).toHaveAttribute('data-screen', 'village');
  // a rich-ish save: some study, plenty of materials, two collected items (the display case needs one)
  await page.evaluate(async () => {
    const C = await import('./core.js');
    const s = C.validateState(JSON.parse(localStorage.getItem('timegrove-save-v1')));
    const now = Date.now();
    for (let i = 0; i < 6; i++) C.manualStudy(s, 120, now - (i + 1) * 864e5, '测试', now);
    for (const k in s.resources) s.resources[k] += 3000;
    s.collection = {whale: 1, crown: 1};
    localStorage.setItem('timegrove-save-v1', JSON.stringify(s));
  });
  await page.reload();
  await page.waitForFunction(() => window.__village?.debug);

  const tap = async (x, z) => {
    const [px, py] = await page.evaluate(([x, z]) => window.__village.debug.project(x, z), [x, z]);
    if (touch) await page.touchscreen.tap(px, py);
    else await page.mouse.click(px, py);
  };
  // tiles that pass `pred` (an expression over state `s`, core `C`, x, z) and sit in the open part of the
  // screen, clear of the header, the action sheet and the palette
  const spots = (kind, type, item, pred) =>
    page.evaluate(
      async ([kind, type, item, pred, H]) => {
        const C = await import('./core.js');
        const s = JSON.parse(localStorage.getItem('timegrove-save-v1'));
        const act = document.querySelector('#bh-action:not([hidden])') || document.querySelector('.bh-sheet');
        const lim =
          Math.min(
            act ? act.getBoundingClientRect().top : H * 0.55,
            document.querySelector('#bh-palette').getBoundingClientRect().top
          ) - 30;
        const out = [];
        for (let z = 27; z >= 0; z--)
          for (let x = 0; x < 28; x++) {
            if (
              kind === 'raw'
                ? !new Function('s', 'C', 'x', 'z', `return ${pred}`)(s, C, x, z)
                : !C.canPlace(s, kind, type, x, z, null, item).ok
            )
              continue;
            const [px, py] = window.__village.debug.project(x, z);
            if (py > 140 && py < lim && px > 40 && px < innerWidth - 40) out.push([x, z]);
          }
        return out;
      },
      [kind, type, item, pred, height]
    );
  const confirmBtn = () => page.locator('[data-bact="confirm"]:not([disabled])');
  // put down whatever is still being placed
  const dropGhost = async () => {
    const cancel = page.locator('[data-bact="cancel"]');
    if (await cancel.first().isVisible()) await cancel.first().click();
  };
  const land = async () => (await save(page)).island.terrain.split('').filter(c => c !== '.').length;

  await page.locator('#build-button').click();
  await expect(page.locator('body')).toHaveClass(/build-mode/);

  // a bakery
  await page.locator('[data-tab="building"]').click();
  await page.locator('[data-bact="pick-building"][data-id="bakery"]').click();
  const bakery = await spots('building', 'bakery');
  expect(bakery.length).toBeGreaterThan(0);
  await tap(...bakery[Math.floor(bakery.length / 2)]);
  await expect(confirmBtn()).toBeVisible();
  await page.locator('[data-bact="rotate"]').click();
  await confirmBtn().click();
  await expect.poll(async () => (await save(page)).buildings.bakery).toBeTruthy();
  expect((await save(page)).layout.bakery).toBeTruthy();

  // three blossoms
  await page.locator('[data-tab="decor"]').click();
  await page.locator('[data-bact="pick-decor"][data-id="blossom"]').click();
  const blossoms = (await spots('decor', 'blossom')).filter((_, i) => i % 5 === 0).slice(0, 3);
  for (const [i, [x, z]] of blossoms.entries()) {
    await tap(x, z);
    await confirmBtn().click();
    await expect
      .poll(async () => (await save(page)).decor.filter(d => d.type === 'blossom').length)
      .toBe(i + 1);
  }

  // a display case holding the whale
  await dropGhost();
  await page.locator('[data-bact="pick-decor"][data-id="display"]').click();
  await page.locator('[data-bact="pick-item"][data-id="whale"]').click();
  await tap(...(await spots('decor', 'display', 'whale'))[2]);
  await confirmBtn().click();
  await expect.poll(async () => (await save(page)).decor.find(d => d.type === 'display')).toBeTruthy();
  await dropGhost();

  // terrain: reclaim sea next to the shore, then raise a grass tile
  await page.locator('[data-tab="terrain"]').click();
  await page.locator('[data-bact="pick-terrain"][data-id="reclaim"]').click();
  const before = await land();
  const sea = await spots(
    'raw',
    null,
    null,
    "s.island.terrain[z*28+x]==='.'&&[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>(s.island.terrain[(z+b)*28+x+a]||'.')!=='.')"
  );
  expect(sea.length).toBeGreaterThan(0);
  for (const t of sea.slice(0, 4)) await tap(...t);
  await expect.poll(land).toBeGreaterThan(before);
  await page.locator('[data-bact="pick-terrain"][data-id="raise"]').click();
  const grass = await spots('raw', null, null, "s.island.terrain[z*28+x]==='g'&&!C.objectAt(s,x,z)");
  const heights = async () => (await save(page)).island.height;
  const h0 = await heights();
  await tap(...grass[3]);
  await expect.poll(async () => (await heights()) !== h0).toBe(true);

  // manage: select the cottage and move it
  await page.locator('[data-tab="manage"]').click();
  await tap(13, 12);
  await expect(page.locator('#bh-action')).toBeVisible();
  const cottage = JSON.stringify((await save(page)).layout.cottage);
  await page.locator('[data-bact="move"]').click();
  const dest = await spots(
    'raw',
    null,
    null,
    "C.canPlace(s,'building','cottage',x,z,'b:cottage').ok&&Math.abs(x-13)+Math.abs(z-12)>3"
  );
  expect(dest.length).toBeGreaterThan(0);
  await tap(...dest[0]);
  await expect(confirmBtn()).toBeVisible();
  await confirmBtn().click();
  await expect.poll(async () => JSON.stringify((await save(page)).layout.cottage)).not.toBe(cottage);

  // leave build mode
  await page.locator('#bh-done').click();
  await expect(page.locator('body')).not.toHaveClass(/build-mode/);
  expect(errors()).toEqual([]);
});
