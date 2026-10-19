// Dialogs: the item viewer frees its canvas on close, the opening story shows once and can be
// replayed, and the reading room's cancel-timer confirmation.
import {test, expect} from '@playwright/test';
import {prefs, openWithSave, dock, save, collectErrors, revealRoom, tapAt} from './helpers.mjs';

test('the item viewer frees its canvas when closed', async ({page}) => {
  const errors = collectErrors(page);
  await prefs(page);
  await openWithSave(page, {days: 1, collection: {whale: 1}});
  const canvases = () => page.locator('#item-viewer canvas').count();
  for (let i = 0; i < 2; i++) {
    await dock(page, 'wonders');
    await page.locator('#wonder-switch [data-page="collection"]').click();
    await page.locator('.collectible[data-item]').first().click();
    await expect.poll(canvases).toBe(1);
    await page.locator('#item-dialog [data-close="item-dialog"]').click();
    await expect.poll(canvases).toBe(0);
    // on desktop the collection sheet is modal and has its own close button; on phones the dock leads home
    const closeSheet = page.locator('#secondary-dialog [data-close="secondary-dialog"]');
    if (await closeSheet.isVisible()) await closeSheet.click();
    else await dock(page, 'village');
    await expect(page.locator('#secondary-dialog')).toHaveJSProperty('open', false);
  }
  expect(errors()).toEqual([]);
});

test('the opening story shows once and can be replayed from settings', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.locator('#story-dialog')).toHaveJSProperty('open', true);
  while (await page.evaluate(() => document.querySelector('#story-dialog').open)) {
    await page.locator('#story-next').click();
  }
  await expect(page.locator('#story-dialog')).toHaveJSProperty('open', false);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('timegrove-prefs')).storySeen)
  ).toBeTruthy();

  // it does not come back after a reload
  await page.reload();
  await expect(page.locator('#home-pages')).toHaveAttribute('data-screen', 'village');
  await page.waitForTimeout(2500);
  await expect(page.locator('#story-dialog')).toHaveJSProperty('open', false);

  // replay from settings
  await page
    .locator((await page.locator('#menu-button').isVisible()) ? '#menu-button' : '#dock-more')
    .click();
  await page.locator('#settings-button').click();
  await page.locator('#story-button').click();
  await expect(page.locator('#story-dialog')).toHaveJSProperty('open', true);
  await expect(page.locator('#story-title')).not.toBeEmpty();
  expect(errors()).toEqual([]);
});

test('cancelling a timer asks first', async ({page}) => {
  const errors = collectErrors(page);
  await prefs(page);
  await openWithSave(page, {days: 1});
  const timer = async () => !!(await save(page)).timer;
  await dock(page, 'focus');
  await expect(page.locator('#reading-room')).toHaveClass(/ready/);
  await page.locator('#start-button').click();
  await expect(page.locator('body')).toHaveClass(/reading-mode/);
  await expect.poll(timer).toBe(true);

  // "取消" in the confirmation keeps the timer
  await revealRoom(page);
  await tapAt(page, '#cancel-timer');
  await expect(page.locator('#confirm-dialog')).toHaveJSProperty('open', true);
  await page.locator('#confirm-no').click();
  await expect(page.locator('#confirm-dialog')).toHaveJSProperty('open', false);
  expect(await timer()).toBe(true);

  // "确认" clears it
  await revealRoom(page);
  await tapAt(page, '#cancel-timer');
  await page.locator('#confirm-yes').click();
  await expect.poll(timer).toBe(false);
  await expect(page.locator('body')).not.toHaveClass(/reading-mode/);
  expect(errors()).toEqual([]);
});
