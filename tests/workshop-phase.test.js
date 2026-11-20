import test from 'node:test';
import assert from 'node:assert/strict';
import { workshopPhase, publicExhibition } from '../functions/_lib/exhibitions.js';

// 2026-11-20 12:00 Bangkok
const NOW = Date.parse('2026-11-20T12:00:00+07:00');
const base = { status: 'open', kind: 'workshop', accepting: 0, workshop_starts_on: '2027-02-15', workshop_ends_on: '2027-02-21' };

test('workshop phase: selecting before anything else', () => {
  assert.equal(workshopPhase(base, NOW), 'selecting');
});

test('workshop phase: signing while the acceptance page is open, until the end of the closing day', () => {
  const ex = { ...base, accept_open: 1, accept_closes_on: '2026-12-15' };
  assert.equal(workshopPhase(ex, NOW), 'signing');
  assert.equal(workshopPhase(ex, Date.parse('2026-12-15T23:30:00+07:00')), 'signing');
  assert.equal(workshopPhase(ex, Date.parse('2026-12-16T00:10:00+07:00')), 'selecting');
});

test('workshop phase: during and after the workshop days (Bangkok days)', () => {
  assert.equal(workshopPhase(base, Date.parse('2027-02-15T00:30:00+07:00')), 'during');
  assert.equal(workshopPhase(base, Date.parse('2027-02-21T23:00:00+07:00')), 'during');
  assert.equal(workshopPhase(base, Date.parse('2027-02-22T08:00:00+07:00')), 'after');
});

test('workshop phase: open application comes first', () => {
  const ex = { ...base, accepting: 1, submission_closes_at: '2026-12-01T00:00:00Z', cloudinary_cloud_name: 'x', cloudinary_upload_preset: 'p' };
  assert.equal(workshopPhase(ex, NOW), 'call');
});

test('public exhibition: kind defaults to exhibition, no phase for exhibitions', () => {
  const p = publicExhibition({ status: 'open' });
  assert.equal(p.kind, 'exhibition');
  assert.equal(p.workshop_phase, '');
  assert.equal(publicExhibition({ ...base }).workshop_phase !== '', true);
});
