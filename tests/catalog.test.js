import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSettings, normalizeLayout, parsePageList, orderWorks, values, techniqueValues, BUILTIN_TEMPLATES, DEFAULT_SETTINGS,
  cmykToHex, hexToCmyk, cmykOf
} from '../public/js/catalog-core.js';

test('settings: unknown values fall back, languages keep the chosen order', () => {
  const s = normalizeSettings({ langs: ['en', 'xx', 'th', 'en'], order: 'nope', template: 'javascript:1', fields: { price: true, email: true } });
  assert.deepEqual(s.langs, ['en', 'th']);
  assert.equal(s.order, 'display');
  assert.equal(s.template, DEFAULT_SETTINGS.template);
  assert.equal(s.fields.price, true);
  assert.equal('email' in s.fields, false);
  assert.deepEqual(normalizeSettings({}).langs, ['th', 'en']);
  assert.equal(normalizeSettings({ template: 't:12' }).template, 't:12');
});

test('layout: blocks are clamped and unknown fields dropped', () => {
  const l = normalizeLayout({ colors: { paper: 'red' }, fonts: { head: 'Comic Sans' }, blocks: [
    { id: 'a', field: 'title', x: 999, y: -50, w: 50, h: 10, size: 500, weight: 650 },
    { id: 'a', field: 'image', x: 10, y: 10, w: 100, h: 100, fit: 'stretch' },
    { id: 'z', field: 'script', x: 1, y: 1, w: 1, h: 1 }
  ] });
  assert.deepEqual(l.colors.paper, { c: 0, m: 0, y: 0, k: 0 });
  assert.equal(l.fonts.head, 'Noto Serif Thai');
  assert.equal(l.blocks.length, 2);
  assert.equal(l.blocks[0].x, 210);
  assert.equal(l.blocks[0].y, -10);
  assert.equal(l.blocks[0].size, 96);
  assert.equal(l.blocks[0].weight, 400);
  assert.notEqual(l.blocks[1].id, 'a');
  assert.equal(l.blocks[1].fit, 'contain');
});

test('built-in templates are already clean', () => {
  for (const t of BUILTIN_TEMPLATES) assert.deepEqual(normalizeLayout(t.layout).blocks.length, t.layout.blocks.length);
});

test('page lists for printing', () => {
  assert.deepEqual(parsePageList('1, 3-5', 10), [1, 3, 4, 5]);
  assert.deepEqual(parsePageList('5-3 2', 10), [2, 3, 4, 5]);
  assert.equal(parsePageList('0', 10), null);
  assert.equal(parsePageList('11', 10), null);
  assert.equal(parsePageList('a', 10), null);
});

test('book order and multilingual values', () => {
  const works = [
    { id: 3, display_order: 2, endorsed: 1, title_th: 'ข', artist_name_th: 'ค', nationality: 'TH' },
    { id: 1, display_order: 1, endorsed: 0, title_th: 'ก', artist_name_th: 'ง', nationality: 'CN' },
    { id: 2, display_order: 1, endorsed: 1, title_th: 'ค', artist_name_th: 'ก', nationality: 'TH' }
  ];
  const ex = { categories: [], techniques: [] };
  const ids = (s) => orderWorks(works, normalizeSettings(s), ex).map((w) => w.id);
  assert.deepEqual(ids({ order: 'display' }), [1, 2, 3]);
  assert.deepEqual(ids({ order: 'submitted' }), [1, 2, 3]);
  assert.deepEqual(ids({ order: 'artist', langs: ['th'] }), [2, 3, 1]);
  assert.deepEqual(ids({ order: 'display', include: 'endorsed' }), [2, 3]);
  assert.deepEqual(values({ title_th: 'ทุ่ง', title_en: 'Field', title_zh: '' }, 'title', ['th', 'en', 'zh']), ['ทุ่ง', 'Field']);
  assert.deepEqual(values({ title_th: 'ทุ่ง', title_en: '' }, 'title', ['en']), ['ทุ่ง']);
  const list = [{ name: 'สีน้ำมัน', en: 'Oil', zh: '油画' }];
  assert.deepEqual(techniqueValues(list, { technique_group: 'สีน้ำมัน', technique_th: '', technique_en: 'Oil on canvas' }, ['th', 'en']), ['สีน้ำมัน', 'Oil on canvas']);
});

test('colours are CMYK; old #rrggbb values are converted', () => {
  assert.equal(cmykToHex({ c: 0, m: 0, y: 0, k: 0 }), '#ffffff');
  assert.equal(cmykToHex({ c: 0, m: 0, y: 0, k: 100 }), '#000000');
  assert.equal(cmykToHex({ c: 0, m: 100, y: 100, k: 0 }), '#ff0000');
  assert.deepEqual(hexToCmyk('#ff0000'), { c: 0, m: 100, y: 100, k: 0 });
  assert.deepEqual(cmykOf({ c: 150, m: -3, y: '20', k: 5.6 }), { c: 100, m: 0, y: 20, k: 6 });
  const l = normalizeLayout({ colors: { accent: '#ff0000' }, blocks: [{ id: 'b', field: 'box', x: 0, y: 0, w: 10, h: 10, bg: { c: 10, m: 20, y: 30, k: 40 } }, { id: 'l', field: 'line', x: 0, y: 0, w: 10, h: 1, color: 'accent' }] });
  assert.deepEqual(l.colors.accent, { c: 0, m: 100, y: 100, k: 0 });
  assert.deepEqual(l.blocks[0].bg, { c: 10, m: 20, y: 30, k: 40 });
  assert.equal(l.blocks[1].color, 'accent');
  for (const t of BUILTIN_TEMPLATES) for (const v of Object.values(normalizeLayout(t.layout).colors)) assert.equal(typeof v.c, 'number');
});
