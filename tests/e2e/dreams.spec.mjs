// Dreams read: the journal counts study sessions as dreams and numbers them; the reading room is
// painted again (new shells lit) once another session is finished.
import {test, expect} from '@playwright/test';
import {prefs, openWithSave, dock, collectErrors} from './helpers.mjs';

test('the journal numbers the dreams read', async ({page}) => {
  const errors = collectErrors(page);
  await prefs(page);
  await openWithSave(page, {days: 4, minutes: 30});
  await dock(page, 'journal');
  await expect(page.locator('#session-count')).toHaveText('4 个');
  await expect(page.locator('#all-sessions .session-row.dream')).toHaveCount(4);
  await expect(page.locator('#all-sessions .session-row.dream').first()).toContainText('第 4 个梦');
  await expect(page.locator('#all-sessions .session-row.dream').last()).toContainText('第 1 个梦');
  expect(errors()).toEqual([]);
});

test('finishing a session repaints the room with one more shell', async ({page}) => {
  await prefs(page);
  await openWithSave(page, {days: 2, minutes: 30});
  await dock(page, 'focus');
  const room = page.locator('#reading-room');
  await expect(room).toHaveClass(/ready/);
  await expect(room).toHaveAttribute('data-dreams', '2');
  // a session recorded by hand while on the room screen
  await page.locator('#manual-button').click();
  await page.locator('#manual-form [name="topic"]').fill('读梦');
  await page.locator('#manual-form [name="minutes"]').fill('40');
  await page.locator('#manual-form button[type="submit"]').click();
  await expect(page.locator('#manual-dialog')).not.toHaveAttribute('open', '');
  await expect(room).toHaveAttribute('data-dreams', '3', {timeout: 30_000});
});
