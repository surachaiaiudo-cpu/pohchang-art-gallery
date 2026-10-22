// Exhibition catalogue (สูจิบัตร): page geometry, the fields a page can show, the built-in templates and
// the cleaning of templates and per-exhibition settings. Shared by the browser and Pages Functions,
// so it must not touch the DOM. Pages are A4 portrait; every position is in millimetres from the
// top-left corner of the page, every font size in points.

export const PAGE = { w: 210, h: 297 };
export const LANG_CODES = ['th', 'en', 'zh'];
export const LANG_NAMES = { th: 'ไทย', en: 'English', zh: '中文' };

// Fonts a template may use (all are loaded from Google Fonts by public/js/core.js).
export const CATALOG_FONTS = ['IBM Plex Sans Thai', 'Sarabun', 'Anuphan', 'Noto Serif Thai', 'Taviraj', 'Kanit', 'Mitr', 'Chonburi', 'Charm', 'Srisakdi', 'Mali'];

// Data fields: the curator turns each one on or off per exhibition; a template decides where it goes.
export const DATA_FIELDS = [
  { key: 'image', th: 'ภาพผลงาน' },
  { key: 'number', th: 'ลำดับในสูจิบัตร (No.)' },
  { key: 'title', th: 'ชื่อผลงาน' },
  { key: 'artist', th: 'ชื่อศิลปิน' },
  { key: 'country', th: 'สัญชาติ + ธงชาติ' },
  { key: 'avatar', th: 'รูปศิลปิน' },
  { key: 'affiliation', th: 'สังกัด / สถาบันของศิลปิน' },
  { key: 'category', th: 'กลุ่มงาน' },
  { key: 'technique', th: 'เทคนิค' },
  { key: 'dimensions', th: 'ขนาด' },
  { key: 'year', th: 'ปีที่สร้าง' },
  { key: 'concept', th: 'แนวคิด' },
  { key: 'bio', th: 'ประวัติศิลปินโดยย่อ' },
  { key: 'price', th: 'ราคา' },
  { key: 'badge', th: 'ป้ายผ่านผู้ทรงคุณวุฒิ' },
  { key: 'qr', th: 'QR ไปหน้าผลงานบนเว็บ' }
];
// Template-only pieces (always available inside the template).
export const LAYOUT_FIELDS = [
  { key: 'page', th: 'เลขหน้า' },
  { key: 'footer', th: 'ข้อความท้ายหน้า' },
  { key: 'exhibition', th: 'ชื่อนิทรรศการ' },
  { key: 'text', th: 'ข้อความอิสระ' },
  { key: 'line', th: 'เส้น' },
  { key: 'box', th: 'กล่องสี' }
];
export const ALL_FIELDS = [...DATA_FIELDS, ...LAYOUT_FIELDS];
const FIELD_KEYS = ALL_FIELDS.map((f) => f.key);
const IMAGE_FIELDS = ['image', 'avatar', 'qr'];
export const isImageField = (f) => IMAGE_FIELDS.includes(f);

export const REVIEWER_FIELDS = [
  { key: 'name', th: 'ชื่อ-นามสกุล' },
  { key: 'title', th: 'ตำแหน่ง' }
];

export const ORDERS = [
  { key: 'display', th: 'ตามลำดับในนิทรรศการ' },
  { key: 'artist', th: 'ตามชื่อศิลปิน (ก–ฮ / A–Z)' },
  { key: 'title', th: 'ตามชื่อผลงาน' },
  { key: 'category', th: 'ตามกลุ่มงาน แล้วตามลำดับในนิทรรศการ' },
  { key: 'technique', th: 'ตามเทคนิค แล้วตามลำดับในนิทรรศการ' },
  { key: 'country', th: 'ตามประเทศ แล้วตามชื่อศิลปิน' },
  { key: 'submitted', th: 'ตามลำดับการส่งผลงาน' }
];

export const SECTIONS = [
  { key: 'cover', th: 'หน้าปก' },
  { key: 'statement', th: 'บทภัณฑารักษ์' },
  { key: 'committee', th: 'คณะกรรมการผู้ทรงคุณวุฒิ' },
  { key: 'works', th: 'หน้าผลงาน (หน้าละ 1 ผลงาน)' },
  { key: 'index', th: 'สารบัญรายชื่อผลงาน (ท้ายเล่ม)' }
];

export const COVER_STYLES = [
  { key: 'image', th: 'ภาพปกด้านบน ชื่อด้านล่าง' },
  { key: 'full', th: 'ภาพปกเต็มหน้า ชื่อทับภาพ' },
  { key: 'text', th: 'ตัวอักษรอย่างเดียว' }
];

// ------------------------------------------------------------------ colours (CMYK)
// Every colour in a template is stored as CMYK percentages { c, m, y, k } (0-100) for print work.
// Screens and the browser's PDF use RGB, so the page shows the simple (uncalibrated) RGB conversion;
// a print shop should take the CMYK values as the reference.
export const K = (c, m, y, k) => ({ c, m, y, k });
export const NAMED_COLORS = ['ink', 'muted', 'accent', 'paper'];
const pct = (v) => Math.round(Math.min(100, Math.max(0, Number(v) || 0)));
export function cmykToHex(v) {
  const { c, m, y, k } = v || {};
  const ch = (x) => Math.round(255 * (1 - pct(x) / 100) * (1 - pct(k) / 100)).toString(16).padStart(2, '0');
  return `#${ch(c)}${ch(m)}${ch(y)}`;
}
export function hexToCmyk(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  const r = ((n >> 16) & 255) / 255; const g = ((n >> 8) & 255) / 255; const b = (n & 255) / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 0.999) return K(0, 0, 0, 100);
  return K(pct(((1 - r - k) / (1 - k)) * 100), pct(((1 - g - k) / (1 - k)) * 100), pct(((1 - b - k) / (1 - k)) * 100), pct(k * 100));
}
export function cmykOf(v, fallback) {
  if (v && typeof v === 'object' && ['c', 'm', 'y', 'k'].every((x) => Number.isFinite(Number(v[x])))) return K(pct(v.c), pct(v.m), pct(v.y), pct(v.k));
  if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) return hexToCmyk(v);
  return fallback;
}
export const cmykText = (v) => `C${v.c} M${v.m} Y${v.y} K${v.k}`;
// Print palette offered in the designer (values in CMYK).
export const PRINT_PALETTE = [
  { th: 'ขาวกระดาษ', v: K(0, 0, 0, 0) },
  { th: 'ครีมหอศิลป์', v: K(0, 1, 4, 5) },
  { th: 'เทาเส้นแบ่ง', v: K(0, 0, 0, 20) },
  { th: 'เทาคำบรรยาย', v: K(0, 5, 12, 58) },
  { th: 'ดำตัวอักษร', v: K(0, 0, 0, 92) },
  { th: 'ดำสนิท (Rich black)', v: K(60, 40, 40, 100) },
  { th: 'แดงชาด', v: K(10, 85, 95, 20) },
  { th: 'แดงเลือดหมู', v: K(15, 100, 90, 45) },
  { th: 'น้ำตาลอิฐ', v: K(15, 85, 100, 35) },
  { th: 'ทองเฮอริเทจ', v: K(15, 30, 60, 20) },
  { th: 'ครามสยาม', v: K(100, 80, 20, 30) },
  { th: 'เขียวพงไพร', v: K(80, 30, 90, 25) }
];

// ------------------------------------------------------------------ built-in templates
const B = (id, field, x, y, w, h, style = {}) => ({ id, field, x, y, w, h, ...style });

export const BUILTIN_TEMPLATES = [
  {
    ref: 'b:classic',
    name: 'คลาสสิก: ภาพใหญ่ด้านบน',
    description: 'ภาพผลงานเต็มความกว้างด้านบน ข้อมูลผลงานแบบป้ายพิพิธภัณฑ์ด้านล่าง',
    layout: {
      version: 1,
      colors: { paper: K(0, 0, 0, 0), ink: K(0, 0, 0, 92), muted: K(0, 5, 12, 58), accent: K(15, 85, 100, 35) },
      fonts: { head: 'Noto Serif Thai', body: 'IBM Plex Sans Thai' },
      cover: 'image',
      blocks: [
        B('exh', 'exhibition', 15, 10, 140, 6, { size: 8, color: 'muted', upper: true }),
        B('no', 'number', 160, 10, 35, 6, { size: 8, color: 'muted', align: 'right' }),
        B('img', 'image', 15, 20, 180, 178, { fit: 'contain' }),
        B('l1', 'line', 15, 204, 180, 0.4, { color: 'accent' }),
        B('title', 'title', 15, 208, 130, 20, { size: 17, weight: 600, font: 'head' }),
        B('badge', 'badge', 150, 209, 45, 7, { size: 7.5, align: 'right', color: 'accent' }),
        B('artist', 'artist', 15, 230, 120, 12, { size: 11, weight: 500 }),
        B('country', 'country', 140, 231, 55, 7, { size: 9, align: 'right', color: 'muted' }),
        B('tech', 'technique', 15, 243, 180, 10, { size: 9, label: true }),
        B('dim', 'dimensions', 15, 253.5, 90, 6, { size: 9, label: true }),
        B('year', 'year', 105, 253.5, 90, 6, { size: 9, label: true }),
        B('concept', 'concept', 15, 261, 180, 22, { size: 8.5, color: 'muted', lineHeight: 1.45 }),
        B('foot', 'footer', 15, 286, 150, 5, { size: 7, color: 'muted' }),
        B('page', 'page', 170, 286, 25, 5, { size: 7.5, align: 'right', color: 'muted' })
      ]
    }
  },
  {
    ref: 'b:side',
    name: 'ภาพซ้าย ข้อมูลขวา',
    description: 'ภาพผลงานสูงเต็มหน้าทางซ้าย คอลัมน์ข้อมูลศิลปินและผลงานทางขวา มีรูปศิลปินและ QR',
    layout: {
      version: 1,
      colors: { paper: K(0, 0, 0, 0), ink: K(0, 0, 0, 92), muted: K(0, 5, 12, 58), accent: K(100, 80, 20, 30) },
      fonts: { head: 'Anuphan', body: 'IBM Plex Sans Thai' },
      cover: 'full',
      blocks: [
        B('img', 'image', 12, 15, 126, 262, { fit: 'contain', align: 'center' }),
        B('box', 'box', 143, 0, 67, 297, { bg: K(0, 1, 4, 5) }),
        B('no', 'number', 148, 16, 57, 8, { size: 9, weight: 600, color: 'accent' }),
        B('avatar', 'avatar', 148, 28, 30, 30, { fit: 'cover', radius: 15 }),
        B('artist', 'artist', 148, 62, 57, 18, { size: 12, weight: 600, font: 'head' }),
        B('country', 'country', 148, 81, 57, 7, { size: 9, color: 'muted' }),
        B('aff', 'affiliation', 148, 89, 57, 10, { size: 8, color: 'muted' }),
        B('l1', 'line', 148, 102, 57, 0.4, { color: 'accent' }),
        B('title', 'title', 148, 106, 57, 26, { size: 14, weight: 600, font: 'head' }),
        B('tech', 'technique', 148, 134, 57, 12, { size: 8.5, label: true }),
        B('dim', 'dimensions', 148, 147, 57, 6, { size: 8.5, label: true }),
        B('year', 'year', 148, 154, 57, 6, { size: 8.5, label: true }),
        B('badge', 'badge', 148, 162, 57, 7, { size: 7.5, color: 'accent' }),
        B('concept', 'concept', 148, 172, 57, 80, { size: 8, color: 'muted', lineHeight: 1.5 }),
        B('qr', 'qr', 148, 256, 18, 18, {}),
        B('page', 'page', 170, 284, 35, 5, { size: 7.5, align: 'right', color: 'muted' })
      ]
    }
  },
  {
    ref: 'b:label',
    name: 'ป้ายพิพิธภัณฑ์',
    description: 'ภาพผลงานกลางหน้าบนพื้นสีผนัง ป้ายข้อมูลเล็กมุมขวาล่างแบบติดผนังห้องแสดงงาน',
    layout: {
      version: 1,
      colors: { paper: K(0, 1, 3, 5), ink: K(0, 0, 0, 92), muted: K(0, 5, 12, 58), accent: K(10, 85, 95, 20) },
      fonts: { head: 'Taviraj', body: 'IBM Plex Sans Thai' },
      cover: 'text',
      blocks: [
        B('img', 'image', 20, 22, 170, 190, { fit: 'contain' }),
        B('box', 'box', 98, 222, 92, 58, { bg: K(0, 0, 0, 0) }),
        B('no', 'number', 103, 226, 82, 5, { size: 7.5, color: 'muted' }),
        B('title', 'title', 103, 232, 82, 14, { size: 12.5, weight: 600, font: 'head' }),
        B('artist', 'artist', 103, 247, 60, 9, { size: 9.5 }),
        B('country', 'country', 160, 247, 25, 6, { size: 8, align: 'right', color: 'muted' }),
        B('tech', 'technique', 103, 257, 82, 6, { size: 8 }),
        B('dim', 'dimensions', 103, 263, 50, 5, { size: 8 }),
        B('year', 'year', 155, 263, 30, 5, { size: 8, align: 'right' }),
        B('badge', 'badge', 103, 270, 82, 6, { size: 7, color: 'accent' }),
        B('exh', 'exhibition', 20, 286, 120, 5, { size: 7, color: 'muted' }),
        B('page', 'page', 160, 286, 30, 5, { size: 7.5, align: 'right', color: 'muted' })
      ]
    }
  }
];
export const DEFAULT_TEMPLATE = 'b:classic';
export const builtinTemplate = (ref) => BUILTIN_TEMPLATES.find((t) => t.ref === ref) || null;

// ------------------------------------------------------------------ cleaning
const num = (v, min, max, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.min(max, Math.max(min, n)) * 10) / 10;
};
const str = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);
// A colour is CMYK; "#rrggbb" text (older data) is converted. Named page colours stay as names.
const colorRef = (v, fallback = 'ink') => (NAMED_COLORS.includes(v) ? v : cmykOf(v, fallback));
const one = (v, list, fallback) => (list.includes(v) ? v : fallback);
export const MAX_BLOCKS = 60;
// Font sizes (pt) of the pages that are not built from blocks: statement, expert panel, list of works.
export const PAGE_SIZES = [
  { key: 'heading', th: 'หัวเรื่องประจำหน้า', def: 17 },
  { key: 'subheading', th: 'หัวข้อย่อย (ภาษา)', def: 12 },
  { key: 'body', th: 'เนื้อความบทภัณฑารักษ์', def: 10.5 },
  { key: 'name', th: 'ชื่อผู้ทรงคุณวุฒิ', def: 11.5 },
  { key: 'small', th: 'ตำแหน่ง / รายชื่อผลงาน', def: 9 },
  { key: 'pageNo', th: 'เลขหน้า (หน้าเหล่านี้)', def: 8 }
];
// Point sizes offered in the designer (any value 4-96 may be typed).
export const PT_SIZES = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 60, 72];

// Cleans a template layout coming from the designer (never throws: unknown values fall back).
export function normalizeLayout(input) {
  const l = input && typeof input === 'object' ? input : {};
  const c = l.colors && typeof l.colors === 'object' ? l.colors : {};
  const f = l.fonts && typeof l.fonts === 'object' ? l.fonts : {};
  const seen = new Set();
  const blocks = (Array.isArray(l.blocks) ? l.blocks : []).slice(0, MAX_BLOCKS).map((b, i) => {
    if (!b || typeof b !== 'object' || !FIELD_KEYS.includes(b.field)) return null;
    let id = str(b.id, 24).replace(/[^\w-]/g, '') || `b${i}`;
    while (seen.has(id)) id = `${id}x`;
    seen.add(id);
    const out = {
      id,
      field: b.field,
      x: num(b.x, -10, PAGE.w, 15),
      y: num(b.y, -10, PAGE.h, 15),
      w: num(b.w, 0.2, PAGE.w + 20, 50),
      h: num(b.h, 0.2, PAGE.h + 20, 10)
    };
    if (isImageField(b.field)) {
      out.fit = one(b.fit, ['contain', 'cover'], 'contain');
      out.align = one(b.align, ['left', 'center', 'right'], 'center');
      out.radius = num(b.radius, 0, 100, 0);
    } else if (b.field === 'line' || b.field === 'box') {
      out.color = colorRef(b.color, 'ink');
      if (b.field === 'box') out.bg = colorRef(b.bg, K(0, 1, 4, 5));
      if (b.field === 'box') out.radius = num(b.radius, 0, 100, 0);
    } else {
      out.size = num(b.size, 4, 96, 10);
      // Size of the 2nd/3rd language lines in pt; 0 = automatic (78 % of the main size).
      out.altSize = num(b.altSize, 0, 96, 0);
      // false = keep the exact size even when the text overflows its box.
      out.shrink = b.shrink !== false;
      out.weight = one(Number(b.weight), [300, 400, 500, 600, 700], 400);
      out.align = one(b.align, ['left', 'center', 'right', 'justify'], 'left');
      out.color = colorRef(b.color, 'ink');
      out.font = one(b.font, ['head', 'body'], 'body');
      out.lineHeight = num(b.lineHeight, 0.9, 3, 1.35);
      out.italic = !!b.italic;
      out.upper = !!b.upper;
      out.label = !!b.label;
      out.vertical = one(b.vertical, ['top', 'middle', 'bottom'], 'top');
      if (b.field === 'text') {
        const t = b.text && typeof b.text === 'object' ? b.text : {};
        out.text = Object.fromEntries(LANG_CODES.map((k) => [k, str(t[k], 2000)]));
      }
    }
    return out;
  }).filter(Boolean);
  return {
    version: 1,
    colors: {
      paper: cmykOf(c.paper, K(0, 0, 0, 0)), ink: cmykOf(c.ink, K(0, 0, 0, 92)),
      muted: cmykOf(c.muted, K(0, 5, 12, 58)), accent: cmykOf(c.accent, K(15, 85, 100, 35))
    },
    fonts: { head: one(f.head, CATALOG_FONTS, 'Noto Serif Thai'), body: one(f.body, CATALOG_FONTS, 'IBM Plex Sans Thai') },
    cover: one(l.cover, COVER_STYLES.map((s) => s.key), 'image'),
    sizes: Object.fromEntries(PAGE_SIZES.map((x) => [x.key, num((l.sizes || {})[x.key], 4, 72, x.def)])),
    blocks
  };
}

export const DEFAULT_SETTINGS = {
  template: DEFAULT_TEMPLATE,
  langs: ['th', 'en'],
  fields: Object.fromEntries(DATA_FIELDS.map((f) => [f.key, !['price', 'bio', 'affiliation'].includes(f.key)])),
  reviewerFields: { name: true, title: true },
  order: 'display',
  include: 'all',
  sections: { cover: true, statement: true, committee: true, works: true, index: true },
  footer: { th: '', en: '', zh: '' },
  coverNote: { th: '', en: '', zh: '' }
};

// Cleans the per-exhibition settings (exhibitions.catalog JSON). Never throws.
export function normalizeSettings(input) {
  const s = input && typeof input === 'object' ? input : {};
  const d = DEFAULT_SETTINGS;
  const langs = [...new Set((Array.isArray(s.langs) ? s.langs : []).filter((x) => LANG_CODES.includes(x)))];
  const bools = (src, keys, def) => Object.fromEntries(keys.map((k) => [k, src && typeof src[k] === 'boolean' ? src[k] : def[k]]));
  const texts = (src, max) => Object.fromEntries(LANG_CODES.map((k) => [k, str(src && src[k], max).trim()]));
  const template = typeof s.template === 'string' && (/^b:[a-z0-9-]{1,30}$/.test(s.template) || /^t:\d{1,9}$/.test(s.template))
    ? s.template : d.template;
  return {
    template,
    langs: langs.length ? langs : d.langs.slice(),
    fields: bools(s.fields, DATA_FIELDS.map((f) => f.key), d.fields),
    reviewerFields: bools(s.reviewerFields, REVIEWER_FIELDS.map((f) => f.key), d.reviewerFields),
    order: one(s.order, ORDERS.map((o) => o.key), d.order),
    include: one(s.include, ['all', 'endorsed'], d.include),
    sections: bools(s.sections, SECTIONS.map((x) => x.key), d.sections),
    footer: texts(s.footer, 200),
    coverNote: texts(s.coverNote, 600)
  };
}

export function parseSettings(text) {
  try { return normalizeSettings(JSON.parse(text || '{}')); } catch { return normalizeSettings({}); }
}

// ------------------------------------------------------------------ book helpers (pure)

// Values of one multilingual field in the chosen languages, without repeats; falls back to any
// language so a missing translation never leaves the page blank.
export function values(obj, base, langs) {
  const out = [];
  for (const l of langs) {
    const v = String((obj && obj[`${base}_${l}`]) || '').trim();
    if (v && !out.includes(v)) out.push(v);
  }
  if (!out.length) {
    for (const l of ['th', 'en', 'zh']) {
      const v = String((obj && obj[`${base}_${l}`]) || '').trim();
      if (v) return [v];
    }
  }
  return out;
}

export const cleanTechnique = (s) => String(s || '').replace(/^\s*technique\s*:\s*/i, '').trim();

// A list item's label in one language: Thai is `name`, the others fall back to English, then Thai.
export function listLabel(list, name, l) {
  const item = (list || []).find((x) => x.name === name);
  if (!item) return name || '';
  if (l === 'th') return item.name;
  if (l === 'zh') return item.zh || item.en || item.name;
  return item.en || item.name;
}

export function techniqueValues(list, w, langs) {
  const out = [];
  for (const l of langs) {
    const detail = cleanTechnique(w[`technique_${l}`]);
    let v;
    if (w.technique_group) {
      const label = listLabel(list, w.technique_group, l);
      v = detail && !detail.toLowerCase().includes(label.toLowerCase()) ? `${label} · ${detail}` : (detail || label);
    } else {
      v = detail;
    }
    if (v && !out.includes(v)) out.push(v);
  }
  if (!out.length) {
    const any = cleanTechnique(w.technique_th || w.technique_en || w.technique_zh) || w.technique_group || '';
    if (any) out.push(any);
  }
  return out;
}

// Works in book order. `collator(lang)` returns a compare function (Intl.Collator in the browser).
export function orderWorks(works, settings, ex, collator = () => (a, b) => (a < b ? -1 : a > b ? 1 : 0)) {
  const lang = settings.langs[0];
  const cmp = collator(lang);
  const nameOf = (w) => values(w, 'artist_name', [lang])[0] || '';
  const titleOf = (w) => values(w, 'title', [lang])[0] || '';
  const listed = (settings.include === 'endorsed' ? works.filter((w) => w.endorsed) : works.slice());
  const byDisplay = (a, b) => (a.display_order - b.display_order) || (a.id - b.id);
  const rank = (list, name) => { const i = (list || []).findIndex((x) => x.name === name); return i < 0 ? 9999 : i; };
  const sorters = {
    display: byDisplay,
    submitted: (a, b) => a.id - b.id,
    artist: (a, b) => cmp(nameOf(a), nameOf(b)) || byDisplay(a, b),
    title: (a, b) => cmp(titleOf(a), titleOf(b)) || byDisplay(a, b),
    category: (a, b) => (rank(ex.categories, a.category) - rank(ex.categories, b.category)) || byDisplay(a, b),
    technique: (a, b) => (rank(ex.techniques, a.technique_group) - rank(ex.techniques, b.technique_group)) || byDisplay(a, b),
    country: (a, b) => cmp(a.nationality || 'ZZ', b.nationality || 'ZZ') || cmp(nameOf(a), nameOf(b)) || byDisplay(a, b)
  };
  return listed.sort(sorters[settings.order] || byDisplay);
}

// "1, 3-5" -> [1, 3, 4, 5] within 1..max (for printing chosen pages).
export function parsePageList(text, max) {
  const out = new Set();
  for (const part of String(text || '').split(/[,\s]+/)) {
    if (!part) continue;
    const m = part.match(/^(\d+)(?:[-–](\d+))?$/);
    if (!m) return null;
    let a = Number(m[1]);
    let b = m[2] ? Number(m[2]) : a;
    if (a > b) [a, b] = [b, a];
    if (a < 1 || b > max) return null;
    for (let i = a; i <= b; i += 1) out.add(i);
  }
  return [...out].sort((x, y) => x - y);
}

// Words printed in the book, in each book language.
export const BOOK_WORDS = {
  th: { catalogue: 'สูจิบัตรนิทรรศการ', statement: 'บทภัณฑารักษ์', committee: 'คณะกรรมการผู้ทรงคุณวุฒิ', index: 'รายชื่อผลงาน',
    no: 'ลำดับ', title: 'ชื่อผลงาน', artist: 'ศิลปิน', page: 'หน้า', technique: 'เทคนิค', dimensions: 'ขนาด', year: 'ปี',
    price: 'ราคา', category: 'กลุ่มงาน', country: 'ประเทศ', concept: 'แนวคิด', bio: 'ประวัติ', affiliation: 'สังกัด', works: 'ผลงาน', artists: 'ศิลปิน' },
  en: { catalogue: 'Exhibition Catalogue', statement: 'Curatorial Statement', committee: 'Expert Panel', index: 'List of Works',
    no: 'No.', title: 'Title', artist: 'Artist', page: 'Page', technique: 'Technique', dimensions: 'Size', year: 'Year',
    price: 'Price', category: 'Category', country: 'Country', concept: 'Concept', bio: 'Biography', affiliation: 'Affiliation', works: 'works', artists: 'artists' },
  zh: { catalogue: '展览图录', statement: '策展论述', committee: '专家评审委员会', index: '作品目录',
    no: '编号', title: '作品名称', artist: '艺术家', page: '页', technique: '技法', dimensions: '尺寸', year: '年份',
    price: '价格', category: '类别', country: '国家', concept: '创作理念', bio: '简介', affiliation: '单位', works: '件作品', artists: '位艺术家' }
};
export const words = (key, langs) => [...new Set(langs.map((l) => BOOK_WORDS[l][key]))];
