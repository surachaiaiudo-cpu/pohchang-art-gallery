import test from 'node:test';
import assert from 'node:assert/strict';
import { matchArtist, normName } from '../functions/_lib/artist-match.js';

test('same email + same name = same artist; another name = new artist (owner, 2026-11-12)', () => {
  const list = [{ id: 1, name_th: 'เนติ พิเคราะห์' }, { id: 2, name_th: 'Somchai  Jaidee' }];
  assert.equal(matchArtist(list, 'เนติ พิเคราะห์').id, 1);
  assert.equal(matchArtist(list, '  เนติ   พิเคราะห์ ').id, 1);
  assert.equal(matchArtist(list, 'somchai jaidee').id, 2);
  assert.equal(matchArtist(list, 'กมลวรรณ ศรีสุข'), null);
  assert.equal(matchArtist([], 'x'), null);
  assert.equal(normName('a​b'), 'ab');
});
