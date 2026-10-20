// The reading room: immersive view while a timer runs, wake lock, pause/resume clock, exit and
// return, cancel, and the rest timer's style.
import {test, expect} from '@playwright/test';
import {prefs, openWithSave, dock, bodyHas, collectErrors, revealRoom, tapAt} from './helpers.mjs';

test('reading view follows the timer', async ({page}) => {
  const errors = collectErrors(page);
  await prefs(page);
  // a wake lock that only counts how many are held
  await page.addInitScript(() => {
    window.__wake = 0;
    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        request: async () => {
          window.__wake++;
          const t = new EventTarget();
          t.release = async () => {
            window.__wake--;
            t.dispatchEvent(new Event('release'));
          };
          return t;
        }
      }
    });
  });
  await openWithSave(page);
  await dock(page, 'focus');
  await expect(page.locator('#reading-room')).toHaveClass(/ready/);
  expect(await bodyHas(page, 'reading-mode')).toBe(false);

  await page.locator('#wake-toggle').click();
  await expect(page.locator('#wake-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#start-button').click();
  await expect(page.locator('body')).toHaveClass(/reading-mode/);
  await expect.poll(() => page.evaluate(() => window.__wake)).toBe(1);

  // pausing stops the wall clock, resuming starts it again
  const minuteHand = () =>
    page.evaluate(() => getComputedStyle(document.querySelector('#reading-room')).getPropertyValue('--ma'));
  await revealRoom(page);
  await tapAt(page, '#pause-button');
  await page.waitForTimeout(300);
  const a1 = await minuteHand();
  await page.waitForTimeout(2500);
  expect(await minuteHand()).toBe(a1);
  await revealRoom(page);
  await tapAt(page, '#pause-button');
  await expect.poll(minuteHand, {timeout: 5000}).not.toBe(a1);

  // leaving the room keeps the timer but drops the immersive view and the wake lock
  await revealRoom(page);
  await tapAt(page, '#room-exit');
  await expect(page.locator('body')).not.toHaveClass(/reading-mode/);
  await expect.poll(() => page.evaluate(() => window.__wake)).toBe(0);
  await dock(page, 'focus');
  await expect(page.locator('body')).toHaveClass(/reading-mode/);

  // cancelling ends it
  await revealRoom(page);
  await tapAt(page, '#cancel-timer');
  await page.locator('#confirm-yes').click();
  await expect(page.locator('body')).not.toHaveClass(/reading-mode/);

  // a rest timer has its own look
  await page.locator('#rest-tab').click();
  await page.locator('#start-button').click();
  await expect(page.locator('#reading-room')).toHaveClass(/resting/);
  expect(errors()).toEqual([]);
});

test('the companion greets a reader back after a long absence', async ({page}) => {
  await prefs(page);
  await page.goto('/');
  await page.evaluate(async () => {
    const C = await import('./core.js');
    const now = Date.now(),
      s = C.initialState(now - 30 * 864e5);
    for (let i = 5; i <= 8; i++) C.manualStudy(s, 90, now - i * 864e5, 'x', now);
    localStorage.setItem('timegrove-save-v1', JSON.stringify(s));
  });
  await page.reload();
  await dock(page, 'focus');
  await expect(page.locator('#room-say')).toHaveClass(/on/);
  await expect(page.locator('#room-say')).toContainText('你回来啦');
  await expect(page.locator('.companion-img.on')).toHaveCount(1);
});
