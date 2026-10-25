import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captionContent, normLangs, paginate, sortWorks, techniqueIn } from '../public/js/caption-text.js';

const techs = [{ name: 'สีน้ำมัน', en: 'Oil', zh: '油画' }, { name: 'สื่อผสม', en: 'Mixed media', zh: '综合材料' }];
const w = {
  id: 7, display_order: 0, title_th: 'แสงเช้า', title_en: 'Morning Light', title_zh: '',
  artist_name_th: 'สมชาย ใจดี', artist_name_en: 'Somchai Jaidee', artist_name_zh: '',
  nationality: 'TH', affiliation: 'มหาวิทยาลัยเทคโนโลยีราชมงคลรัตนโกสินทร์',
  technique_group: 'สีน้ำมัน', technique_th: 'Technique : สีน้ำมันบนผ้าใบ', technique_en: 'Oil on canvas', technique_zh: '',
  dimensions: '80 x 100 cm', year_created: '2026'
};

test('languages: main first, extras de-duplicated', () => {
  assert.deepEqual(normLangs('en', ['th', 'en', 'zh']), ['en', 'th', 'zh']);
  assert.deepEqual(normLangs('xx', ['en']), ['th', 'en']);
});

test('Thai + English caption with technique, size, year, country and affiliation', () => {
  const c = captionContent(w, { langs: ['th', 'en'], techniques: techs });
  assert.deepEqual(c.titles, ['แสงเช้า', 'Morning Light']);
  assert.deepEqual(c.artists, ['สมชาย ใจดี', 'Somchai Jaidee']);
  assert.match(c.place, /^ไทย \/ Thailand · มหาวิทยาลัย/);
  assert.deepEqual(c.meta, ['สีน้ำมันบนผ้าใบ · 80 x 100 cm · 2026', 'Oil on canvas']);
  assert.equal(c.flag, '');
  assert.equal(c.number, '');
});

test('empty extra-language values are skipped, main language falls back', () => {
  const c = captionContent({ ...w, title_th: '' }, { langs: ['th', 'zh'], techniques: techs });
  assert.deepEqual(c.titles, ['Morning Light']);
  assert.deepEqual(c.artists, ['สมชาย ใจดี']);
  assert.equal(c.meta[1], '油画');
});

test('fields can be switched off', () => {
  const c = captionContent(w, { langs: ['th'], techniques: techs, fields: { technique: false, year: false, affiliation: false, flag: true, number: true }, number: 3 });
  assert.equal(c.place, 'ไทย');
  assert.deepEqual(c.meta, ['80 x 100 cm']);
  assert.equal(c.flag, 'TH');
  assert.equal(c.number, '3');
});

test('technique without a group uses the free text', () => {
  assert.equal(techniqueIn(techs, { technique_group: '', technique_th: 'Technique : ปากกา' }, 'th', { fallback: true }), 'ปากกา');
  assert.equal(techniqueIn(techs, { technique_group: 'สื่อผสม', technique_en: 'paper' }, 'en'), 'Mixed media · paper');
});

test('ten per sheet, with skipped first slots', () => {
  const items = Array.from({ length: 23 }, (_, i) => i);
  assert.deepEqual(paginate(items).map((s) => s.length), [10, 10, 3]);
  const s = paginate(items, 4);
  assert.deepEqual(s.map((x) => x.length), [10, 10, 7]);
  assert.deepEqual(s[0].slice(0, 5), [null, null, null, null, 0]);
});

test('sorting', () => {
  const a = { ...w, id: 1, display_order: 2, artist_name_th: 'ข' };
  const b = { ...w, id: 2, display_order: 1, artist_name_th: 'ก' };
  assert.deepEqual(sortWorks([a, b], 'display').map((x) => x.id), [2, 1]);
  assert.deepEqual(sortWorks([b, a], 'id').map((x) => x.id), [1, 2]);
  assert.deepEqual(sortWorks([a, b], 'artist').map((x) => x.id), [2, 1]);
});
