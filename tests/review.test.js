import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tally, isEndorsed } from '../functions/_lib/review.js';

const votes = (...d) => d.map((decision) => ({ decision }));
const run = (eligible, ...d) => tally({ threshold: 3, eligible, votes: votes(...d) }).result;

test('3 of 5 approvals earns the badge', () => {
  assert.equal(run(5, 'approve', 'approve'), 'pending');
  assert.equal(run(5, 'approve', 'approve', 'approve'), 'endorsed');
  assert.equal(run(5, 'approve', 'approve', 'reject', 'reject', 'approve'), 'endorsed');
});

test('3 rejections out of 5 closes the work without a badge', () => {
  assert.equal(run(5, 'reject', 'reject'), 'pending');
  assert.equal(run(5, 'reject', 'reject', 'reject'), 'not_endorsed');
  assert.equal(run(5, 'approve', 'approve', 'reject', 'reject', 'reject'), 'not_endorsed');
});

test('abstentions that leave fewer than 3 voters go to the curator', () => {
  assert.equal(run(5, 'abstain', 'abstain'), 'pending');
  assert.equal(run(5, 'abstain', 'abstain', 'abstain'), 'needs_curator');
  // two abstain, then one reject: 3 voters left, max 2 approvals possible -> cannot reach 3
  assert.equal(run(5, 'abstain', 'abstain', 'reject'), 'not_endorsed');
  assert.equal(run(5, 'abstain', 'abstain', 'approve', 'approve', 'approve'), 'endorsed');
});

test('a panel smaller than the threshold needs the curator', () => {
  assert.equal(run(2), 'needs_curator');
  assert.equal(run(0), 'needs_curator');
});

test('curator override wins over the panel', () => {
  assert.equal(isEndorsed('not_endorsed', 'endorsed'), true);
  assert.equal(isEndorsed('endorsed', 'not_endorsed'), false);
  assert.equal(isEndorsed('endorsed', null), true);
  assert.equal(isEndorsed('pending', null), false);
});
