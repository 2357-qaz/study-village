// The plan for a focus session: written before starting (a draft that survives a reload), checked
// off while reading, carried into the journal when the session is recorded.
import {test, expect} from '@playwright/test';
import {prefs, openWithSave, dock, collectErrors, revealRoom, tapAt} from './helpers.mjs';

test('write a plan, start, check items off, see it in the journal', async ({page}) => {
  const errors = collectErrors(page);
  await prefs(page);
  await openWithSave(page);
  await dock(page, 'focus');
  const input = page.locator('#plan-input');
  for (const item of ['看完 3.1 节', '做 5 道题', '整理笔记']) {
    await input.fill(item);
    await input.press('Enter');
  }
  await expect(page.locator('#plan-draft li')).toHaveCount(3);
  // removing one, and the draft survives a reload
  await page.locator('[data-plan-remove="2"]').click();
  await page.reload();
  await dock(page, 'focus');
  await expect(page.locator('#plan-draft li')).toHaveCount(2);

  await page.locator('#start-button').click();
  await expect(page.locator('body')).toHaveClass(/reading-mode/);
  const items = page.locator('#plan-run .plan-item');
  await expect(items).toHaveCount(2);
  await tapAt(page, '#plan-run [data-plan="1"]');
  await expect(items.nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(items.nth(0)).toHaveAttribute('aria-checked', 'false');
  // the check is saved with the timer
  await page.reload();
  await dock(page, 'focus');
  await expect(page.locator('#plan-run .plan-item').nth(1)).toHaveAttribute('aria-checked', 'true');

  // finish after a minute (time moved on in the save), then the journal shows 1/2
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('timegrove-save-v1'));
    s.timer.runningSince -= 2 * 60000;
    localStorage.setItem('timegrove-save-v1', JSON.stringify(s));
  });
  await page.reload();
  await dock(page, 'focus');
  await revealRoom(page);
  await tapAt(page, '#finish-button');
  await expect(page.locator('body')).not.toHaveClass(/reading-mode/);
  await expect(page.locator('#plan-draft li')).toHaveCount(0); // the draft went with the session
  await dock(page, 'journal');
  await expect(page.locator('#all-sessions .session-row').first()).toContainText('计划 1/2');
  expect(errors()).toEqual([]);
});

test('a rest timer has no plan', async ({page}) => {
  await prefs(page, {planDraft: ['不该带上']});
  await openWithSave(page, {days: 2, minutes: 120});
  await dock(page, 'focus');
  await page.locator('#rest-tab').click();
  await expect(page.locator('#plan-edit')).toBeHidden();
  await page.locator('#start-button').click();
  await expect(page.locator('#reading-room')).toHaveClass(/resting/);
  await expect(page.locator('#plan-run')).toBeHidden();
});
