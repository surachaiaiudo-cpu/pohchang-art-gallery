import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CATEGORIES, parseCategories, normalizeCategories, checkCategory, needsVideo } from '../functions/_lib/categories.js';

test('the default list has the 6 groups and the mixed-media sub-types', () => {
  const c = parseCategories(DEFAULT_CATEGORIES);
  assert.deepEqual(c.map((x) => x.name), ['จิตรกรรม', 'ประติมากรรม', 'ภาพพิมพ์', 'เซรามิกส์', 'ศิลปะไทย', 'Mixed media technique']);
  assert.deepEqual(c[5].subs, ['2D', '3D', 'วิดีโออาร์ต', 'Digital art']);
});

test('curator text is cleaned: blanks, duplicates and spacing', () => {
  assert.equal(normalizeCategories('  จิตรกรรม \n\nจิตรกรรม\nสื่อผสม :  2D ,, 3D , 2D '), 'จิตรกรรม\nสื่อผสม: 2D, 3D');
  assert.equal(normalizeCategories(''), '');
});

test('a work must use a listed category and, when there are sub-types, one of them', () => {
  const c = parseCategories(DEFAULT_CATEGORIES);
  assert.deepEqual(checkCategory(c, 'จิตรกรรม', 'ignored'), { category: 'จิตรกรรม', subcategory: '' });
  assert.deepEqual(checkCategory(c, 'Mixed media technique', '3D'), { category: 'Mixed media technique', subcategory: '3D' });
  assert.throws(() => checkCategory(c, '', ''));
  assert.throws(() => checkCategory(c, 'ภาพถ่าย', ''));
  assert.throws(() => checkCategory(c, 'Mixed media technique', ''));
  assert.throws(() => checkCategory(c, 'Mixed media technique', '4D'));
  assert.deepEqual(checkCategory([], '', ''), { category: '', subcategory: '' }); // exhibition without categories
});

test('video art needs a video link', () => {
  assert.equal(needsVideo('Mixed media technique', 'วิดีโออาร์ต'), true);
  assert.equal(needsVideo('Mixed media technique', 'Digital art'), false);
  assert.equal(needsVideo('Video installation', ''), true);
});

test('categories carry English and Chinese labels; works store the first (Thai) label', () => {
  const c = parseCategories(DEFAULT_CATEGORIES);
  assert.equal(c[0].en, 'Painting');
  assert.equal(c[0].zh, '绘画');
  assert.equal(c[5].zh, '综合材料技法');
  assert.deepEqual(c[5].subLabels['วิดีโออาร์ต'], { en: 'Video art', zh: '录像艺术' });
  // round trip keeps the labels
  assert.equal(normalizeCategories(DEFAULT_CATEGORIES), DEFAULT_CATEGORIES);
  assert.equal(normalizeCategories('ภาพถ่าย |  | 摄影'), 'ภาพถ่าย |  | 摄影');
});
