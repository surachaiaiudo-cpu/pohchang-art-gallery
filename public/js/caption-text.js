// Text for printed wall captions (ป้าย caption, 9 x 5.5 cm, 10 per A4 sheet).
// Pure functions, no DOM, so they are unit-tested in tests/captions.test.js.
import { countryName, isCountryCode } from './countries.js';

export const CAPTION_LANGS = ['th', 'en', 'zh'];
export const LANG_TH = { th: 'ไทย', en: 'อังกฤษ', zh: 'จีน' };
const LOCALE = { th: 'th', en: 'en', zh: 'zh-Hans' };

// Fields the preparer can switch on/off, in the order they are printed (owner, 2026-10-26):
// artist, country, title, technique, then size · year on one line. Affiliation and flag are kept
// as options, off by default.
export const CAPTION_FIELDS = [
  { key: 'artist', label: 'ชื่อศิลปิน' },
  { key: 'country', label: 'ประเทศ' },
  { key: 'flag', label: 'ธงชาติ (หน้าชื่อประเทศ)' },
  { key: 'affiliation', label: 'สังกัด' },
  { key: 'title', label: 'ชื่อผลงาน' },
  { key: 'technique', label: 'เทคนิค' },
  { key: 'size', label: 'ขนาด' },
  { key: 'year', label: 'ปีที่สร้าง' }
];
export const DEFAULT_FIELDS = { artist: true, country: true, flag: false, affiliation: false, title: true, technique: true, size: true, year: true };

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const cleanTechnique = (s) => clean(s).replace(/^technique\s*:\s*/i, '').trim();

// Value of `${base}_${lang}` only (no fallback): extra-language lines are skipped when empty.
const own = (obj, base, lang) => clean(obj[`${base}_${lang}`]);
// Main-language value with a fallback so the caption is never blank.
function main(obj, base, lang) {
  const order = { th: ['th', 'en', 'zh'], en: ['en', 'th', 'zh'], zh: ['zh', 'en', 'th'] }[lang];
  for (const l of order) { const v = own(obj, base, l); if (v) return v; }
  return '';
}

// Languages after the main one, de-duplicated, only known codes.
export function normLangs(mainLang, extra = []) {
  const m = CAPTION_LANGS.includes(mainLang) ? mainLang : 'th';
  return [m, ...CAPTION_LANGS.filter((l) => l !== m && extra.includes(l))];
}

// Technique in one language: the group label in that language, plus the artist's own detail
// when it says more (same rule as techniqueLabel() in i18n.js).
export function techniqueIn(list, w, lang, { fallback = false } = {}) {
  const item = (list || []).find((x) => x.name === w.technique_group);
  const detail = cleanTechnique(fallback ? main(w, 'technique', lang) : own(w, 'technique', lang));
  if (!w.technique_group) return detail;
  const label = lang === 'th' ? w.technique_group : (item && item[lang]) || (lang === 'zh' && item && item.en) || (fallback ? w.technique_group : '');
  if (!detail) return label;
  if (!label) return detail;
  const words = [label, w.technique_group, (item && item.en) || '', (item && item.zh) || '']
    .flatMap((x) => x.split(/[/()]/)).map((x) => x.trim().toLowerCase()).filter((x) => x.length > 1);
  return words.some((x) => detail.toLowerCase().includes(x)) ? detail : `${label} · ${detail}`;
}

const joinDot = (parts) => parts.filter(Boolean).join(' · ');
// Pairs [main, ...extra] -> keeps extra values only when they differ from the ones before.
const distinct = (values) => values.filter((v, i) => v && !values.slice(0, i).includes(v));

// Units for the size line (owner, 2026-10-26): added only when the text has numbers but no unit,
// written in the caption's main language.
export const UNITS = [
  { key: 'cm', label: 'เซนติเมตร (ซม. / cm)', th: 'ซม.', en: 'cm', zh: '厘米' },
  { key: 'mm', label: 'มิลลิเมตร (มม. / mm)', th: 'มม.', en: 'mm', zh: '毫米' },
  { key: 'm', label: 'เมตร (ม. / m)', th: 'ม.', en: 'm', zh: '米' },
  { key: 'in', label: 'นิ้ว (in)', th: 'นิ้ว', en: 'in', zh: '英寸' }
];
export function withUnit(text, unit = 'cm', lang = 'th') {
  const t = clean(text);
  if (!t || !/\d/.test(t)) return t;
  // "80 x 100", "80×100", "80*100" carry no unit; any other letters (cm, ซม., นิ้ว, size …) or ″ ' count as one.
  const rest = t.replace(/^(size|ขนาด)\s*:?\s*/i, '').replace(/(\d)\s*[xX×*]\s*(?=\d)/g, '$1 ');
  if (/[A-Za-z\u0E00-\u0E7F\u3400-\u9FFF"″'′]/.test(rest)) return t;
  const u = UNITS.find((x) => x.key === unit) || UNITS[0];
  return `${t} ${u[lang] || u.en}`;
}

// One caption's content. `w` is a row from GET /api/manage/:slug/works.
export function captionContent(w, { langs = ['th'], fields = DEFAULT_FIELDS, techniques = [], unit = 'cm' } = {}) {
  const [m, ...extra] = langs;
  const f = { ...DEFAULT_FIELDS, ...fields };
  const titles = f.title ? distinct([main(w, 'title', m), ...extra.map((l) => own(w, 'title', l))]) : [];
  const artistRow = { name_th: w.artist_name_th, name_en: w.artist_name_en, name_zh: w.artist_name_zh };
  const artists = f.artist ? distinct([main(artistRow, 'name', m), ...extra.map((l) => own(artistRow, 'name', l))]) : [];

  // Country (in every chosen language, joined with " / ") · affiliation.
  const code = clean(w.nationality);
  const countries = f.country && code
    ? distinct(isCountryCode(code) ? langs.map((l) => countryName(code, LOCALE[l])) : [code])
    : [];
  const place = joinDot([countries.join(' / '), f.affiliation ? clean(w.affiliation) : '']);

  // Owner, 2026-10-26: technique on its own line (extra-language techniques right under it when
  // they read differently), then size · year on one line.
  const tech = f.technique
    ? distinct([techniqueIn(techniques, w, m, { fallback: true }), ...extra.map((l) => techniqueIn(techniques, w, l))])
    : [];
  const dims = joinDot([f.size ? withUnit(w.dimensions, unit, m) : '', f.year ? clean(w.year_created) : '']);

  return { artists, flag: f.flag && f.country && isCountryCode(code) ? code : '', place, titles, tech, dims };
}

// Sort orders for the print run.
export const CAPTION_ORDERS = [
  { key: 'display', label: 'ตามลำดับในนิทรรศการ' },
  { key: 'artist', label: 'ตามชื่อศิลปิน' },
  { key: 'title', label: 'ตามชื่อผลงาน' },
  { key: 'id', label: 'ตามลำดับที่ส่ง' }
];
export function sortWorks(works, order = 'display', lang = 'th') {
  const by = {
    display: (a, b) => (a.display_order - b.display_order) || (a.id - b.id),
    id: (a, b) => a.id - b.id,
    artist: (a, b) => main({ name_th: a.artist_name_th, name_en: a.artist_name_en, name_zh: a.artist_name_zh }, 'name', lang)
      .localeCompare(main({ name_th: b.artist_name_th, name_en: b.artist_name_en, name_zh: b.artist_name_zh }, 'name', lang), LOCALE[lang]) || (a.id - b.id),
    title: (a, b) => main(a, 'title', lang).localeCompare(main(b, 'title', lang), LOCALE[lang]) || (a.id - b.id)
  }[order] || ((a, b) => a.id - b.id);
  return [...works].sort(by);
}

// Splits captions over A4 sheets of 10; `skip` leaves the first slots empty (a sheet already partly used).
export const PER_SHEET = 10;
export function paginate(items, skip = 0) {
  const s = Math.max(0, Math.min(PER_SHEET - 1, Math.floor(Number(skip) || 0)));
  const slots = [...Array(s).fill(null), ...items];
  const sheets = [];
  for (let i = 0; i < slots.length; i += PER_SHEET) sheets.push(slots.slice(i, i + PER_SHEET));
  return sheets;
}

// ------------------------------------------------------------------ design settings
// Saved with the exhibition (exhibitions.caption_settings, JSON) so the whole team prints the same
// captions (owner, 2026-10-26). normalizeCaptionSettings() is used by the page and by the server.

// Font size per field, in pt (owner: one size per field; extra-language lines are 80 % of it).
export const SIZE_FIELDS = [
  { key: 'artist', label: 'ชื่อศิลปิน', def: 11 },
  { key: 'place', label: 'ประเทศ / สังกัด', def: 8 },
  { key: 'title', label: 'ชื่อผลงาน', def: 11 },
  { key: 'meta', label: 'เทคนิค / ขนาด · ปี', def: 8 }
];
export const PT_SIZES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 13, 14, 15, 16, 18];
export const EXTRA_LANG_SCALE = 0.8;
export const LOGO_ALIGNS = [{ key: 'top', label: 'บน' }, { key: 'middle', label: 'กลาง' }, { key: 'bottom', label: 'ล่าง' }];
export const BG_AREAS = [
  { key: 'none', label: 'ไม่มีสีพื้น (ขาว)' },
  { key: 'whole', label: 'ทั้งใบ' },
  { key: 'logo', label: 'เฉพาะส่วนโลโก้ (30%)' },
  { key: 'details', label: 'เฉพาะส่วนรายละเอียด (70%)' }
];
export const BG_ANGLES = [
  { key: 90, label: 'ซ้าย → ขวา' },
  { key: 270, label: 'ขวา → ซ้าย' },
  { key: 180, label: 'บน → ล่าง' },
  { key: 0, label: 'ล่าง → บน' },
  { key: 135, label: 'เฉียง ↘' },
  { key: 45, label: 'เฉียง ↗' }
];
// Strength of an uploaded background picture over the colour/gradient (%).
export const IMG_OPACITIES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
export const TEXT_COLORS = [{ key: 'auto', label: 'อัตโนมัติ (อ่านง่าย)' }, { key: 'dark', label: 'เข้ม' }, { key: 'light', label: 'ขาว' }];

// Colours of the 7 exhibition themes (same values as public/css/themes.css).
export const THEME_COLORS = {
  'white-cube': { wall: '#f4f3f0', ink: '#141414', accent: '#b4321f' },
  'thai-classic': { wall: '#f0e8d8', ink: '#2b1b12', accent: '#8e2a1e', accent2: '#b8892c' },
  'thai-contemporary': { wall: '#eeeae4', ink: '#1f1b18', accent: '#27406b' },
  monochrome: { wall: '#f2f2f2', ink: '#000000', accent: '#000000' },
  pop: { wall: '#fff1d6', ink: '#1d1035', accent: '#d1135a', accent2: '#2649e8' },
  craft: { wall: '#ece4d4', ink: '#34291f', accent: '#3f6e4a' },
  heritage: { wall: '#22161a', ink: '#120a0b', accent: '#d4af37' }
};

const HEX = /^#[0-9a-f]{6}$/i;
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;
// t = 0 -> a, t = 1 -> b
export const mix = (a, b, t) => rgbToHex(hexToRgb(a).map((x, i) => x + (hexToRgb(b)[i] - x) * t));
export function luminance(hex) {
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function themePalette(ex = {}) {
  const base = THEME_COLORS[ex.theme_preset] || THEME_COLORS['white-cube'];
  const o = ex.theme_overrides || {};
  const accent = HEX.test(o.accent || '') ? o.accent.toLowerCase() : base.accent;
  // A second colour for two-colour gradients: the theme's own, else a lighter accent.
  const accent2 = base.accent2 || mix(accent, '#ffffff', 0.45);
  return { ...base, accent, accent2 };
}

// Gradient templates built from the exhibition's theme colours. id -> { label, area, c1, c2, angle }.
export function captionTemplates(ex) {
  const p = themePalette(ex);
  const deep = mix(p.accent, '#000000', 0.45);
  return [
    { id: 'plain', label: 'ขาวเรียบ', area: 'none', c1: '#ffffff', c2: '#ffffff', angle: 90 },
    { id: 'logo-accent', label: 'แถบโลโก้ไล่สีธีม', area: 'logo', c1: p.accent, c2: p.accent2, angle: 180 },
    { id: 'logo-deep', label: 'แถบโลโก้เข้ม → สีธีม', area: 'logo', c1: deep, c2: p.accent, angle: 180 },
    { id: 'soft', label: 'ไล่สีอ่อนทั้งใบ', area: 'whole', c1: mix(p.accent, '#ffffff', 0.82), c2: '#ffffff', angle: 90 },
    { id: 'wall', label: 'สีผนังธีม → ขาว', area: 'whole', c1: luminance(p.wall) > 0.4 ? p.wall : mix(p.wall, '#ffffff', 0.85), c2: '#ffffff', angle: 135 },
    { id: 'rich', label: 'ไล่สีเข้มทั้งใบ', area: 'whole', c1: deep, c2: p.accent, angle: 135 },
    { id: 'duo', label: 'สองสีธีม ทั้งใบ', area: 'whole', c1: p.accent, c2: p.accent2, angle: 45 }
  ];
}

const num = (v, list, def) => (list.includes(Number(v)) ? Number(v) : def);
const pickKey = (v, list, def) => (list.some((x) => x.key === v) ? v : def);

export function defaultCaptionSettings() {
  return {
    main: 'th', extra: ['en'], fields: { ...DEFAULT_FIELDS },
    sizes: Object.fromEntries(SIZE_FIELDS.map((f) => [f.key, f.def])),
    logoAlign: 'middle', template: 'plain', unit: 'cm', imgLogo: 100, imgBody: 100,
    bg: { area: 'none', c1: '#ffffff', c2: '#ffffff', angle: 90 }, text: 'auto'
  };
}

// Anything unknown or malformed falls back to the default; never throws.
export function normalizeCaptionSettings(input) {
  let s = input;
  if (typeof s === 'string') { try { s = JSON.parse(s || '{}'); } catch { s = {}; } }
  if (!s || typeof s !== 'object' || Array.isArray(s)) s = {};
  const d = defaultCaptionSettings();
  const main = CAPTION_LANGS.includes(s.main) ? s.main : d.main;
  const extra = Array.isArray(s.extra) ? CAPTION_LANGS.filter((l) => l !== main && s.extra.includes(l)) : d.extra.filter((l) => l !== main);
  const fields = {};
  for (const f of CAPTION_FIELDS) fields[f.key] = s.fields && typeof s.fields[f.key] === 'boolean' ? s.fields[f.key] : DEFAULT_FIELDS[f.key];
  const sizes = {};
  for (const f of SIZE_FIELDS) sizes[f.key] = num(s.sizes && s.sizes[f.key], PT_SIZES, f.def);
  const b = s.bg && typeof s.bg === 'object' ? s.bg : {};
  const bg = {
    area: pickKey(b.area, BG_AREAS, d.bg.area),
    c1: HEX.test(b.c1 || '') ? b.c1.toLowerCase() : d.bg.c1,
    c2: HEX.test(b.c2 || '') ? b.c2.toLowerCase() : d.bg.c2,
    angle: num(b.angle, BG_ANGLES.map((x) => x.key), d.bg.angle)
  };
  const template = typeof s.template === 'string' && /^[a-z-]{1,20}$/.test(s.template) ? s.template : d.template;
  return {
    main, extra, fields, sizes,
    logoAlign: pickKey(s.logoAlign, LOGO_ALIGNS, d.logoAlign),
    unit: pickKey(s.unit, UNITS, d.unit),
    imgLogo: num(s.imgLogo, IMG_OPACITIES, d.imgLogo),
    imgBody: num(s.imgBody, IMG_OPACITIES, d.imgBody),
    template, bg,
    text: pickKey(s.text, TEXT_COLORS, d.text)
  };
}

// The background actually printed: a template follows the exhibition's current theme colours;
// 'custom' uses the saved colours.
export function resolveBackground(settings, ex) {
  if (settings.template !== 'custom') {
    const t = captionTemplates(ex).find((x) => x.id === settings.template) || captionTemplates(ex)[0];
    return { area: t.area, c1: t.c1, c2: t.c2, angle: t.angle };
  }
  return settings.bg;
}
export const gradientCss = (bg) => (bg.c1 === bg.c2 ? bg.c1 : `linear-gradient(${bg.angle}deg, ${bg.c1}, ${bg.c2})`);
// Text colour on a gradient: judged on its darkest end so every part stays readable.
export function textOn(bg, choice = 'auto') {
  if (choice === 'dark') return '#111111';
  if (choice === 'light') return '#ffffff';
  return Math.min(luminance(bg.c1), luminance(bg.c2)) > 0.18 ? '#111111' : '#ffffff';
}
