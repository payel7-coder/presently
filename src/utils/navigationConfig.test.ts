import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAttendanceTopbarContext,
  getActiveNavLabel,
  getNavItemsForRole,
} from './navigationConfig';

test('getNavItemsForRole returns full teacher navigation items in order', () => {
  const items = getNavItemsForRole('teacher');
  assert.deepEqual(
    items.map(i => i.id),
    ['my-subjects', 'take-attendance', 'assignments', 'form-fillup', 'reports', 'roster']
  );
  for (const item of items) {
    assert.ok(item.label.length > 0);
    assert.ok(item.shortLabel.length > 0);
    assert.ok(item.description.length > 0);
  }
});

test('getNavItemsForRole returns full admin navigation items in order', () => {
  const items = getNavItemsForRole('admin');
  assert.deepEqual(
    items.map(i => i.id),
    ['admin-assignments', 'admin-classes', 'assignments', 'form-fillup', 'reports']
  );
  for (const item of items) {
    assert.ok(item.label.length > 0);
    assert.ok(item.shortLabel.length > 0);
    assert.ok(item.description.length > 0);
  }
});

test('getActiveNavLabel resolves short labels for nav tabs and secondary profile routes', () => {
  assert.equal(getActiveNavLabel('admin', 'admin-assignments'), 'Allocate');
  assert.equal(getActiveNavLabel('admin', 'reports'), 'Reports');
  assert.equal(getActiveNavLabel('teacher', 'take-attendance'), 'Roll Call');
  assert.equal(getActiveNavLabel('teacher', 'user-profile'), 'Profile');
  assert.equal(getActiveNavLabel('admin', 'student-profile'), 'Student');
  assert.equal(getActiveNavLabel('admin', 'unknown-tab'), '');
});

test('formatAttendanceTopbarContext formats subject code and date cleanly', () => {
  assert.equal(formatAttendanceTopbarContext('21011', '2026-11-26'), '21011 · 2026-11-26');
  assert.equal(formatAttendanceTopbarContext(' 28561 ', ' 2026-11-25 '), '28561 · 2026-11-25');
  assert.equal(formatAttendanceTopbarContext('21011', ''), '21011');
  assert.equal(formatAttendanceTopbarContext('', '2026-11-26'), '2026-11-26');
  assert.equal(formatAttendanceTopbarContext(undefined, null), '');
});
