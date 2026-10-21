import test from 'node:test';
import assert from 'node:assert/strict';
import { submissionWindow, isPublic } from '../functions/_lib/exhibitions.js';

const base = { status: 'open', cloudinary_cloud_name: 'x', cloudinary_upload_preset: 'p',
  submission_opens_at: '2026-11-01T09:00:00+07:00', submission_closes_at: '2026-11-10T09:00:00+07:00' };
const at = (iso) => Date.parse(iso);

test('submissions follow the dates alone', () => {
  assert.equal(submissionWindow(base, at('2026-10-31T12:00:00+07:00')).phase, 'upcoming');
  assert.equal(submissionWindow(base, at('2026-11-05T12:00:00+07:00')).open, true);
  const ended = submissionWindow(base, at('2026-11-10T09:01:00+07:00'));
  assert.equal(ended.open, false);
  assert.equal(ended.phase, 'ended');
});

test('no closing date means no call for work; no opening date means it starts now', () => {
  assert.equal(submissionWindow({ ...base, submission_opens_at: null, submission_closes_at: null }).open, false);
  assert.equal(submissionWindow({ ...base, submission_opens_at: null }, at('2026-10-21T12:00:00+07:00')).open, true);
});

test('only an open (เปิด) exhibition accepts work', () => {
  for (const status of ['draft', 'archived', 'closed']) {
    assert.equal(submissionWindow({ ...base, status }, at('2026-11-05T12:00:00+07:00')).open, false);
  }
});

test('public: เปิด and ปิด; not ร่าง or ซ่อน', () => {
  assert.deepEqual(['draft', 'open', 'archived', 'closed'].map((status) => isPublic({ status })), [false, true, true, false]);
});
