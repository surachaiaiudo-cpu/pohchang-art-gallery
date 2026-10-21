// Technique groups (เทคนิค). Each exhibition keeps its own list as plain text, one per line,
// "Thai | English | 中文". Artists pick one for each work (stored as the Thai label in
// works.technique_group) and may add free-text detail in technique_th/en/zh ("บนผ้าใบ").
// Older works only have the free text; guessTechnique() suggests a group for a curator to confirm.
// An empty list means the exhibition does not ask for a technique.
import { bad } from './http.js';

export const DEFAULT_TECHNIQUES = [
  'สีน้ำมัน | Oil | 油画',
  'สีอะคริลิก | Acrylic | 丙烯',
  'สีน้ำ | Watercolour | 水彩',
  'สีฝุ่น / เทมเพอรา | Tempera | 坦培拉',
  'พาสเทล / สีชอล์ก | Pastel | 色粉',
  'วาดเส้น (ดินสอ ถ่าน หมึก) | Drawing | 素描',
  'ภาพพิมพ์ | Printmaking | 版画',
  'ปั้น / หล่อ | Modelling & casting | 塑造与铸造',
  'แกะสลัก | Carving | 雕刻',
  'เซรามิก / ดินเผา | Ceramic | 陶瓷',
  'ศิลปะดิจิทัล | Digital | 数字艺术',
  'ภาพถ่าย | Photography | 摄影',
  'วิดีโอ | Video | 影像',
  'สื่อผสม | Mixed media | 综合材料',
  'อื่น ๆ | Other | 其他'
].join('\n');

const MAX_ITEMS = 40, MAX_NAME = 80;
const clean = (s) => String(s || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

// Lenient reader used for display: never throws, drops what does not fit. -> [{ name, en, zh }]
export function parseTechniques(text) {
  const out = [];
  const seen = new Set();
  for (const line of String(text || '').split(/\r?\n/)) {
    const [name = '', en = '', zh = ''] = line.split('|').map((p) => clean(p).slice(0, MAX_NAME));
    if (!name || seen.has(name) || out.length >= MAX_ITEMS) continue;
    seen.add(name);
    out.push({ name, en, zh });
  }
  return out;
}

export const formatTechniques = (list) => list.map(({ name, en, zh }) => (zh ? `${name} | ${en} | ${zh}` : en ? `${name} | ${en}` : name)).join('\n');

// Strict version for what a curator saves.
export function normalizeTechniques(text) {
  if (typeof text !== 'string') throw bad('รายการเทคนิคไม่ถูกต้อง');
  if (text.length > 8000) throw bad('รายการเทคนิคยาวเกินไป');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > MAX_ITEMS) throw bad(`เทคนิคได้ไม่เกิน ${MAX_ITEMS} รายการ`);
  return formatTechniques(parseTechniques(text));
}

// Validates one work's technique group against the exhibition's list.
// `required` is true for artists submitting; curators may also clear it ('').
export function checkTechnique(list, value, { label = '', required = true } = {}) {
  const v = clean(value);
  if (!list.length) return '';
  if (!v && !required) return '';
  const hit = list.find((x) => x.name === v);
  if (!hit) throw bad(`กรุณาเลือกเทคนิค${label}`);
  return hit.name;
}

// Hides the "Technique :" prefix that old imported data carries (the stored text is left as is).
export const cleanTechniqueText = (s) => String(s || '').replace(/^\s*technique\s*:\s*/i, '').trim();

// Keyword rules, most specific first. Each rule names a default group by its Thai and English
// labels so it still finds the group when a curator renames one of them. Matched words are removed
// before the next rule, so "สีน้ำอะคริลิก" counts as acrylic only, not also as watercolour.
const RULES = [
  ['สื่อผสม', 'Mixed media', /สื่อผสม|เทคนิคผสม|mixed\s*media|mixed\s*technique|multimedia|สีผสม/gi],
  ['พาสเทล / สีชอล์ก', 'Pastel', /oil\s*pastels?|oil\s*sticks?|พาสเทล|pastels?|สีชอล์[คก]|chalk/gi],
  ['สีอะคริลิก', 'Acrylic', /(สีน้ำ)?\s*อะ?ค[ริี]+ลิ[คก]|acrylics?/gi],
  ['สีน้ำมัน', 'Oil', /สีน้ำมัน|\boil\b/gi],
  ['สีน้ำ', 'Watercolour', /สีน้ำ|water\s*colou?rs?/gi],
  ['สีฝุ่น / เทมเพอรา', 'Tempera', /สีฝุ่น|เทมเพอรา|tempera|gouache|กวอช|(บน)?(พื้น)?ดินสอพอง/gi],
  ['ภาพพิมพ์', 'Printmaking', /ภาพพิมพ์|แกะไม้|woodcut|wood\s*cut|etching|lithograph\w*|silk\s*screen|screen\s*print\w*|สกรีน|linocut|intaglio|monoprint|monotype/gi],
  ['วาดเส้น (ดินสอ ถ่าน หมึก)', 'Drawing', /วาดเส้น|ดินสอ|แท่งถ่าน|ถ่าน|charcoal|pencil|graphite|\bink\b|หมึก|ปากกา|\bpens?\b|drawing/gi],
  ['เซรามิก / ดินเผา', 'Ceramic', /เซรามิ[กค]ส?|ดินเผา|ceramics?|terracotta|porcelain|stoneware|เครื่องปั้นดินเผา/gi],
  ['แกะสลัก', 'Carving', /แกะสลัก|carv\w*|หินอ่อน|marble/gi],
  ['ปั้น / หล่อ', 'Modelling & casting', /ปั้น|หล่อ|ปูนสด|ดินไทย|เรซิ่น|resin|bronze|สำริด|casting|sculpture|ประติมากรรม/gi],
  ['ศิลปะดิจิทัล', 'Digital', /ดิจิ[ทต]ั?ล|digital/gi],
  ['ภาพถ่าย', 'Photography', /ภาพถ่าย|photo\w*/gi],
  ['วิดีโอ', 'Video', /วิดีโอ|วีดิทัศน์|video/gi]
];

// -> the group name in `list` the free text most likely belongs to, or '' when nothing matches.
// Text that names two or more different groups is suggested as mixed media.
export function guessTechnique(list, text) {
  if (!list.length) return '';
  const find = (th, en) => list.find((x) => x.name === th || (x.en && x.en.toLowerCase() === en.toLowerCase()));
  let rest = cleanTechniqueText(text);
  if (!rest) return '';
  const hits = [];
  for (const [th, en, re] of RULES) {
    if (rest.search(re) < 0) continue;
    rest = rest.replace(re, ' ');
    hits.push([th, en]);
  }
  if (!hits.length) return '';
  const groups = [...new Set(hits.map(([th]) => th))];
  if (groups[0] === 'สื่อผสม' || groups.length > 1) {
    const mixed = find('สื่อผสม', 'Mixed media');
    if (mixed) return mixed.name;
  }
  const hit = find(...hits[0]);
  return hit ? hit.name : '';
}
