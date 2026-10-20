import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchCountry, mapOldWork, summarize, sourceUrl, artistKey } from '../functions/_lib/import-old.js';

test('old free-text nationalities become country codes', () => {
  assert.equal(matchCountry('Thailand').code, 'TH');
  assert.equal(matchCountry('VietNam').code, 'VN');
  assert.equal(matchCountry('United Kingdom').code, 'GB');
  assert.equal(matchCountry('Mexico').code, 'MX');
  assert.equal(matchCountry('เม็กซิโก').code, 'MX');
  assert.equal(matchCountry('Kurdistan').kept, 'Kurdistan');
  assert.deepEqual(matchCountry('someone@gmail.com'), { code: '', kept: '', dropped: true });
  assert.equal(matchCountry('-').code, '');
});

const old = {
  id: 7, title: 'Old title', title_th: 'ทุ่งนา', artist_name: 'Somchai', artist_name_th: 'สมชาย', academic_title: 'ผศ.',
  artist_email: 'Somchai@Example.com', nationality: 'Thai', technique: 'สีน้ำมัน', description: 'แนวคิด',
  image_url: 'https://res.cloudinary.com/mtykamzk/image/upload/v1/a.jpg', artist_avatar_url: 'https://res.cloudinary.com/mtykamzk/image/upload/v1/b.jpg',
  zone: 'Main Gallery', status: 'approved', created_at: '2025-08-01 10:00:00'
};

test('an old work maps to the new shape; email kept private and lower-cased', () => {
  const m = mapOldWork(old);
  assert.equal(m.work.title_th, 'ทุ่งนา');
  assert.equal(m.work.technique_th, 'สีน้ำมัน');
  assert.equal(m.work.concept_th, 'แนวคิด');
  assert.equal(m.work.zone, '');
  assert.equal(m.work.created_at, '2025-08-01 10:00:00');
  assert.equal(m.artist.name_th, 'สมชาย');
  assert.equal(m.artist.academic_title_th, 'ผศ.');
  assert.equal(m.artist.email, 'somchai@example.com');
  assert.equal(m.artist.nationality, 'TH');
  assert.ok(mapOldWork({ ...old, image_url: 'https://evil.example/x.jpg' }).skip);
  assert.equal(mapOldWork({ ...old, artist_avatar_url: 'javascript:alert(1)' }).artist.avatar_url, '');
});

test('preview summary counts artists once and lists what needs a curator', () => {
  const s = summarize([old, { ...old, id: 8, title_th: 'สอง' }, { ...old, id: 9, artist_email: '', artist_name_th: 'Ali', nationality: 'Kurdistan' },
    { ...old, id: 10, artist_email: '', artist_name_th: 'Bo', nationality: 'bo@x.com' }, { ...old, id: 11, image_url: 'http://x/y.jpg' }]);
  assert.equal(s.works, 4);
  assert.equal(s.artists, 3);
  assert.deepEqual(s.unknownNationalities, { Kurdistan: 1 });
  assert.deepEqual(s.nationalityWasEmail, ['Bo']);
  assert.equal(s.skipped.length, 1);
  assert.equal(artistKey({ email: '', name_th: 'Ali' }), 'n:ali');
});

test('the source must be an https site (http://localhost only when allowed for local tests)', () => {
  assert.equal(sourceUrl('https://sirikit.pages.dev/catalog.html'), 'https://sirikit.pages.dev');
  assert.throws(() => sourceUrl('http://sirikit.pages.dev'));
  assert.throws(() => sourceUrl('javascript:alert(1)'));
  assert.throws(() => sourceUrl('http://localhost:9000'));
  assert.equal(sourceUrl('http://localhost:9000', { DEV_ALLOW_HTTP_IMPORT: '1' }), 'http://localhost:9000');
});
