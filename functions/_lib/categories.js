// Work categories (กลุ่มงาน). Each exhibition keeps its own list as plain text, one category per
// line; sub-types follow a colon, separated by commas:
//   จิตรกรรม
//   Mixed media technique: 2D, 3D, วิดีโออาร์ต, Digital art
// An empty list means the exhibition does not ask for a category.
import { bad } from './http.js';

export const DEFAULT_CATEGORIES = [
  'จิตรกรรม',
  'ประติมากรรม',
  'ภาพพิมพ์',
  'เซรามิกส์',
  'ศิลปะไทย',
  'Mixed media technique: 2D, 3D, วิดีโออาร์ต, Digital art'
].join('\n');

const MAX_CATS = 30, MAX_SUBS = 20, MAX_NAME = 80;
const clean = (s) => String(s || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

// Lenient reader used for display: never throws, drops what does not fit.
export function parseCategories(text) {
  const out = [];
  const seen = new Set();
  for (const line of String(text || '').split(/\r?\n/)) {
    const i = line.indexOf(':');
    const name = clean(i >= 0 ? line.slice(0, i) : line).slice(0, MAX_NAME);
    if (!name || seen.has(name) || out.length >= MAX_CATS) continue;
    seen.add(name);
    const subs = [];
    if (i >= 0) {
      for (const s of line.slice(i + 1).split(',')) {
        const n = clean(s).slice(0, MAX_NAME);
        if (n && !subs.includes(n) && subs.length < MAX_SUBS) subs.push(n);
      }
    }
    out.push({ name, subs });
  }
  return out;
}

export const formatCategories = (list) => list.map((c) => (c.subs.length ? `${c.name}: ${c.subs.join(', ')}` : c.name)).join('\n');

// Strict version for what a curator saves.
export function normalizeCategories(text) {
  if (typeof text !== 'string') throw bad('กลุ่มงานไม่ถูกต้อง');
  if (text.length > 6000) throw bad('รายการกลุ่มงานยาวเกินไป');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > MAX_CATS) throw bad(`กลุ่มงานได้ไม่เกิน ${MAX_CATS} กลุ่ม`);
  return formatCategories(parseCategories(text));
}

export const needsVideo = (category, sub) => /วิดีโอ|วีดิทัศน์|video/i.test(`${category} ${sub}`);

// Validates one work's category against the exhibition's list.
export function checkCategory(list, category, subcategory, label = '') {
  const cat = clean(category), sub = clean(subcategory);
  if (!list.length) return { category: cat.slice(0, MAX_NAME), subcategory: sub.slice(0, MAX_NAME) };
  const c = list.find((x) => x.name === cat);
  if (!c) throw bad(`กรุณาเลือกกลุ่มงาน${label}`);
  if (!c.subs.length) return { category: c.name, subcategory: '' };
  if (!c.subs.includes(sub)) throw bad(`กรุณาเลือกประเภทของ ${c.name}${label}`);
  return { category: c.name, subcategory: sub };
}
