import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, categoryOrder, categoryLabel, pickLang, paragraphs } from '../public/js/report-data.js';

const cats = [
  { name: 'จิตรกรรม', en: 'Painting', zh: '绘画' },
  { name: 'ประติมากรรม', en: 'Sculpture', zh: '雕塑' }
];
const W = (id, artist_id, category, extra = {}) => ({
  id, artist_id, category, status: 'submitted', display_order: 0,
  artist_name_th: { 1: 'สมชาย', 2: 'กมล', 3: 'อนันต์' }[artist_id] || '', title_th: `งาน ${id}`, ...extra
});

test('groups by category in list order, artists by name, numbering runs through the report', () => {
  const works = [W(1, 1, 'ประติมากรรม'), W(2, 2, 'จิตรกรรม'), W(3, 1, 'จิตรกรรม'), W(4, 2, 'จิตรกรรม'), W(5, 3, '')];
  const r = buildReport(works, { categories: cats });
  assert.deepEqual(r.sections.map((s) => s.cat.name), ['จิตรกรรม', 'ประติมากรรม', 'ไม่ระบุกลุ่มงาน']);
  const painting = r.sections[0];
  assert.deepEqual(painting.artists.map((a) => a.id), [2, 1]); // กมล before สมชาย
  assert.deepEqual(painting.artists[0].works.map((w) => [w.id, w.no]), [[2, '001'], [4, '002']]);
  assert.equal(r.sections[1].artists[0].works[0].no, '004');
  assert.equal(r.total.works, 5);
  assert.equal(r.total.artists, 3); // artist 1 is in two sections but counted once
});

test('status and category filters, artist order by first submission, unknown categories kept', () => {
  const works = [W(1, 1, 'จิตรกรรม', { status: 'shown' }), W(2, 2, 'จิตรกรรม'), W(3, 3, 'Old cat'), W(4, 3, 'Old cat', { deleted_at: 'x' })];
  assert.equal(buildReport(works, { categories: cats, status: 'shown' }).total.works, 1);
  const sent = buildReport(works, { categories: cats, artistOrder: 'sent', cat: 'จิตรกรรม' });
  assert.deepEqual(sent.sections.map((s) => s.artists.map((a) => a.id)), [[1, 2]]);
  const old = buildReport(works, { categories: cats, cat: 'Old cat' });
  assert.equal(old.sections[0].nWorks, 1);
  assert.equal(categoryOrder(cats, works).at(-1).key, '');
});

test('labels and language fallback', () => {
  assert.equal(categoryLabel(cats[0], 'en'), 'Painting');
  assert.equal(categoryLabel({ name: 'x', en: 'y', zh: '' }, 'zh'), 'y');
  assert.equal(pickLang({ bio_th: '', bio_en: 'Hello' }, 'bio', 'th'), 'Hello');
  assert.deepEqual(paragraphs('a\n\n\nb\nc'), ['a', 'b\nc']);
});

test('landscape grid and one page per artist per category', async () => {
  const { workGrid, artistPages } = await import('../public/js/report-data.js');
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((n) => workGrid(n)), [
    { cols: 1, rows: 1 }, { cols: 2, rows: 1 }, { cols: 3, rows: 1 }, { cols: 2, rows: 2 },
    { cols: 3, rows: 2 }, { cols: 3, rows: 2 }, { cols: 4, rows: 2 }]);
  const works = [W(1, 1, 'ประติมากรรม'), W(2, 2, 'จิตรกรรม'), W(3, 1, 'จิตรกรรม')];
  const pages = artistPages(buildReport(works, { categories: cats }));
  assert.deepEqual(pages.map((p) => [p.section.cat.name, p.artist.id]), [['จิตรกรรม', 2], ['จิตรกรรม', 1], ['ประติมากรรม', 1]]);
});

test('checklist pages: grouped by artist, an artist never split, category rows never at the bottom', async () => {
  const { checklistPages } = await import('../public/js/report-data.js');
  const works = [];
  for (let i = 1; i <= 9; i += 1) works.push(W(i, (i % 3) + 1, 'จิตรกรรม'));
  for (let i = 10; i <= 14; i += 1) works.push(W(i, 1, 'ประติมากรรม'));
  const pages = checklistPages(buildReport(works, { categories: cats }), 8);
  const flat = pages.flat();
  assert.equal(flat.filter((r) => r.type === 'artist').reduce((n, r) => n + r.works.length, 0), 14);
  assert.equal(flat.filter((r) => r.type === 'cat').length, 2);
  for (const p of pages) {
    assert.ok(p.reduce((n, r) => n + (r.type === 'cat' ? 1 : r.works.length), 0) <= 8);
    assert.notEqual(p.at(-1).type, 'cat');
  }
  // Each artist of the painting group has 3 works and sits on one sheet.
  assert.deepEqual(flat.filter((r) => r.type === 'artist').map((r) => r.works.length), [3, 3, 3, 5]);
});
