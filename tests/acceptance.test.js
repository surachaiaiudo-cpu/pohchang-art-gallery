import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptWindow, numberQuery, parseReply, coreUpdate, normSearch } from '../functions/_lib/acceptance.js';

const good = {
  name_en: 'Somchai Jaidee', name_th: 'สมชาย ใจดี', nationality: 'th', email: 'somchai@example.com', phone: '',
  types: ['painting', 'bogus'], peer_review: 'yes', agree_conditions: true, agree_accept: true,
  signed_name: 'Somchai Jaidee', filled_by: 'coordinator',
  exhibitions: [{ year: '2025', detail: 'Solo, Bangkok' }, { year: '', detail: '' }],
  food: { halal: true, allergy: 'peanuts' },
  work: { title: 'River', technique: 'Acrylic on canvas', dimensions: '80 × 100 cm', year: '2024' }, followers: '0', contact_address: 'Faculty of Fine Arts\nBangkok'
};

test('window: switch, then open until the end of the closing day in Bangkok', () => {
  assert.equal(acceptWindow({ accept_open: 0 }).open, false);
  assert.equal(acceptWindow({ accept_open: 1 }).open, true);
  const ex = { accept_open: 1, accept_closes_on: '2026-12-15' };
  assert.equal(acceptWindow(ex, Date.parse('2026-12-15T23:59:00+07:00')).open, true);
  assert.equal(acceptWindow(ex, Date.parse('2026-12-16T00:00:30+07:00')).open, false);
});

test('search by artist number', () => {
  assert.equal(numberQuery('015'), 15);
  assert.equal(numberQuery('15'), 15);
  assert.equal(numberQuery('No. 015'), 15);
  assert.equal(numberQuery('#7'), 7);
  assert.equal(numberQuery('Aiko'), null);
  assert.equal(numberQuery('15 Aiko'), null);
});

test('reply form: required answers, cleaned lists', () => {
  const r = parseReply(good);
  assert.deepEqual(r.data.types, ['painting']);
  assert.equal(r.data.peer_review, 'yes');
  assert.equal(r.data.exhibitions.length, 1);
  assert.equal(r.data.food.halal, true);
  assert.equal(r.data.contact_address, 'Faculty of Fine Arts\nBangkok');
  assert.equal(r.core.nationality, 'TH');
  assert.equal(r.filledBy, 'coordinator');
  assert.deepEqual(r.data.work, { title: 'River', technique: 'Acrylic on canvas', dimensions: '80 × 100 cm', year: '2024', concept: '' });
  assert.throws(() => parseReply({ ...good, work: { ...good.work, year: '' } }));
  assert.throws(() => parseReply({ ...good, work: undefined }));
  assert.throws(() => parseReply({ ...good, email: '' }));                       // the artist must type an email
  assert.throws(() => parseReply({ ...good, peer_review: '' }));
  assert.throws(() => parseReply({ ...good, types: [] }));
  assert.throws(() => parseReply({ ...good, types: ['mixed_other'] }));
  assert.throws(() => parseReply({ ...good, agree_accept: false }));
  assert.throws(() => parseReply({ ...good, agree_conditions: 'true' }));
  assert.throws(() => parseReply({ ...good, followers: 2 }));
  assert.equal(parseReply({ ...good, followers: 2, followers_agree: true }).data.followers, 2);
  assert.equal(parseReply({ ...good, filled_by: '' }).filledBy, 'self');
  assert.throws(() => parseReply({ ...good, filled_by: 'hacker' }));
});

test('the artist\'s values are used at once; blank phone keeps what staff had', () => {
  const artist = { name_th: 'สมชาย', name_en: 'Somchai', email: 'old@x.com', phone: '0811111111', nationality: 'TH', affiliation: 'A', avatar_url: '/a.jpg' };
  const { core } = parseReply({ ...good, affiliation: 'B University' });
  const { next, changes } = coreUpdate(artist, { ...core, email: '' }, '');   // (email is required by the form)
  assert.equal(next.email, 'old@x.com');
  assert.equal(next.phone, '0811111111');
  assert.equal(next.avatar_url, '/a.jpg');
  assert.equal(next.affiliation, 'B University');
  assert.deepEqual(changes.map((c) => c.field).sort(), ['affiliation', 'name_en', 'name_th']);
  assert.deepEqual(coreUpdate(artist, { ...core, email: 'new@x.com' }, '/b.jpg').changes.map((c) => c.field).includes('avatar_url'), true);
});

test('a foreign name kept only in English follows the correction', () => {
  const artist = { name_th: 'Nguyen Van A', name_en: 'Nguyen Van A', email: '', phone: '', nationality: 'VN', affiliation: '', avatar_url: '' };
  const { core } = parseReply({ ...good, name_en: 'Nguyen Van An', name_th: '', nationality: 'VN' });
  assert.equal(coreUpdate(artist, core, '').next.name_th, 'Nguyen Van An');
});

test('name search ignores case and extra spaces', () => {
  assert.equal(normSearch('  SomCHAI   Jai '), 'somchai jai');
});
