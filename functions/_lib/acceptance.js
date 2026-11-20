// Acceptance page (ลงนามตอบรับ, owner 2026-11-14/20): the 20th "Invitation Reply Form" on the website.
// - Only artists with result ผ่าน (not withdrawn) can be found (search by name) and sign.
// - The form is pre-filled with what staff entered; the artist corrects it and the corrected values are used
//   at once (owner 2026-11-20), while the staff-entered values and the list of changes are kept.
// - Anyone may fill it in for the artist (self / coordinator / friend). Signature = typed name + tick.
// - Email and phone are never sent to the public page (only masked hints); blank = keep what is on file.
import * as v from './validate.js';
import { bad, notFound } from './http.js';
import { findBySlug, isPublic } from './exhibitions.js';

export const TITLES = ['mr', 'miss', 'mrs'];
export const TYPES = ['painting', 'sculpture', 'printmaking', 'thai_art', 'ceramics', 'digital_video', 'mixed_other'];
export const FILLED_BY = ['self', 'coordinator', 'friend'];
export const MIN_PHOTO_PIXELS = 5e6;          // form: photos at least 5 megapixels
export const MAX_EXHIBITIONS = 10;
export const CORE = ['name_th', 'name_en', 'email', 'phone', 'nationality', 'affiliation', 'avatar_url'];

// Open from the switch until the end of the closing day in Bangkok (UTC+7). No closing day = open while switched on.
export function acceptWindow(ex, at = Date.now()) {
  if (!ex.accept_open) return { open: false, reason: 'ยังไม่เปิดให้ลงนามตอบรับ' };
  if (ex.accept_closes_on) {
    const end = Date.parse(`${ex.accept_closes_on}T23:59:59+07:00`);
    if (Number.isFinite(end) && at > end) return { open: false, reason: 'ปิดรับการลงนามตอบรับแล้ว' };
  }
  return { open: true, reason: '' };
}

// "somchai@gmail.com" -> "so•••••@gmail.com"; "0812345678" -> "••••••5678"
export function maskEmail(e) {
  const [u, d] = String(e || '').split('@');
  if (!u || !d) return '';
  return `${u.slice(0, Math.min(2, u.length))}${'•'.repeat(Math.max(3, u.length - 2))}@${d}`;
}
export function maskPhone(p) {
  const s = String(p || '').replace(/\s+/g, '');
  if (s.length < 4) return '';
  return `${'•'.repeat(Math.max(3, s.length - 4))}${s.slice(-4)}`;
}

// Search helpers: case-insensitive, spaces collapsed.
export const normSearch = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

// Validate the reply form. `onFile` = what the artist already has (to decide what is required).
export function parseReply(b, onFile = {}) {
  const core = {
    name_en: v.text(b.name_en, { field: 'Name', max: 200, required: true }),
    name_th: v.text(b.name_th, { field: 'Name in your language', max: 200 }),
    email: v.email(b.email),
    phone: v.text(b.phone, { field: 'Tel. / Mobile', max: 40 }),
    nationality: v.country(b.nationality, { field: 'Nationality', required: true }),
    affiliation: v.text(b.affiliation, { field: 'Institution / workplace', max: 300 })
  };
  if (!core.email && !onFile.email) throw bad('กรุณากรอกอีเมล (Email is required)');
  const age = b.age === '' || b.age === null || b.age === undefined ? null : v.int(b.age, { field: 'Age', min: 10, max: 120 });
  const exhibitions = (Array.isArray(b.exhibitions) ? b.exhibitions : []).slice(0, MAX_EXHIBITIONS)
    .map((x, i) => ({
      year: v.text(x && x.year, { field: `Exhibition ${i + 1} year`, max: 20 }),
      detail: v.text(x && x.detail, { field: `Exhibition ${i + 1}`, max: 500 })
    }))
    .filter((x) => x.year || x.detail);
  const types = [...new Set((Array.isArray(b.types) ? b.types : []).map(String))].filter((x) => TYPES.includes(x));
  if (!types.length) throw bad('กรุณาเลือกประเภทผลงานอย่างน้อย 1 อย่าง (Type of your artworks)');
  const typeOther = v.text(b.type_other, { field: 'Other type', max: 300 });
  if (types.includes('mixed_other') && !typeOther) throw bad('กรุณาระบุประเภทผลงานอื่นๆ (please specify)');
  const peer = v.oneOf(b.peer_review, ['yes', 'no'], { field: 'Artwork peer review process' });
  const f = b.food && typeof b.food === 'object' ? b.food : {};
  const food = {
    vegetarian: !!f.vegetarian,
    halal: !!f.halal,
    allergy: v.text(f.allergy, { field: 'Food allergy', max: 300 }),
    other: v.text(f.other, { field: 'Other food restriction', max: 300 })
  };
  const followers = b.followers === '' || b.followers === undefined || b.followers === null ? 0 : v.int(b.followers, { field: 'Followers', min: 0, max: 10 });
  if (followers > 0 && b.followers_agree !== true) throw bad('กรุณายืนยันค่าใช้จ่ายของผู้ติดตาม (followers fee)');
  // One earlier artwork for the catalogue (owner 2026-11-20), next to the work made at the workshop. The image is
  // added by the endpoint (new upload, or the one from an earlier reply).
  const w = b.work && typeof b.work === 'object' ? b.work : {};
  const work = {
    title: v.text(w.title, { field: 'Artwork title', max: 300, required: true }),
    technique: v.text(w.technique, { field: 'Artwork technique', max: 300, required: true }),
    dimensions: v.text(w.dimensions, { field: 'Artwork size', max: 120, required: true }),
    year: v.text(w.year, { field: 'Artwork year', max: 20, required: true }),
    concept: v.text(w.concept, { field: 'Artwork concept', max: 2000, multiline: true })
  };
  const data = {
    work,
    title: v.oneOf(b.title, ['', ...TITLES], { field: 'Title', fallback: '' }),
    edu_institution: v.text(b.edu_institution, { field: 'Institution', max: 300 }),
    edu_field: v.text(b.edu_field, { field: 'Field of study', max: 300 }),
    edu_degree: v.text(b.edu_degree, { field: 'Degree', max: 200 }),
    age,
    contact_address: v.text(b.contact_address, { field: 'Contact address', max: 600, multiline: true }),
    exhibitions,
    types,
    type_other: typeOther,
    peer_review: peer,
    food,
    followers,
    followers_agree: followers > 0
  };
  if (b.agree_conditions !== true) throw bad('กรุณายอมรับเงื่อนไขของโครงการ (Please accept the notes 1–7)');
  if (b.agree_accept !== true) throw bad('กรุณาติ๊กยืนยันการเข้าร่วม (I accept the invitation)');
  const signedName = v.text(b.signed_name, { field: 'Signature (type your name)', max: 200, required: true });
  if (signedName.length < 2) throw bad('กรุณาพิมพ์ชื่อเพื่อลงนาม (type your name to sign)');
  const filledBy = v.oneOf(b.filled_by, FILLED_BY, { field: 'Filled in by', fallback: 'self' });
  return { core, data, signedName, filledBy };
}

// Which core fields change (blank email / phone / native name = keep what is on file).
export function coreUpdate(artist, core, photoUrl) {
  const next = {
    name_en: core.name_en,
    name_th: core.name_th || artist.name_th || core.name_en,
    email: core.email || artist.email,
    phone: core.phone || artist.phone,
    nationality: core.nationality,
    affiliation: core.affiliation,
    avatar_url: photoUrl || artist.avatar_url
  };
  const changes = [];
  for (const k of CORE) {
    const from = String(artist[k] ?? '');
    const to = String(next[k] ?? '');
    if (from !== to) changes.push({ field: k, from, to });
  }
  return { next, changes };
}

export const parseJson = (s, fallback) => {
  try { const x = JSON.parse(s || ''); return x ?? fallback; } catch { return fallback; }
};

// The acceptance page works for a draft exhibition too (the 20th is prepared before it is public), but only
// while its switch is on; otherwise a non-public exhibition is "not found" as everywhere else.
export async function loadAcceptExhibition(db, slug) {
  const ex = await findBySlug(db, slug);
  if (!ex || (!ex.accept_open && !isPublic(ex))) throw notFound('ไม่พบนิทรรศการ');
  return ex;
}

// Artists who can sign: result ผ่าน and not withdrawn.
export const SIGNABLE = "roster = 'selected' AND withdrawn = 0";
