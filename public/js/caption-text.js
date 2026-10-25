// Text for printed wall captions (ป้าย caption, 9 x 5.5 cm, 10 per A4 sheet).
// Pure functions, no DOM, so they are unit-tested in tests/captions.test.js.
import { countryName, isCountryCode } from './countries.js';

export const CAPTION_LANGS = ['th', 'en', 'zh'];
export const LANG_TH = { th: 'ไทย', en: 'อังกฤษ', zh: 'จีน' };
const LOCALE = { th: 'th', en: 'en', zh: 'zh-Hans' };

// Fields the preparer can switch on/off, in the order they are printed (owner, 2026-10-26):
// artist, country, title, then technique · size · year on one line. Affiliation and flag are kept
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

// One caption's content. `w` is a row from GET /api/manage/:slug/works.
export function captionContent(w, { langs = ['th'], fields = DEFAULT_FIELDS, techniques = [] } = {}) {
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

  // Technique · size · year on one line in the main language; more lines only for a technique
  // that reads differently in the extra languages.
  const tech = f.technique
    ? distinct([techniqueIn(techniques, w, m, { fallback: true }), ...extra.map((l) => techniqueIn(techniques, w, l))])
    : [];
  const meta = [joinDot([tech[0] || '', f.size ? clean(w.dimensions) : '', f.year ? clean(w.year_created) : '']), ...tech.slice(1)]
    .filter(Boolean);

  return { artists, flag: f.flag && f.country && isCountryCode(code) ? code : '', place, titles, meta };
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
