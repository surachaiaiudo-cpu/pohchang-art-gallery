// Read the first sheet of an Excel .xlsx file (or a .csv) into rows of strings, in the browser, without a
// library: an .xlsx is a zip of XML files; DecompressionStream('deflate-raw') inflates them.
// Used by the roster import (owner, 2026-11-17). Formulas give their last saved value; dates stay numbers.

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

function zipEntries(bytes) {
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) {
    if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ไฟล์นี้ไม่ใช่ไฟล์ Excel (.xlsx)');
  const count = u16(bytes, eocd + 10);
  let p = u32(bytes, eocd + 16);
  const dec = new TextDecoder();
  const entries = new Map();
  for (let i = 0; i < count; i += 1) {
    if (u32(bytes, p) !== 0x02014b50) throw new Error('ไฟล์ Excel เสียหาย');
    const method = u16(bytes, p + 10);
    const size = u32(bytes, p + 20);
    const nameLen = u16(bytes, p + 28);
    const extraLen = u16(bytes, p + 30);
    const commentLen = u16(bytes, p + 32);
    const local = u32(bytes, p + 42);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { method, size, local });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function readEntry(bytes, entries, name) {
  const e = entries.get(name);
  if (!e) return null;
  const start = e.local + 30 + u16(bytes, e.local + 26) + u16(bytes, e.local + 28);
  const data = bytes.subarray(start, start + e.size);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error('ไฟล์ Excel ใช้การบีบอัดที่อ่านไม่ได้');
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export const unescapeXml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, k) => {
  if (k[0] === '#') return String.fromCodePoint(k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
  return ENT[k.toLowerCase()] ?? m;
});
// All <t> texts inside a fragment (rich text runs are joined; phonetic <rPh> runs are left out).
const texts = (xml) => [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)]
  .map((m) => unescapeXml(m[1] || '')).join('');
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? unescapeXml(m[1]) : ''; };

export function colIndex(ref) {
  const letters = String(ref).match(/^[A-Z]+/i);
  if (!letters) return -1;
  let n = 0;
  for (const ch of letters[0].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// sheet XML + shared strings -> rows (arrays of trimmed strings, trailing empty rows removed)
export function sheetRows(sheetXml, shared = []) {
  const rows = [];
  for (const rm of sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
    const r = Number(attr(rm[1] || rm[3] || '', 'r')) || rows.length + 1;
    const cells = [];
    for (const cm of (rm[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tag = cm[1];
      const body = cm[2] || '';
      let col = colIndex(attr(tag, 'r'));
      if (col < 0) col = cells.length;
      const t = attr(tag, 't');
      const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let value = '';
      if (t === 's') value = shared[Number(v)] ?? '';
      else if (t === 'inlineStr') value = texts(body);
      else if (t === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else if (v !== undefined) value = unescapeXml(v);
      cells[col] = String(value).trim();
    }
    rows[r - 1] = Array.from(cells, (c) => c ?? '');
  }
  const out = Array.from(rows, (r) => r || []);
  while (out.length && out[out.length - 1].every((c) => !c)) out.pop();
  return out;
}

export async function readXlsx(buffer) {
  const bytes = new Uint8Array(buffer);
  const entries = zipEntries(bytes);
  const wb = await readEntry(bytes, entries, 'xl/workbook.xml');
  if (!wb) throw new Error('ไฟล์นี้ไม่ใช่ไฟล์ Excel (.xlsx)');
  const first = wb.match(/<sheet\b[^>]*>/);
  let path = 'xl/worksheets/sheet1.xml';
  if (first) {
    const rid = attr(first[0], 'r:id');
    const rels = (await readEntry(bytes, entries, 'xl/_rels/workbook.xml.rels')) || '';
    const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((t) => attr(t, 'Id') === rid);
    if (rel) {
      const target = attr(rel, 'Target');
      path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    }
  }
  const sheet = await readEntry(bytes, entries, path);
  if (!sheet) throw new Error('ไม่พบแผ่นงานแรกในไฟล์ Excel');
  const sst = (await readEntry(bytes, entries, 'xl/sharedStrings.xml')) || '';
  const shared = [...sst.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
  return sheetRows(sheet, shared);
}

// Simple CSV (Excel "Save as CSV UTF-8"): commas or semicolons, quoted fields with "" escapes.
export function readCsv(text) {
  const src = String(text).replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell.trim()); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  while (rows.length && rows[rows.length - 1].every((c) => !c)) rows.pop();
  return rows;
}

export async function readSpreadsheet(file) {
  if (/\.csv$/i.test(file.name)) return readCsv(await file.text());
  if (/\.xls$/i.test(file.name)) throw new Error('ไฟล์ .xls แบบเก่าอ่านไม่ได้ กรุณาบันทึกเป็น .xlsx ก่อน (Excel: บันทึกเป็น → สมุดงาน Excel)');
  return readXlsx(await file.arrayBuffer());
}
