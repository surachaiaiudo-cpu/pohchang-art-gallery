import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TECHNIQUES, parseTechniques, normalizeTechniques, checkTechnique, guessTechnique, cleanTechniqueText } from '../functions/_lib/techniques.js';

const list = parseTechniques(DEFAULT_TECHNIQUES);

test('the default list has 15 techniques in three languages and round-trips', () => {
  assert.equal(list.length, 15);
  assert.deepEqual(list[0], { name: 'สีน้ำมัน', en: 'Oil', zh: '油画' });
  assert.equal(list[14].name, 'อื่น ๆ');
  assert.equal(normalizeTechniques(DEFAULT_TECHNIQUES), DEFAULT_TECHNIQUES);
  assert.equal(normalizeTechniques(' สีน้ำมัน \n\nสีน้ำมัน\n'), 'สีน้ำมัน');
});

test('artists must pick a listed technique; curators may clear it', () => {
  assert.equal(checkTechnique(list, 'สีอะคริลิก'), 'สีอะคริลิก');
  assert.throws(() => checkTechnique(list, ''));
  assert.throws(() => checkTechnique(list, 'Acrylic'));
  assert.equal(checkTechnique(list, '', { required: false }), '');
  assert.equal(checkTechnique([], 'anything'), ''); // exhibition without a technique list
});

test('the old "Technique :" prefix is hidden', () => {
  assert.equal(cleanTechniqueText('Technique : สีน้ำมันบนผ้าใบ'), 'สีน้ำมันบนผ้าใบ');
  assert.equal(cleanTechniqueText('Technique :สีอะคริลิกบนผ้าใบ'), 'สีอะคริลิกบนผ้าใบ');
  assert.equal(cleanTechniqueText('Paper Sculpture'), 'Paper Sculpture');
});

test('guesses from the imported Queen Sirikit data', () => {
  const cases = {
    'Technique : สีอะคริลิกบนผ้าใบ': 'สีอะคริลิก',
    'Technique : สีน้ำอะคริลิกบนผ้าใบ': 'สีอะคริลิก',
    'Technique : Acrylic on canvas': 'สีอะคริลิก',
    'สีอะครีลิก': 'สีอะคริลิก',
    'อคริลิคบนผ้าใบ': 'สีอะคริลิก',
    'Technique : พอยน์ทิลลิสม์ศิลปะจุดสี สีอะคริลิกบนผ้าใบ': 'สีอะคริลิก',
    'Technique : สีน้ำมันบนลินิน': 'สีน้ำมัน',
    'Technique : Oil on canvas': 'สีน้ำมัน',
    'Technique : oil sticks': 'พาสเทล / สีชอล์ก',
    'Technique : สีชอล์ค': 'พาสเทล / สีชอล์ก',
    'Technique : สีน้ำบนกระดาษชนวน': 'สีน้ำ',
    'Technique : สีฝุ่นบนพื้นดินสอพอง': 'สีฝุ่น / เทมเพอรา',
    'Technique : วาดเส้นปากกาหมึกซึมบนผ้าใบ': 'วาดเส้น (ดินสอ ถ่าน หมึก)',
    'Technique : วาดเส้นด้วยความร้อนบนแผ่นไม้': 'วาดเส้น (ดินสอ ถ่าน หมึก)',
    'Technique : ภาพพิมพ์แกะไม้': 'ภาพพิมพ์',
    'Technique : ภาพพิมพ์เทคนิคผสม': 'สื่อผสม',
    'Technique : ดินเผา': 'เซรามิก / ดินเผา',
    'Technique : ดินไทย ปูนสด': 'ปั้น / หล่อ',
    'Paper Sculpture': 'ปั้น / หล่อ',
    'Technique : สื่อผสม': 'สื่อผสม',
    'Technique : จิตรกรรมเทคนิคผสม': 'สื่อผสม',
    'Technique : สีฝุ่น สีอะคริลิกบนผ้าใบ': 'สื่อผสม',
    'Technique : สีอะคริลิกและสกรีน': 'สื่อผสม',
    'Technique : Charcoal , Water color and Pastel on paper': 'สื่อผสม',
    // nothing to go on: the curator picks
    'Technique : ลายรดน้ำ ทองคำเปลว สีชาด บนพื้นรัก': '',
    'Technique : Luneville Embroidery': '',
    'Technique : จิตรกรรมลายทอง': '',
    '': ''
  };
  for (const [text, want] of Object.entries(cases)) assert.equal(guessTechnique(list, text), want, text);
});

test('guesses only return groups the exhibition actually lists', () => {
  const short = parseTechniques('Oil painting | Oil\nอื่น ๆ');
  assert.equal(guessTechnique(short, 'สีน้ำมันบนผ้าใบ'), 'Oil painting'); // found by its English label
  assert.equal(guessTechnique(short, 'สีอะคริลิก'), '');
  assert.equal(guessTechnique([], 'สีน้ำมัน'), '');
});
