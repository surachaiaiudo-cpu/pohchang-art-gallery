// Work categories (กลุ่มงาน). Each exhibition keeps its own list as plain text, one category per
// line; sub-types follow a colon, separated by commas. Any item may carry English and Chinese
// labels after "|" (Thai | English | 中文). The first label is the value stored on works.
//   จิตรกรรม | Painting | 绘画
//   Mixed media technique | Mixed media technique | 综合材料技法: 2D | 2D | 平面 (2D), 3D
// An empty list means the exhibition does not ask for a category.
import { bad } from './http.js';

export const DEFAULT_CATEGORIES_V1 = [
  'จิตรกรรม',
  'ประติมากรรม',
  'ภาพพิมพ์',
  'เซรามิกส์',
  'ศิลปะไทย',
  'Mixed media technique: 2D, 3D, วิดีโออาร์ต, Digital art'
].join('\n');

export const DEFAULT_CATEGORIES = [
  'จิตรกรรม | Painting | 绘画',
  'ประติมากรรม | Sculpture | 雕塑',
  'ภาพพิมพ์ | Printmaking | 版画',
  'เซรามิกส์ | Ceramics | 陶瓷艺术',
  'ศิลปะไทย | Thai Art | 泰国艺术',
  'Mixed media technique | Mixed media technique | 综合材料技法: 2D | 2D | 平面 (2D), 3D | 3D | 立体 (3D), วิดีโออาร์ต | Video art | 录像艺术, Digital art | Digital art | 数字艺术'
].join('\n');

const MAX_CATS = 30, MAX_SUBS = 20, MAX_NAME = 80;
const clean = (s) => String(s || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

function item(text) {
  const [name = '', en = '', zh = ''] = String(text).split('|').map((p) => clean(p).slice(0, MAX_NAME));
  return { name, en, zh };
}
function itemText({ name, en, zh }) {
  if (zh) return `${name} | ${en} | ${zh}`;
  if (en) return `${name} | ${en}`;
  return name;
}

// Lenient reader used for display: never throws, drops what does not fit.
// -> [{ name, en, zh, subs: [name...], subLabels: { name: { en, zh } } }]
export function parseCategories(text) {
  const out = [];
  const seen = new Set();
  for (const line of String(text || '').split(/\r?\n/)) {
    const i = line.indexOf(':');
    const head = item(i >= 0 ? line.slice(0, i) : line);
    if (!head.name || seen.has(head.name) || out.length >= MAX_CATS) continue;
    seen.add(head.name);
    const subs = [], subLabels = {};
    if (i >= 0) {
      for (const s of line.slice(i + 1).split(',')) {
        const it = item(s);
        if (it.name && !subs.includes(it.name) && subs.length < MAX_SUBS) {
          subs.push(it.name);
          subLabels[it.name] = { en: it.en, zh: it.zh };
        }
      }
    }
    out.push({ ...head, subs, subLabels });
  }
  return out;
}

export const formatCategories = (list) => list.map((c) => {
  const head = itemText(c);
  if (!c.subs.length) return head;
  return `${head}: ${c.subs.map((s) => itemText({ name: s, ...(c.subLabels[s] || {}) })).join(', ')}`;
}).join('\n');

// Strict version for what a curator saves.
export function normalizeCategories(text) {
  if (typeof text !== 'string') throw bad('กลุ่มงานไม่ถูกต้อง');
  if (text.length > 8000) throw bad('รายการกลุ่มงานยาวเกินไป');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > MAX_CATS) throw bad(`กลุ่มงานได้ไม่เกิน ${MAX_CATS} กลุ่ม`);
  return formatCategories(parseCategories(text));
}

export const needsVideo = (category, sub) => /วิดีโอ|วีดิทัศน์|video|录像|视频/i.test(`${category} ${sub}`);

// Validates one work's category against the exhibition's list (by the stored, first label).
export function checkCategory(list, category, subcategory, label = '') {
  const cat = clean(category), sub = clean(subcategory);
  if (!list.length) return { category: cat.slice(0, MAX_NAME), subcategory: sub.slice(0, MAX_NAME) };
  const c = list.find((x) => x.name === cat);
  if (!c) throw bad(`กรุณาเลือกกลุ่มงาน${label}`);
  if (!c.subs.length) return { category: c.name, subcategory: '' };
  if (!c.subs.includes(sub)) throw bad(`กรุณาเลือกประเภทของ ${c.name}${label}`);
  return { category: c.name, subcategory: sub };
}
