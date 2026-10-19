// Backup reminders and timer alerts: the export nudge, its settings, the tab title, chime and
// notification when a timer finishes.
import {test, expect} from '@playwright/test';
import {dock, save, collectErrors} from './helpers.mjs';

// A village founded 30 days ago with 3h of study, never exported, on a device that has seen the story.
async function openOldVillage(page) {
  await page.goto('/?hour=11#village');
  await page.evaluate(async () => {
    const C = await import('./core.js');
    const now = Date.now(),
      s = C.initialState(now - 30 * 864e5);
    for (let i = 1; i <= 3; i++) C.manualStudy(s, 60, now - i * 864e5, '复习', now);
    localStorage.setItem('timegrove-save-v1', JSON.stringify(s));
    localStorage.removeItem('timegrove-prefs');
    localStorage.setItem('timegrove-prefs', JSON.stringify({storySeen: 1}));
  });
  await page.reload();
  await expect(page.locator('#home-pages')).toHaveAttribute('data-screen', 'village');
}
const openMenu = async page =>
  page.locator((await page.locator('#menu-button').isVisible()) ? '#menu-button' : '#dock-more').click();
const readPrefs = page => page.evaluate(() => JSON.parse(localStorage.getItem('timegrove-prefs')));

test.beforeEach(async ({context}) => {
  await context.grantPermissions(['notifications']);
  await context.addInitScript(() => {
    Object.defineProperty(Notification, 'permission', {configurable: true, get: () => 'granted'});
  });
});

test('the backup nudge, export and its settings', async ({page}) => {
  const errors = collectErrors(page);
  await openOldVillage(page);
  await expect(page.locator('#backup-nudge')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#backup-nudge-export').click()
  ]);
  expect(download.suggestedFilename()).toMatch(/^timegrove-\d{4}-\d\d-\d\d\.json$/);
  await expect(page.locator('#backup-nudge')).toBeHidden();
  await expect.poll(async () => (await readPrefs(page)).lastExportAt).toBeGreaterThan(0);
  expect((await readPrefs(page)).lastExportStudy).toBe(10800);

  // settings show the last export and keep the chosen interval
  await openMenu(page);
  await page.locator('#settings-button').click();
  await expect(page.locator('#backup-last')).toHaveText('今天已导出存档');
  await page.locator('#backup-every').selectOption('14');
  await expect.poll(async () => (await readPrefs(page)).backupEvery).toBe(14);
  await page.locator('#settings-dialog [data-close="settings-dialog"]').click();

  // "later" snoozes the nudge
  await page.evaluate(() =>
    localStorage.setItem('timegrove-prefs', JSON.stringify({backupEvery: 7, storySeen: 1}))
  );
  await page.reload();
  await expect(page.locator('#backup-nudge')).toBeVisible();
  await page.locator('#backup-nudge-later').click();
  await expect(page.locator('#backup-nudge')).toBeHidden();
  expect(errors()).toEqual([]);
});

test('a finished timer updates the title, chimes and notifies', async ({page}) => {
  const errors = collectErrors(page);
  await openOldVillage(page);
  // spy on the chime and on notifications
  await page.evaluate(() => {
    window.__notes = [];
    window.__osc = 0;
    const O = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      window.__osc++;
      return O.call(this);
    };
    const sn = ServiceWorkerRegistration.prototype.showNotification;
    ServiceWorkerRegistration.prototype.showNotification = function (t, o) {
      window.__notes.push(t);
      return sn.call(this, t, o);
    };
  });
  await dock(page, 'focus');
  await page.locator('#alert-notify').click();
  await expect(page.locator('#alert-notify')).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('./'))))
    .toBe(true);

  await page.locator('#start-button').click();
  await expect(page).toHaveTitle(/^⏱ \d\d:\d\d · 时光村落$/);

  // fast-forward: the running timer ends in ~2s, in a tab that pretends to be hidden
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('timegrove-save-v1'));
    s.timer.runningSince = Date.now() - (s.timer.goal - 2) * 1000;
    localStorage.setItem('timegrove-save-v1', JSON.stringify(s));
    Object.defineProperty(document, 'hidden', {configurable: true, get: () => true});
    window.dispatchEvent(new Event('focus'));
  });
  await expect.poll(() => page.title(), {timeout: 15_000}).toMatch(/^✓ 专注完成/);
  await expect.poll(() => page.evaluate(() => window.__osc)).toBeGreaterThanOrEqual(6);
  await expect.poll(() => page.evaluate(() => window.__notes)).toContain('这个旧梦读完了');
  expect(await save(page)).toBeTruthy();
  expect(errors()).toEqual([]);
});
