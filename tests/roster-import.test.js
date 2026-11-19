import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readXlsx, readCsv, colIndex, unescapeXml } from '../public/js/xlsx-read.js';
import { parseImport, findHeader, parseChannel, parseRoster } from '../functions/_lib/roster.js';
import { matchCountry } from '../functions/_lib/import-old.js';
import { normName } from '../functions/_lib/artist-match.js';

const buf = (p) => { const b = readFileSync(new URL(p, import.meta.url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const deps = { matchCountry: (t) => (/^[A-Z]{2}$/.test(t) ? { code: t } : matchCountry(t)), normName };

test('reads the first sheet of the template (header only)', async () => {
  const rows = await readXlsx(buf('../public/templates/roster-template.xlsx'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0][0], 'ชื่อ-นามสกุล (ภาษาหลัก) *');
  const h = findHeader(rows);
  assert.deepEqual(Object.keys(h.map), ['name_th', 'name_en', 'academic_title_th', 'nationality', 'email', 'phone', 'affiliation', 'channel', 'roster', 'roster_note']);
});

test('reads a filled sheet and checks every row', async () => {
  const rows = await readXlsx(buf('./fixtures/roster-import.xlsx'));
  const r = parseImport(rows, [{ id: 9, name_th: 'สมหญิง', name_en: 'Rich & <Text>' }], deps);
  const by = (n) => r.rows.find((x) => x.artist.name_th === n || x.artist.name_en === n);
  const k = by('National Artist K');
  assert.deepEqual([k.artist.nationality, k.channel, k.roster, k.errors.length, k.duplicate], ['TH', 1, 'selected', 0, null]);
  assert.equal(k.artist.phone, '0811111111');
  const aiko = r.rows.filter((x) => x.artist.name_th === 'Aiko Tanaka');
  assert.equal(aiko[0].artist.nationality, 'JP');
  assert.equal(aiko[0].roster_note, 'MOU 2025');
  assert.equal(aiko[1].duplicate.where, 'file');
  assert.ok(by('No Name').errors.includes('ไม่มีชื่อ'));
  assert.match(by('Bad Country').errors.join(), /Narnia/);
  const rich = by('Rich & <Text>');
  assert.deepEqual([rich.artist.nationality, rich.channel, rich.roster, rich.roster_note], ['VN', 2, 'not_selected', 'a "quote"']);
  assert.equal(rich.duplicate.where, 'list');
});

test('header row may be lower down and bilingual', () => {
  const rows = [['รายชื่อ MOU 2026'], [], ['Name', 'Country', 'Channel'], ['A B', 'Thailand', 'MOU']];
  const r = parseImport(rows, [], deps);
  assert.equal(r.headerLine, 3);
  assert.deepEqual([r.rows[0].artist.name_th, r.rows[0].artist.nationality, r.rows[0].channel], ['A B', 'TH', 3]);
});

test('no name column is an error', () => {
  assert.throws(() => parseImport([['x', 'y']], [], deps), /ชื่อ-นามสกุล/);
});

test('channel and status words', () => {
  assert.deepEqual(['1 เชิญโดยตรง', '2', 'MOU', 'สมัครเอง', '', '10', 'xyz'].map(parseChannel), [1, 2, 3, 4, 0, null, null]);
  assert.deepEqual(['ผ่าน', 'ไม่ผ่าน', 'ได้รับคัดเลือก', 'รอผลคัดเลือก', 'ไม่ผ่านการคัดเลือก', '', 'Selected', 'Not pass', '??'].map(parseRoster),
    ['selected', 'not_selected', 'selected', '', 'not_selected', '', 'selected', 'not_selected', null]);
});

test('csv and helpers', () => {
  assert.deepEqual(readCsv('﻿Name,Country\n"Doe, J","Thai ""land"""\r\n\n'), [['Name', 'Country'], ['Doe, J', 'Thai "land"']]);
  assert.deepEqual(readCsv('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
  assert.equal(colIndex('AB12'), 27);
  assert.equal(unescapeXml('&lt;&amp;&#3585;&#x41;'), '<&กA');
});
