// Terrain tools in build mode: drag to reclaim, level and raise, one step per tile per stroke, no
// change without materials, and camera rotation. Phones drag with touch; desktops also check that
// right-drag and Shift+drag rotate instead of painting.
import {test, expect} from '@playwright/test';
import {prefs, save, collectErrors} from './helpers.mjs';

test('reclaiming, levelling and raising by dragging', async ({page}, testInfo) => {
  const errors = collectErrors(page);
  const touch = testInfo.project.name === 'phone';
  const {width, height} = page.viewportSize();
  await prefs(page);
  await page.goto('/?hour=12');
  await page.evaluate(async () => {
    const C = await import('./core.js');
    const s = C.initialState(Date.now() - 864e5);
    s.resources = {wood: 9999, stone: 9999, food: 9999, stars: 9999};
    localStorage.setItem('timegrove-save-v1', JSON.stringify(s));
  });
  const openTerrain = async () => {
    await page.reload();
    await page.waitForFunction(() => window.__village?.debug);
    await page.locator('#build-button').click();
    await page.locator('[data-tab="terrain"]').click();
    // zoom in so a tile is easy to hit
    await page.mouse.move(width / 2, height * 0.3);
    await page.mouse.wheel(0, 500);
  };
  await openTerrain();
  const proj = (x, z) => page.evaluate(([x, z]) => window.__village.debug.project(x, z), [x, z]);

  // a shore row: land (h0) at x0, interior h1 at x0-1, sea at x0+1..x0+3 (in some direction)
  const s0 = await save(page);
  const T = s0.island.terrain,
    H = s0.island.height;
  const occ = new Set(
    await page.evaluate(async s => [...(await import('./core.js')).occupancy(s).keys()], s0)
  );
  let pick = null;
  outer: for (const [dx, dz] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ])
    for (let z = 2; z < 26; z++)
      for (let x = 2; x < 26; x++) {
        const at = k => (z + k * dz) * 28 + (x + k * dx);
        if (
          [-1, 0].every(k => !occ.has(at(k)) && T[at(k)] !== '.') &&
          H[at(-1)] === '1' &&
          [1, 2, 3].every(k => T[at(k)] === '.') &&
          x + 3 * dx >= 1 &&
          x + 3 * dx <= 26 &&
          z + 3 * dz >= 1 &&
          z + 3 * dz <= 26
        ) {
          pick = {x0: x, z0: z, dx, dz};
          break outer;
        }
      }
  expect(pick).toBeTruthy();
  const {x0, z0, dx, dz} = pick;
  const idx = k => (z0 + k * dz) * 28 + (x0 + k * dx);
  const line = async (ka, kb) => [
    await proj(x0 + ka * dx, z0 + ka * dz),
    await proj(x0 + kb * dx, z0 + kb * dz)
  ];
  const rows = (s, ks) => ks.map(k => s.island.height[idx(k)]).join('');

  const cdp = touch ? await page.context().newCDPSession(page) : null;
  const touchAt = p => [{x: p[0], y: p[1], id: 1}];
  // a stroke through the points: a finger on phones, the mouse elsewhere
  const drag = async (pts, opts = {}) => {
    if (touch) {
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: touchAt(pts[0])});
      for (const p of pts.slice(1)) {
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: touchAt(p)});
        await page.waitForTimeout(40);
      }
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    } else {
      if (opts.shift) await page.keyboard.down('Shift');
      await page.mouse.move(...pts[0]);
      await page.mouse.down({button: opts.button || 'left'});
      for (const p of pts.slice(1)) await page.mouse.move(...p, {steps: 6});
      await page.mouse.up({button: opts.button || 'left'});
      if (opts.shift) await page.keyboard.up('Shift');
    }
    // the stroke is applied as it ends; give the save a moment
    await page.waitForTimeout(500);
  };

  // 1) reclaim three sea tiles by dragging across them
  await page.locator('[data-id="reclaim"]').click();
  await drag(await line(1, 3));
  const s1 = await save(page);
  expect([1, 2, 3].map(k => [s1.island.terrain[idx(k)], s1.island.height[idx(k)]])).toEqual(
    Array(3).fill(['s', '0'])
  );

  // 2) level from the interior tile across the new sand: all five end at height 1, four steps paid
  await page.locator('[data-id="level"]').click();
  await drag(await line(-1, 3));
  const s2 = await save(page);
  expect(rows(s2, [-1, 0, 1, 2, 3])).toBe('11111');
  expect(s1.resources.stone - s2.resources.stone).toBe(16);

  // 3) levelling the same area again costs nothing
  await drag(await line(0, 3));
  expect((await save(page)).resources.stone).toBeGreaterThanOrEqual(s2.resources.stone);

  // 4) a tap raises exactly one step
  await page.locator('[data-id="raise"]').click();
  const pt = await proj(x0 + 2 * dx, z0 + 2 * dz);
  if (touch) {
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: touchAt(pt)});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  } else await page.mouse.click(...pt);
  await expect.poll(async () => (await save(page)).island.height[idx(2)]).toBe('2');

  // 5) a stroke raises each tile one step, even going back and forth
  const [a, b] = await line(0, 3);
  await drag([a, b, a, b]);
  const s5 = await save(page);
  const h5 = rows(s5, [0, 1, 2, 3]);
  expect(h5).toBe('2232');

  // 6) with no stone the stroke changes nothing and says why
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('timegrove-save-v1'));
    s.resources.stone = 0;
    localStorage.setItem('timegrove-save-v1', JSON.stringify(s));
  });
  await openTerrain();
  await page.locator('[data-id="raise"]').click();
  await drag(await line(0, 3));
  await expect(page.locator('#toast')).toContainText('建材');
  expect(rows(await save(page), [0, 1, 2, 3])).toBe(h5);

  // 7) with no tool, dragging rotates the camera
  await page
    .locator('[data-bact="cancel"]:visible')
    .first()
    .click()
    .catch(() => {});
  await page.locator('[data-tab="manage"]').click();
  const moved = async (pts, opts) => {
    const before = await proj(16, 16);
    await drag(pts, opts);
    const after = await proj(16, 16);
    return Math.hypot(before[0] - after[0], before[1] - after[1]);
  };
  const sx = width / 2,
    sy = height * 0.4;
  expect(
    await moved([
      [sx, sy],
      [sx + 120, sy + 10]
    ])
  ).toBeGreaterThan(20);

  if (!touch) {
    // 8) with a terrain tool, right-drag and Shift+drag rotate instead of painting
    await page.locator('[data-tab="terrain"]').click();
    await page.locator('[data-id="g"]').click();
    const painted = (await save(page)).island.terrain;
    expect(
      await moved(
        [
          [sx, sy],
          [sx + 120, sy + 10]
        ],
        {button: 'right'}
      )
    ).toBeGreaterThan(20);
    expect(
      await moved(
        [
          [sx, sy],
          [sx - 120, sy]
        ],
        {shift: true}
      )
    ).toBeGreaterThan(20);
    expect((await save(page)).island.terrain).toBe(painted);
  }
  expect(errors()).toEqual([]);
});
