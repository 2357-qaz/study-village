// The plan for a focus session: written before starting (a draft that survives a reload), checked
// off while reading, carried into the journal when the session is recorded.
import {test, expect} from '@playwright/test';
import {prefs, openWithSave, dock, collectErrors, revealRoom, tapAt} from './helpers.mjs';

test('write a plan, start, check items off, see it in the journal', async ({page}) => {
  test.setTimeout(240_000); // three reloads into the reading room, slow in the software renderer
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
  await expect(page.locator('#plan-meter')).toContainText('计划 0/2');
  await tapAt(page, '#plan-run [data-plan="1"]');
  await expect(items.nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#plan-meter')).toContainText('计划 1/2');
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
  // the unfinished item comes back as the next draft; star sand includes the plan's share
  await expect(page.locator('#plan-draft li')).toHaveCount(1);
  await expect(page.locator('#plan-draft li').first()).toContainText('看完 3.1 节');
  await expect(page.locator('#toast')).toContainText('计划的奖励');
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

test('the last plan can be taken up again, and a cancelled timer gives its plan back', async ({page}) => {
  const errors = collectErrors(page);
  await prefs(page);
  await openWithSave(page);
  // a finished session with a plan, recorded in the save
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('timegrove-save-v1')),
      end = Date.now() - 3600000;
    s.sessions.push({
      id: 'p1',
      kind: 'study',
      topic: '线代',
      segments: [{start: end - 25 * 60000, end}],
      seconds: 1500,
      endedAt: end,
      recordedAt: end,
      manual: false,
      plan: [
        {text: '背单词', done: true},
        {text: '做题', done: false}
      ]
    });
    localStorage.setItem('timegrove-save-v1', JSON.stringify(s));
  });
  await page.reload();
  await dock(page, 'focus');
  const reuse = page.locator('#plan-reuse');
  await expect(reuse).toContainText('沿用上次的计划 · 2 项');
  await reuse.click();
  await expect(page.locator('#plan-draft li')).toHaveCount(2);
  await expect(reuse).toBeHidden();

  await page.locator('#start-button').click();
  await expect(page.locator('#plan-run .plan-item')).toHaveCount(2);
  await tapAt(page, '#plan-run [data-plan="0"]');
  await expect(page.locator('#plan-run .plan-item').first()).toHaveAttribute('aria-checked', 'true');
  await revealRoom(page);
  await tapAt(page, '#cancel-timer');
  await page.locator('#confirm-yes').click();
  await expect(page.locator('body')).not.toHaveClass(/reading-mode/);
  await expect(page.locator('#plan-draft li')).toHaveCount(1);
  await expect(page.locator('#plan-draft li').first()).toContainText('做题');
  expect(errors()).toEqual([]);
});
