// Lifecycle edge cases: the opening story waits for a quiet moment, a late wake lock is released,
// the reading room's caches stay bounded across resizes, and a WebGL failure recovers.
import {test, expect} from '@playwright/test';
import {prefs, dock, collectErrors, revealRoom, tapAt} from './helpers.mjs';

const storyOpen = page => page.evaluate(() => document.querySelector('#story-dialog').open);

test('the opening story waits for the running timer to end', async ({page}) => {
  const errors = collectErrors(page);
  await prefs(page);
  await page.goto('/');
  await dock(page, 'focus');
  await expect(page.locator('#reading-room')).toHaveClass(/ready/);
  await page.locator('#start-button').click();
  await expect(page.locator('body')).toHaveClass(/reading-mode/);

  // a new version: the story has not been seen on this device, and the page reloads mid-session
  await page.evaluate(() => localStorage.setItem('timegrove-prefs', '{}'));
  await page.reload();
  await expect(page.locator('#reading-room')).toHaveClass(/ready/);
  // give the story every chance to appear
  await page.waitForTimeout(2500);
  expect(await storyOpen(page)).toBe(false);

  await page.evaluate(() => document.querySelector('#room-exit').click());
  await expect(page.locator('body')).not.toHaveClass(/reading-mode/);
  await page.waitForTimeout(1500);
  expect(await storyOpen(page)).toBe(false);

  // cancelling the timer frees the story
  await dock(page, 'focus');
  await revealRoom(page);
  await tapAt(page, '#cancel-timer');
  await page.locator('#confirm-yes').click();
  await expect.poll(() => storyOpen(page), {timeout: 20_000}).toBe(true);
  expect(errors()).toEqual([]);
});

test('a wake lock granted after leaving the room is released', async ({page}) => {
  const errors = collectErrors(page);
  await prefs(page, {wakeLock: 1});
  // the lock arrives 1.2s after it was requested
  await page.addInitScript(() => {
    window.__held = 0;
    window.__req = 0;
    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        request: () => {
          window.__req++;
          return new Promise(r =>
            setTimeout(() => {
              window.__held++;
              const t = new EventTarget();
              t.release = async () => {
                window.__held--;
                t.dispatchEvent(new Event('release'));
              };
              r(t);
            }, 1200)
          );
        }
      }
    });
  });
  await page.goto('/');
  await dock(page, 'focus');
  await expect(page.locator('#reading-room')).toHaveClass(/ready/);
  await page.locator('#start-button').click();
  await expect.poll(() => page.evaluate(() => window.__req)).toBe(1);
  // leave while the request is still pending
  await page.evaluate(() => document.querySelector('#room-exit').click());
  await expect(page.locator('body')).not.toHaveClass(/reading-mode/);
  // wait for the late grant to land, then it must have been let go again
  await page.waitForTimeout(2000);
  expect(await page.evaluate(() => window.__held)).toBe(0);

  await dock(page, 'focus');
  await expect.poll(() => page.evaluate(() => window.__held), {timeout: 20_000}).toBe(1);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__held)).toBe(1);
  expect(errors()).toEqual([]);
});

test('resizing many times keeps the room cache and GPU objects bounded', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'resizes the window itself');
  test.setTimeout(180_000);
  const errors = collectErrors(page);
  await prefs(page);
  await page.goto('/');
  await dock(page, 'focus');
  await expect(page.locator('#reading-room')).toHaveClass(/ready/, {timeout: 30_000});

  // import the exact module URL the app loaded, so the cache inspected is the live one
  const stats = () =>
    page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').find(e => /reading-room\.js/.test(e.name)).name;
      return (await import(url)).debug();
    });
  const sizes = [
    [700, 900],
    [900, 700],
    [640, 960],
    [1000, 760],
    [720, 880],
    [960, 720],
    [680, 940],
    [1040, 780]
  ];
  let first = null;
  for (const [i, [w, h]] of sizes.entries()) {
    await page.setViewportSize({width: w, height: h});
    await expect(page.locator('#reading-room')).toHaveClass(/ready/, {timeout: 30_000});
    // the room re-renders after a debounce; let each size settle
    await page.waitForTimeout(1500);
    if (i === 1) first = await stats();
  }
  const last = await stats();
  expect(last.cache).toBeLessThanOrEqual(7);
  expect(last.memory.textures).toBeLessThanOrEqual(first.memory.textures + 1);
  expect(last.memory.geometries).toBeLessThanOrEqual(first.memory.geometries + 2);
  expect(errors()).toEqual([]);
});

test('the room recovers after WebGL fails twice', async ({page}) => {
  const errors = collectErrors(page);
  await prefs(page);
  await page.addInitScript(() => {
    window.__fail = 0;
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, ...a) {
      if (window.__fail > 0 && /webgl/.test(t)) {
        window.__fail--;
        return null;
      }
      return orig.call(this, t, ...a);
    };
  });
  await page.goto('/');
  await expect(page.locator('#home-pages')).toHaveAttribute('data-screen', 'village');
  await page.waitForTimeout(1500); // the village has its context
  await page.evaluate(() => (window.__fail = 2));
  await dock(page, 'focus');
  await expect(page.locator('#reading-room')).toHaveClass(/no-room/);
  // it retries by itself
  await expect(page.locator('#reading-room')).toHaveClass(/ready/, {timeout: 25_000});
  await expect(page.locator('#reading-room')).not.toHaveClass(/no-room/);
  await expect(page.locator('.companion-img.on')).toHaveCount(1);
  expect(errors()).toEqual([]);
});
