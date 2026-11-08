import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSite, emptySite } from '../functions/_lib/site.js';

test('gallery settings: only known fields, links must be https, email checked', () => {
  const s = normalizeSite({ hero_title_th: '  หอศิลป์เพาะช่าง ', address_th: 'บรรทัด 1\nบรรทัด 2', email: 'info@example.org',
    facebook: 'https://facebook.com/x', evil: '<script>' });
  assert.equal(s.hero_title_th, 'หอศิลป์เพาะช่าง');
  assert.equal(s.address_th, 'บรรทัด 1\nบรรทัด 2');
  assert.equal(s.facebook, 'https://facebook.com/x');
  assert.equal('evil' in s, false);
  assert.deepEqual(Object.keys(s).sort(), Object.keys(emptySite()).sort());
  assert.throws(() => normalizeSite({ facebook: 'http://facebook.com/x' }));
  assert.throws(() => normalizeSite({ website: 'javascript:alert(1)' }));
  assert.throws(() => normalizeSite({ email: 'not-an-email' }));
  assert.equal(normalizeSite({}).email, '');
});

test('home page look: design B by default, Poh-Chang design and mourning tone can be chosen', () => {
  assert.equal(normalizeSite({}).home_design, 'b');
  assert.equal(normalizeSite({}).home_mood, '');
  const s = normalizeSite({ home_design: 'pohchang', home_mood: 'mourning', logo_url: 'https://res.cloudinary.com/x/logo.png' });
  assert.equal(s.home_design, 'pohchang');
  assert.equal(s.home_mood, 'mourning');
  assert.equal(s.logo_url, 'https://res.cloudinary.com/x/logo.png');
  assert.throws(() => normalizeSite({ home_design: 'neon' }));
  assert.throws(() => normalizeSite({ home_mood: 'party' }));
  assert.throws(() => normalizeSite({ logo_url: 'http://example.org/logo.png' }));
});
