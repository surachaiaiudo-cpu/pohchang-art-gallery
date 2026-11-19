import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planNumbers, compareForNumber, formatNo, CHANNEL_KEYS, ROSTER_KEYS, STAGE_KEYS } from '../public/js/roster-logic.js';

const A = (id, name_en, nationality, extra = {}) => ({ id, name_th: extra.name_th || name_en, name_en, nationality, roster: 'selected', withdrawn: 0, artist_no: null, ...extra });

test('foreign artists first by country (English A–Z), then by English name; Thai artists last', () => {
  const list = [
    A(1, 'Somchai Dee', 'TH'),
    A(2, 'Nguyen Van A', 'VN'),
    A(3, 'Aiko Sato', 'JP'),
    A(4, 'Anan Boon', 'TH'),
    A(5, 'Bao Tran', 'VN'),
    A(6, 'Jane Doe', 'AU')
  ];
  const { plan } = planNumbers(list);
  // Australia, Japan, Vietnam (Bao before Nguyen), then Thai (Anan before Somchai)
  assert.deepEqual(plan.map((p) => p.id), [6, 3, 5, 2, 4, 1]);
  assert.deepEqual(plan.map((p) => p.artist_no), [1, 2, 3, 4, 5, 6]);
});

test('Thai artist without an English name sorts by the Thai name; unknown country goes before Thai', () => {
  const list = [A(1, '', 'TH', { name_th: 'ข' }), A(2, '', 'TH', { name_th: 'ก' }), A(3, 'Zed', 'Atlantis'), A(4, 'Amy', 'US')];
  assert.deepEqual(planNumbers(list).plan.map((p) => p.id), [4, 3, 2, 1]);
});

test('only selected, not withdrawn, without a number; existing numbers stay and new ones continue', () => {
  const list = [
    A(1, 'Kept', 'TH', { artist_no: 7 }),
    A(2, 'Out', 'TH', { withdrawn: 1 }),
    A(3, 'Wait', 'TH', { roster: '' }),
    A(4, 'New', 'GB'),
    A(5, 'Gone', 'TH', { withdrawn: 1, artist_no: 3 })
  ];
  const r = planNumbers(list);
  assert.deepEqual(r.plan, [{ id: 4, artist_no: 8 }]);
  assert.equal(r.appended, true);
});

test('Kurdistan (XR) counts as a foreign country', () => {
  const r = planNumbers([A(1, 'B', 'TH'), A(2, 'A', 'XR')]);
  assert.deepEqual(r.plan.map((p) => p.id), [2, 1]);
});

test('compare is stable on equal names (id)', () => {
  assert.ok(compareForNumber(A(1, 'Same', 'TH'), A(2, 'same', 'TH')) < 0);
});

test('formatNo pads to three digits', () => {
  assert.equal(formatNo(5), '005');
  assert.equal(formatNo(123), '123');
  assert.equal(formatNo(null), '');
});

test('keys', () => {
  assert.deepEqual(CHANNEL_KEYS, [0, 1, 2, 3, 4]);
  assert.deepEqual(ROSTER_KEYS, ['', 'selected', 'not_selected']);
  assert.deepEqual(STAGE_KEYS, ['exhibit', 'selection']);
});
