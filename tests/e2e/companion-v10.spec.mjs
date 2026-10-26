import {test, expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {prefs, dock} from './helpers.mjs';

const v10Manifest = JSON.parse(
  await fs.readFile(new URL('../../dist/assets/companion-v10.json', import.meta.url))
);

test('V10 real WebGL timer renders read, look, turn and completed-timer tea', async ({page}, info) => {
  const now = Date.UTC(2026, 9, 24, 8);
  await page.clock.setFixedTime(now);
  await prefs(page);
  const errors = [],
    loaded = new Set();
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => {
    if (/companion-v10[.]/.test(r.url()) && r.ok()) loaded.add(new URL(r.url()).pathname);
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
  await expect(page.locator('#reading-room')).toHaveClass(/ready/, {timeout: 90_000});
  await expect
    .poll(() => [...loaded].sort())
    .toEqual([`/assets/${v10Manifest.compressed.file}`, '/assets/companion-v10.json'].sort());
  await expect(page.locator('.companion-img.on')).toHaveCount(1);
  await page.locator('#start-button').click();
  await expect(page.locator('#focus-status')).toHaveText('专注进行中');
  const capture = async pose => {
    await expect(page.locator('.companion-img.on')).toHaveAttribute('data-pose', pose);
    await expect(page.locator('.companion-img.on')).toHaveCSS('opacity', '1');
    const path = info.outputPath(`v10-timer-${pose}.png`);
    await page.screenshot({path});
    await info.attach(`V10 actual timer ${pose}`, {path, contentType: 'image/png'});
  };
  await capture('look');
  // Date.now() is fixed: advance past the 3.5s greeting so this is really reading.
  await page.clock.setFixedTime(now + 5000);
  await expect(page.locator('.companion-img.on')).toHaveAttribute('data-pose', 'read');
  await expect(page.locator('.companion-img.on')).toHaveCSS('opacity', '1');
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
  const active = await page.evaluate(async () => {
    const {debug} = await import('./reading-room.js?v=7');
    return debug();
  });
  expect(active.companion).toBe('blender-v10-curved-rear-hair-chin');
  await expect(page.locator('#toast')).not.toHaveClass(/visible/);
  await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
  const readPath = info.outputPath('v10-timer-reading.png');
  await page.screenshot({path: readPath});
  await info.attach('V10 actual timer reading', {path: readPath, contentType: 'image/png'});
  // The normal behavior schedules page turning 50–110 seconds after starting.
  await page.clock.setFixedTime(now + 120000);
  await capture('turn');
  await expect.poll(visiblePixels).toBeGreaterThan(100);
  await page.clock.setFixedTime(now + 31 * 60000);
  await expect(page.locator('#focus-status')).toHaveText('等待打卡');
  await expect(page.locator('.companion-img.on')).toHaveAttribute('data-pose', 'tea');
  await expect(page.locator('.companion-img.on')).toHaveCSS('opacity', '1');
  await expect.poll(visiblePixels).toBeGreaterThan(100);
  await expect(page.locator('#toast')).not.toHaveClass(/visible/);
  await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
  const teaPath = info.outputPath('v10-timer-tea.png');
  await page.screenshot({path: teaPath});
  await info.attach('V10 actual timer tea', {path: teaPath, contentType: 'image/png'});
  const metadata = await page.evaluate(async () => {
    const {debug} = await import('./reading-room.js?v=7');
    return {
      userAgent: navigator.userAgent,
      viewport: [innerWidth, innerHeight],
      devicePixelRatio,
      backend: 'CI configuration: Chromium / SwiftShader (software, not iPhone Safari)',
      ...debug()
    };
  });
  await fs.writeFile(info.outputPath('v10-render-metadata.json'), JSON.stringify(metadata, null, 2));
  expect(errors).toEqual([]);
});
