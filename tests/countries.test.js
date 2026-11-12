import test from 'node:test';
import assert from 'node:assert/strict';
import { isCountryCode, countryName, flagUrl, flagEmoji, countryOptions } from '../public/js/countries.js';

test('Kurdistan is a selectable place with its own names and flag (owner, 2026-11-12)', () => {
  assert.ok(isCountryCode('XR'));
  assert.equal(countryName('XR', 'th'), 'เคอร์ดิสถาน');
  assert.equal(countryName('XR', 'en'), 'Kurdistan');
  assert.equal(countryName('XR', 'zh-Hans'), '库尔德斯坦');
  assert.equal(flagUrl('XR'), '/flags/xr.svg');
  assert.equal(flagEmoji('XR'), '');
  assert.match(countryOptions('en'), /<option value="XR">Kurdistan<\/option>/);
  assert.equal(countryName('TH', 'en'), 'Thailand');
});
