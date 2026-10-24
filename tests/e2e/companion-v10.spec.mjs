import {test, expect} from '@playwright/test';
import {prefs, dock} from './helpers.mjs';

test('V10 real WebGL timer renders reading and completed-timer tea', async ({page}, info) => {
  const now = Date.UTC(2026, 9, 24, 8);
  await page.clock.setFixedTime(now);
  await prefs(page);
  const errors = [],
    loaded = new Set();
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => {
    if (/companion-v10\.(json|bin)/.test(r.url()) && r.ok()) loaded.add(new URL(r.url()).pathname);
  });
  await page.goto('/?companion=v10&hour=16');
  expect(
    await page.evaluate(() => {
      const c = document.createElement('canvas'),
        gl = c.getContext('webgl2');
      const usable = !!gl && !gl.isContextLost();
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      return usable;
    })
  ).toBe(true);
  await dock(page, 'focus');
  await expect(page.locator('#reading-room')).toHaveClass(/ready/);
  await expect
    .poll(() => [...loaded].sort())
    .toEqual(['/assets/companion-v10.bin', '/assets/companion-v10.json']);
  await expect(page.locator('.companion-img.on')).toHaveCount(1);
  await page.locator('#start-button').click();
  await expect(page.locator('#focus-status')).toHaveText('专注进行中');
  const visiblePixels = () =>
    page.locator('.companion-img.on').evaluate(image => {
      if (!image.complete || !image.naturalWidth) return 0;
      const c = document.createElement('canvas');
      c.width = image.naturalWidth;
      c.height = image.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
      let count = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 100) count++;
      return count;
    });
  await expect.poll(visiblePixels).toBeGreaterThan(100);
  const readImage = await page.locator('.companion-img.on').getAttribute('src');
  const manifest = await page.evaluate(async () => {
    const {loadSculpt} = await import('./sculpt-loader.js?v=1');
    return (await loadSculpt('./assets/', 'v10')).manifest;
  });
  expect(manifest.generator).toBe('blender-v10-curved-rear-hair-chin');
  expect(manifest.teaPropStyle).toBe('camera-v7');
  const readPath = info.outputPath('v10-timer-reading.png');
  await page.screenshot({path: readPath});
  await info.attach('V10 actual timer reading', {path: readPath, contentType: 'image/png'});
  await page.clock.setFixedTime(now + 31 * 60000);
  await expect(page.locator('#focus-status')).toHaveText('等待打卡');
  await expect.poll(() => page.locator('.companion-img.on').getAttribute('src')).not.toBe(readImage);
  await expect.poll(visiblePixels).toBeGreaterThan(100);
  const teaPath = info.outputPath('v10-timer-tea.png');
  await page.screenshot({path: teaPath});
  await info.attach('V10 actual timer tea', {path: teaPath, contentType: 'image/png'});
  expect(errors).toEqual([]);
});
