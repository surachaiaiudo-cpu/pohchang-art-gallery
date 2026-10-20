// Import a past exhibition from the old event sites (one Pages project per event, e.g.
// https://sirikit.pages.dev). Only what those sites publish is read: the approved works from
// /api/submissions and the title from /api/config. Images stay on the old Cloudinary accounts.
import { bad, HttpError } from './http.js';
import { COUNTRY_ALIASES } from '../../public/js/countries.js';
import { COUNTRY_NAMES } from './country-names.js';

export const CHUNK = 40;

export function sourceUrl(value, env = {}) {
  let u;
  try { u = new URL(String(value || '').trim()); } catch { throw bad('ลิงก์งานเดิมไม่ถูกต้อง เช่น https://sirikit.pages.dev'); }
  // Local development only: lets tests point at a stand-in old site on http://localhost.
  if (env.DEV_ALLOW_HTTP_IMPORT === '1' && u.protocol === 'http:' && u.hostname === 'localhost') return u.origin;
  if (u.protocol !== 'https:') throw bad('ลิงก์งานเดิมต้องขึ้นต้นด้วย https://');
  if (!/^[a-z0-9.-]+$/i.test(u.hostname) || !u.hostname.includes('.')) throw bad('ลิงก์งานเดิมไม่ถูกต้อง');
  return u.origin;
}

async function getJson(url) {
  let res;
  try { res = await fetch(url, { headers: { Accept: 'application/json' } }); } catch { res = null; }
  if (!res || !res.ok) throw new HttpError(502, `เปิดข้อมูลจากระบบเดิมไม่ได้ (${res ? res.status : 'เชื่อมต่อไม่ได้'}): ${url}`);
  try { return await res.json(); } catch { throw new HttpError(502, 'ข้อมูลจากระบบเดิมไม่ใช่รูปแบบที่รู้จัก'); }
}

export async function fetchConfig(origin) {
  try { return await getJson(`${origin}/api/config`); } catch { return {}; }
}

export async function fetchWorks(origin, { limit = 1000, offset = 0 } = {}) {
  const d = await getJson(`${origin}/api/submissions?limit=${limit}&offset=${offset}`);
  if (!d || !Array.isArray(d.submissions)) throw new HttpError(502, 'ข้อมูลจากระบบเดิมไม่ใช่รูปแบบที่รู้จัก (ไม่พบรายการผลงาน)');
  // The public list only contains approved works; filter again in case an admin view leaks through.
  return d.submissions.filter((w) => !w.status || w.status === 'approved');
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFKC').replace(/[\s.,'’()\-_]/g, '');
const ALIASES = Object.fromEntries(Object.entries(COUNTRY_ALIASES).flatMap(([code, names]) => names.map((n) => [norm(n), code])));

// Free text -> ISO code. Text that is not a country is kept as typed (shown as plain text,
// fixable by the curator), except anything that looks like an email address, which is dropped.
export function matchCountry(raw) {
  const text = String(raw || '').trim();
  if (!text || text === '-') return { code: '', kept: '' };
  if (text.includes('@')) return { code: '', kept: '', dropped: true };
  const k = norm(text);
  const code = ALIASES[k] || COUNTRY_NAMES[k] || '';
  return code ? { code, kept: '' } : { code: '', kept: text.slice(0, 80) };
}

const clip = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
const isCloudinary = (u) => /^https:\/\/res\.cloudinary\.com\/[^/\s]+\/image\/upload\/\S+$/.test(String(u || ''));

// Old row -> { artist, work } in the new shape, or { skip: reason }.
export function mapOldWork(w) {
  if (!isCloudinary(w.image_url)) return { skip: `รูปไม่ได้อยู่บน Cloudinary: ${clip(w.title_th || w.title, 80)}` };
  const nat = matchCountry(w.nationality);
  const email = clip(w.artist_email, 254).toLowerCase();
  const artist = {
    name_th: clip(w.artist_name_th || w.artist_name, 200) || '-',
    name_en: clip(w.artist_name_en, 200),
    academic_title_th: clip(w.academic_title_th || w.academic_title, 200),
    academic_title_en: clip(w.academic_title_en, 200),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
    nationality: nat.code || nat.kept,
    bio_th: clip(w.artist_bio_th || w.artist_bio, 12000),
    bio_en: clip(w.artist_bio_en, 12000),
    avatar_url: isCloudinary(w.artist_avatar_url) ? w.artist_avatar_url : ''
  };
  const work = {
    title_th: clip(w.title_th || w.title, 300) || '-',
    title_en: clip(w.title_en, 300),
    technique_th: clip(w.technique_th || w.technique, 300),
    technique_en: clip(w.technique_en, 300),
    dimensions: clip(w.dimensions, 120),
    year_created: clip(w.year_created, 20),
    price: clip(w.price, 120),
    concept_th: clip(w.description_th || w.description, 12000),
    concept_en: clip(w.description_en, 12000),
    zone: clip(w.zone && w.zone !== 'Main Gallery' ? w.zone : '', 120),
    image_url: w.image_url,
    created_at: /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(String(w.created_at || '')) ? String(w.created_at).slice(0, 19).replace('T', ' ') : null
  };
  return { artist, work, nationality: { raw: clip(w.nationality, 80), ...nat } };
}

// Same artist = same email, or same name when there is no email.
export const artistKey = (a) => (a.email ? `e:${a.email}` : `n:${a.name_th.toLowerCase()}`);

export function summarize(list) {
  const mapped = list.map(mapOldWork);
  const ok = mapped.filter((m) => !m.skip);
  const unknown = {}, dropped = new Set();
  for (const m of ok) {
    if (m.nationality.kept) unknown[m.nationality.kept] = (unknown[m.nationality.kept] || 0) + 1;
    if (m.nationality.dropped) dropped.add(m.artist.name_th);
  }
  const clouds = {};
  for (const m of ok) {
    const c = m.work.image_url.split('/')[3];
    clouds[c] = (clouds[c] || 0) + 1;
  }
  return {
    works: ok.length,
    artists: new Set(ok.map((m) => artistKey(m.artist))).size,
    skipped: mapped.filter((m) => m.skip).map((m) => m.skip),
    withEmail: new Set(ok.filter((m) => m.artist.email).map((m) => m.artist.email)).size,
    unknownNationalities: unknown,
    nationalityWasEmail: [...dropped],
    clouds,
    sample: ok.slice(0, 6).map((m) => ({ title: m.work.title_th, artist: m.artist.name_th, image: m.work.image_url }))
  };
}
