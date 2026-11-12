// Report for the expert panel (รายงานสำหรับผู้ทรงคุณวุฒิ): artists with their works, grouped by
// category (กลุ่มงาน). Pure functions, no DOM, unit-tested in tests/report.test.js.

const LOCALE = { th: 'th', en: 'en', zh: 'zh-Hans' };
const ORDER = { th: ['th', 'en', 'zh'], en: ['en', 'th', 'zh'], zh: ['zh', 'en', 'th'] };
const clean = (s) => String(s ?? '').replace(/[ \t]+/g, ' ').trim();

// `${base}_${lang}` in the main language, falling back to the others so nothing is blank.
export function pickLang(obj, base, lang = 'th') {
  for (const l of ORDER[lang] || ORDER.th) { const v = clean(obj[`${base}_${l}`]); if (v) return v; }
  return '';
}

export const REPORT_STATUSES = [
  { key: 'all', label: 'ทุกผลงานที่ส่งมา' },
  { key: 'submitted', label: 'รอคัดกรอง' },
  { key: 'shown', label: 'ผ่านคัดกรอง (จัดแสดง)' },
  { key: 'rejected', label: 'ไม่ผ่านคัดกรอง' }
];
export const STATUS_LABEL = { submitted: 'รอคัดกรอง', shown: 'ผ่านคัดกรอง', rejected: 'ไม่ผ่าน' };

export const ARTIST_ORDERS = [
  { key: 'name', label: 'ตามชื่อศิลปิน (ก–ฮ / A–Z)' },
  { key: 'sent', label: 'ตามลำดับที่ส่ง' }
];
export const REPORT_COLS = [2, 3, 4];
export const CONCEPT_MODES = [
  { key: 'short', label: 'ย่อ (ไม่เกิน 4 บรรทัด)' },
  { key: 'full', label: 'เต็ม' },
  { key: 'none', label: 'ไม่แสดง' }
];
export const NO_CATEGORY = '';

// Category list of the exhibition first (its order), then any other value found on works,
// then works without a category ("ไม่ระบุกลุ่มงาน") last.
export function categoryOrder(categories = [], works = []) {
  const out = (categories || []).map((c) => ({ key: c.name, name: c.name, en: c.en || '', zh: c.zh || '' }));
  const seen = new Set(out.map((c) => c.key));
  for (const w of works) {
    const k = clean(w.category);
    if (k && !seen.has(k)) { seen.add(k); out.push({ key: k, name: k, en: '', zh: '' }); }
  }
  out.push({ key: NO_CATEGORY, name: 'ไม่ระบุกลุ่มงาน', en: 'No category', zh: '' });
  return out;
}

export const categoryLabel = (c, lang = 'th') =>
  (lang === 'th' ? c.name : (c[lang] || (lang === 'zh' && c.en) || c.name));

const artistName = (w, lang) => pickLang({ name_th: w.artist_name_th, name_en: w.artist_name_en, name_zh: w.artist_name_zh }, 'name', lang);
const workOrder = (a, b) => (a.display_order - b.display_order) || (a.id - b.id);

// -> { sections: [{ cat, artists: [{ id, works: [...] }], nArtists, nWorks }], total: { works, artists } }
// Each work gets `no` ("001" …), numbered through the whole report in printed order.
// An artist with works in two categories appears in both sections.
export function buildReport(works, { categories = [], status = 'all', cat = null, artistOrder = 'name', lang = 'th' } = {}) {
  const pool = works.filter((w) => !w.deleted_at && (status === 'all' || w.status === status));
  const cats = categoryOrder(categories, pool).filter((c) => cat === null || cat === undefined || cat === '*' || c.key === cat);
  let n = 0;
  const allArtists = new Set();
  const sections = [];
  for (const c of cats) {
    const inCat = pool.filter((w) => clean(w.category) === c.key);
    if (!inCat.length) continue;
    const byArtist = new Map();
    for (const w of [...inCat].sort(workOrder)) {
      if (!byArtist.has(w.artist_id)) byArtist.set(w.artist_id, []);
      byArtist.get(w.artist_id).push(w);
    }
    let artists = [...byArtist.entries()].map(([id, list]) => ({ id, works: list, first: Math.min(...list.map((w) => w.id)) }));
    artists.sort(artistOrder === 'sent'
      ? (a, b) => a.first - b.first
      : (a, b) => artistName(a.works[0], lang).localeCompare(artistName(b.works[0], lang), LOCALE[lang] || 'th') || (a.first - b.first));
    artists = artists.map(({ id, works: list }) => ({
      id, works: list.map((w) => ({ ...w, no: String(++n).padStart(3, '0') }))
    }));
    artists.forEach((a) => allArtists.add(a.id));
    sections.push({ cat: c, artists, nArtists: artists.length, nWorks: inCat.length });
  }
  return { sections, total: { works: n, artists: allArtists.size } };
}

// Bio/concept text -> paragraphs of plain text (escaping is the caller's job).
export const paragraphs = (text) => String(text ?? '').replace(/\r/g, '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
