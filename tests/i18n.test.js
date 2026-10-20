import { test } from 'node:test';
import assert from 'node:assert/strict';

// Runs as an English-speaking visitor (Node reports en-US; no URL or saved choice).
Object.defineProperty(globalThis, 'navigator', { value: { languages: ['en-US'] }, configurable: true });
const i18n = await import('../public/js/i18n.js');

test('English visitors get English, then the original text', () => {
  assert.equal(i18n.lang, 'en');
  assert.equal(i18n.pick({ title_th: 'ทุ่งนา', title_en: 'Rice field', title_zh: '稻田' }, 'title'), 'Rice field');
  assert.equal(i18n.pick({ title_th: 'ทุ่งนา', title_en: '', title_zh: '稻田' }, 'title'), 'ทุ่งนา');
  assert.equal(i18n.pickOther({ title_th: 'ทุ่งนา', title_en: 'Rice field' }, 'title'), 'ทุ่งนา');
});

test('every key exists in all three languages', async () => {
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../public/js/i18n.js', import.meta.url), 'utf8'));
  const block = (code) => src.slice(src.indexOf(`  ${code}: {`), src.indexOf('\n  }', src.indexOf(`  ${code}: {`)));
  const keys = (code) => [...block(code).matchAll(/(\w+): '/g)].map((m) => m[1]).sort();
  assert.deepEqual(keys('en'), keys('th'));
  assert.deepEqual(keys('zh'), keys('th'));
});

test('dates and category labels follow the language', () => {
  assert.equal(i18n.fmtDate('2026-11-09'), '9 Nov 2026');
  assert.equal(i18n.fmtDate('2026-11-08T23:59:00+07:00', true), '8 Nov 2026, 23:59');
  const cats = [{ name: 'จิตรกรรม', en: 'Painting', zh: '绘画', subs: [], subLabels: {} },
    { name: 'Mixed media technique', en: 'Mixed media technique', zh: '综合材料技法', subs: ['วิดีโออาร์ต'], subLabels: { 'วิดีโออาร์ต': { en: 'Video art', zh: '录像艺术' } } }];
  assert.equal(i18n.catLabel(cats, { category: 'จิตรกรรม', subcategory: '' }), 'Painting');
  assert.equal(i18n.catLabel(cats, { category: 'Mixed media technique', subcategory: 'วิดีโออาร์ต' }), 'Mixed media technique · Video art');
  assert.equal(i18n.t('workOf', { i: 2, n: 5 }), 'Work 2 of 5');
  assert.equal(i18n.localError('ไม่พบผลงาน'), 'Something went wrong: ไม่พบผลงาน');
});

test('nationality list: codes only, names from the browser, old free text converted', async () => {
  const c = await import('../public/js/countries.js');
  assert.equal(c.COUNTRY_CODES.length, new Set(c.COUNTRY_CODES).size);
  assert.ok(c.isCountryCode('TH') && c.isCountryCode('CN') && !c.isCountryCode('Thailand') && !c.isCountryCode('th'));
  assert.equal(c.countryName('TH', 'en'), 'Thailand');
  assert.equal(c.countryName('TH', 'th'), 'ไทย');
  assert.equal(c.countryName('CN', 'zh-Hans'), '中国');
  assert.equal(c.countryName('Thailand (old text)', 'en'), 'Thailand (old text)');
  const html = c.countryOptions('en', 'CN');
  assert.ok(html.startsWith('<option value="TH">Thailand</option><option value="CN" selected>China</option>'));
  for (const [code, names] of Object.entries(c.COUNTRY_ALIASES)) {
    assert.ok(c.isCountryCode(code), code);
    for (const n of names) assert.equal(n, n.toLowerCase(), `${code}: aliases must be lower case`);
  }
  const v = await import('../functions/_lib/validate.js');
  assert.equal(v.country('th'), 'TH');
  assert.throws(() => v.country('Thailand'));
  assert.throws(() => v.country('', { required: true }));
});
