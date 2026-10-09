import {test} from 'node:test';
import assert from 'node:assert/strict';
import {backupDue, describeLastExport, timerTitle} from '../dist/alerts.js';

const DAY = 24 * 3600 * 1000;
const now = Date.UTC(2026, 9, 9, 12);
const prefs = (patch = {}) => ({
  backupEvery: 7,
  lastExportAt: 0,
  lastExportStudy: 0,
  snoozeUntil: 0,
  ...patch
});

test('从未导出：建村满一周且学习满 1 小时才提醒', () => {
  assert.equal(backupDue(prefs(), {createdAt: now - 3 * DAY, studySeconds: 20 * 3600}, now), null);
  assert.equal(backupDue(prefs(), {createdAt: now - 30 * DAY, studySeconds: 1800}, now), null);
  assert.deepEqual(backupDue(prefs(), {createdAt: now - 30 * DAY, studySeconds: 7200}, now), {
    days: 30,
    newStudy: 7200,
    never: true
  });
});

test('导出后按间隔与新增学习时长计算', () => {
  const p = prefs({lastExportAt: now - 8 * DAY, lastExportStudy: 10 * 3600});
  assert.equal(backupDue(p, {createdAt: 0, studySeconds: 10 * 3600 + 1200}, now), null);
  assert.deepEqual(backupDue(p, {createdAt: 0, studySeconds: 12 * 3600}, now), {
    days: 8,
    newStudy: 7200,
    never: false
  });
  assert.equal(backupDue({...p, backupEvery: 14}, {createdAt: 0, studySeconds: 12 * 3600}, now), null);
});

test('关闭提醒与“过几天再说”', () => {
  const state = {createdAt: now - 30 * DAY, studySeconds: 9 * 3600};
  assert.equal(backupDue(prefs({backupEvery: 0}), state, now), null);
  assert.equal(backupDue(prefs({snoozeUntil: now + DAY}), state, now), null);
  assert.ok(backupDue(prefs({snoozeUntil: now - 1}), state, now));
});

test('上次导出描述', () => {
  assert.equal(describeLastExport(prefs(), now), '尚未导出过存档');
  assert.equal(describeLastExport(prefs({lastExportAt: now - 3600}), now), '今天已导出存档');
  assert.equal(describeLastExport(prefs({lastExportAt: now - 3 * DAY - 5}), now), '上次导出：3 天前');
});

test('标签页标题倒计时', () => {
  assert.equal(timerTitle(null, 0, '时光村落'), '时光村落');
  assert.equal(timerTitle({kind: 'study', runningSince: 1}, 754, 'x'), '⏱ 12:34 · 时光村落');
  assert.equal(timerTitle({kind: 'study', runningSince: null}, 60, 'x'), '⏸ 01:00 · 时光村落');
  assert.equal(timerTitle({kind: 'rest', runningSince: 1}, 0, 'x'), '✓ 休息结束 · 时光村落');
});
