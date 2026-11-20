import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptWindow, maskEmail, maskPhone, parseReply, coreUpdate, normSearch } from '../functions/_lib/acceptance.js';

const good = {
  name_en: 'Somchai Jaidee', name_th: 'สมชาย ใจดี', nationality: 'th', email: '', phone: '',
  types: ['painting', 'bogus'], peer_review: 'yes', agree_conditions: true, agree_accept: true,
  signed_name: 'Somchai Jaidee', filled_by: 'coordinator',
  exhibitions: [{ year: '2025', detail: 'Solo, Bangkok' }, { year: '', detail: '' }],
  food: { halal: true, allergy: 'peanuts' }, followers: '0', contact_address: 'Faculty of Fine Arts\nBangkok'
};

test('window: switch, then open until the end of the closing day in Bangkok', () => {
  assert.equal(acceptWindow({ accept_open: 0 }).open, false);
  assert.equal(acceptWindow({ accept_open: 1 }).open, true);
  const ex = { accept_open: 1, accept_closes_on: '2026-12-15' };
  assert.equal(acceptWindow(ex, Date.parse('2026-12-15T23:59:00+07:00')).open, true);
  assert.equal(acceptWindow(ex, Date.parse('2026-12-16T00:00:30+07:00')).open, false);
});

test('email and phone are only shown masked', () => {
  assert.equal(maskEmail('somchai@gmail.com'), 'so•••••@gmail.com');
  assert.equal(maskEmail('a@b.co'), 'a•••@b.co');
  assert.equal(maskEmail(''), '');
  assert.equal(maskPhone('081 234 5678'), '••••••5678');
  assert.equal(maskPhone('12'), '');
});

test('reply form: required answers, cleaned lists', () => {
  const r = parseReply(good, { email: 'x@y.com' });
  assert.deepEqual(r.data.types, ['painting']);
  assert.equal(r.data.peer_review, 'yes');
  assert.equal(r.data.exhibitions.length, 1);
  assert.equal(r.data.food.halal, true);
  assert.equal(r.data.contact_address, 'Faculty of Fine Arts\nBangkok');
  assert.equal(r.core.nationality, 'TH');
  assert.equal(r.filledBy, 'coordinator');
  assert.throws(() => parseReply(good, {}), /อีเมล/);                        // no email on file and none typed
  assert.throws(() => parseReply({ ...good, peer_review: '' }, { email: 'x@y.com' }));
  assert.throws(() => parseReply({ ...good, types: [] }, { email: 'x@y.com' }));
  assert.throws(() => parseReply({ ...good, types: ['mixed_other'] }, { email: 'x@y.com' }));
  assert.throws(() => parseReply({ ...good, agree_accept: false }, { email: 'x@y.com' }));
  assert.throws(() => parseReply({ ...good, agree_conditions: 'true' }, { email: 'x@y.com' }));
  assert.throws(() => parseReply({ ...good, followers: 2 }, { email: 'x@y.com' }));
  assert.equal(parseReply({ ...good, followers: 2, followers_agree: true }, { email: 'x@y.com' }).data.followers, 2);
  assert.equal(parseReply({ ...good, filled_by: '' }, { email: 'x@y.com' }).filledBy, 'self');
  assert.throws(() => parseReply({ ...good, filled_by: 'hacker' }, { email: 'x@y.com' }));
});

test('artist corrections are used at once; blank email / phone keep what is on file', () => {
  const artist = { name_th: 'สมชาย', name_en: 'Somchai', email: 'old@x.com', phone: '0811111111', nationality: 'TH', affiliation: 'A', avatar_url: '/a.jpg' };
  const { core } = parseReply({ ...good, affiliation: 'B University' }, artist);
  const { next, changes } = coreUpdate(artist, core, '');
  assert.equal(next.email, 'old@x.com');
  assert.equal(next.phone, '0811111111');
  assert.equal(next.avatar_url, '/a.jpg');
  assert.equal(next.affiliation, 'B University');
  assert.deepEqual(changes.map((c) => c.field).sort(), ['affiliation', 'name_en', 'name_th']);
  assert.deepEqual(coreUpdate(artist, { ...core, email: 'new@x.com' }, '/b.jpg').changes.map((c) => c.field).includes('avatar_url'), true);
});

test('name search ignores case and extra spaces', () => {
  assert.equal(normSearch('  SomCHAI   Jai '), 'somchai jai');
});
