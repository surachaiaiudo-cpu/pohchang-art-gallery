import * as v from './validate.js';
import { bad } from './http.js';
import { ROSTER_KEYS } from '../../public/js/roster-logic.js';

// Artist fields an admin / exhibition manager may type for an artist added by hand (channels 1 and 3).
export const ROSTER_ARTIST_TEXT = {
  name_th: { field: 'ชื่อศิลปิน', max: 200, required: true },
  name_en: { field: 'ชื่อศิลปินภาษาอังกฤษ', max: 200 },
  name_zh: { field: 'ชื่อศิลปินภาษาจีน', max: 200 },
  academic_title_th: { field: 'ตำแหน่งทางวิชาการ', max: 200 },
  phone: { field: 'โทรศัพท์', max: 40 },
  affiliation: { field: 'สังกัด', max: 300 }
};

export const channelOf = (x) => v.int(x, { field: 'ช่องทาง', min: 0, max: 4 });
export const rosterOf = (x) => v.oneOf(x, ROSTER_KEYS, { field: 'สถานะการคัดเลือก' });

// Who can be an artist's coordinator: the exhibition's coordinators (ผู้ประสานงาน, set by the admin; owner 2026-11-19)
// and its managers (ผู้ดูแลนิทรรศการ can coordinate artists too, owner 2026-11-20). Back office only (has email).
export async function coordinatorsOf(db, exhibitionId) {
  const { results } = await db.prepare(
    `SELECT u.id, u.name, u.email, m.member_role FROM exhibition_members m JOIN users u ON u.id = m.user_id
      WHERE m.exhibition_id = ? AND m.member_role IN ('coordinator', 'manager') AND u.active = 1
      ORDER BY m.member_role = 'manager', u.name`
  ).bind(exhibitionId).all();
  return (results || []).map((r) => ({ id: r.id, name: r.name, email: r.email, manager: r.member_role === 'manager' }));
}

// null / '' = no coordinator; otherwise a coordinator or manager of this exhibition. One per artist.
export async function coordinatorOf(db, exhibitionId, value) {
  if (value === null || value === '' || value === 0) return null;
  const id = v.int(value, { field: 'ผู้ประสานงาน', min: 1 });
  const ok = await db.prepare("SELECT 1 FROM exhibition_members WHERE exhibition_id = ? AND user_id = ? AND member_role IN ('coordinator', 'manager')")
    .bind(exhibitionId, id).first();
  if (!ok) throw bad('ผู้ใช้นี้ไม่ได้เป็นผู้ประสานงานหรือผู้ดูแลของนิทรรศการนี้');
  return id;
}

// ---------------------------------------------------------------- import from Excel (owner, 2026-11-17)
// The browser reads the first sheet (public/js/xlsx-read.js) and sends its rows as strings; the server
// finds the header row, maps the columns, checks every row and reports, before anything is saved.
export const IMPORT_MAX_ROWS = 1000;

// Column -> header spellings (normalised: lower case, no spaces/punctuation/brackets/asterisk).
// A header "ประเทศ / Country" is tried part by part.
const HEADERS = {
  name_th: ['ชื่อนามสกุล', 'ชื่อนามสกุลภาษาหลัก', 'ชื่อ', 'ชื่อศิลปิน', 'name', 'fullname', 'artistname', 'nameth'],
  name_en: ['ชื่อภาษาอังกฤษ', 'ชื่ออังกฤษ', 'englishname', 'nameenglish', 'nameen'],
  academic_title_th: ['ตำแหน่งทางวิชาการ', 'ตำแหน่ง', 'คำนำหน้า', 'academictitle', 'title'],
  nationality: ['ประเทศ', 'สัญชาติ', 'country', 'nationality'],
  email: ['อีเมล', 'อีเมล์', 'email', 'emailaddress'],
  phone: ['โทรศัพท์', 'เบอร์โทร', 'เบอร์โทรศัพท์', 'มือถือ', 'phone', 'tel', 'telephone', 'mobile'],
  affiliation: ['สังกัด', 'หน่วยงาน', 'สถาบัน', 'affiliation', 'institution', 'organization', 'organisation'],
  channel: ['ช่องทาง', 'channel'],
  roster: ['สถานะ', 'สถานะการคัดเลือก', 'status'],
  roster_note: ['หมายเหตุ', 'note', 'notes', 'remark', 'remarks'],
  coordinator: ['ผู้ประสานงาน', 'coordinator', 'contactperson']
};
export const normHeader = (s) => String(s || '').toLowerCase().normalize('NFKC')
  .replace(/\(.*?\)/g, '').replace(/[\s.,:;'’"*_\-–—()[\]]/g, '');

// NFKC splits Thai sara am (ำ), so the spellings go through the same normalisation as the cells.
const HEADER_KEYS = Object.fromEntries(Object.entries(HEADERS).map(([k, list]) => [k, list.map((x) => normHeader(x))]));

function headerKey(cell) {
  for (const part of String(cell || '').split('/')) {
    const n = normHeader(part);
    if (!n) continue;
    for (const [key, list] of Object.entries(HEADER_KEYS)) if (list.includes(n)) return key;
  }
  return null;
}

// First row (of the first 10) that has a name column -> { index, map: { key: column } }
export function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i += 1) {
    const map = {};
    (rows[i] || []).forEach((cell, c) => { const k = headerKey(cell); if (k && map[k] === undefined) map[k] = c; });
    if (map.name_th !== undefined) return { index: i, map };
  }
  return null;
}

export function parseChannel(text) {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return 0;
  const d = t.match(/^[^0-9]*([1-4])\b/);
  if (d) return Number(d[1]);
  if (/mou/.test(t)) return 3;
  if (/สมัคร|apply|applied|open call/.test(t)) return 4;
  if (/กรรมการ|committee/.test(t)) return 2;
  if (/เชิญ|invit/.test(t)) return 1;
  return null;
}

export function parseRoster(text) {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return '';
  if (/ไม่ผ่าน|ไม่ได้รับ|not|fail/.test(t)) return 'not_selected';
  if (/รอ|ยังไม่|pending|wait/.test(t)) return ''; // not decided yet
  if (/ผ่าน|ได้รับ|คัดเลือก|selected|accept|pass/.test(t)) return 'selected';
  return null;
}

// rows: string[][] from the sheet; existing: artists already in the exhibition ({ id, name_th, name_en }).
// -> { header: [...keys], rows: [{ line, artist, channel, roster, roster_note, errors: [], duplicate: null | {...} }] }
export function parseImport(rows, existing, { matchCountry, normName, coordinators = [] }) {
  const head = findHeader(rows);
  if (!head) throw new Error('ไม่พบหัวตาราง: ต้องมีคอลัมน์ "ชื่อ-นามสกุล" (หรือ Name) ใน 10 แถวแรก');
  const get = (r, k) => (head.map[k] === undefined ? '' : String(r[head.map[k]] ?? '').trim());
  const known = new Map();
  for (const a of existing) for (const n of [a.name_th, a.name_en].map(normName)) if (n && !known.has(n)) known.set(n, a);
  const inFile = new Map();
  const out = [];
  for (let i = head.index + 1; i < rows.length; i += 1) {
    const r = rows[i] || [];
    if (r.every((c) => !String(c || '').trim())) continue;
    const errors = [];
    const fit = (k, max, label) => {
      const v = get(r, k).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
      if (v.length > max) errors.push(`${label} ยาวเกิน ${max} ตัวอักษร`);
      return v.slice(0, max);
    };
    const artist = {
      name_th: fit('name_th', 200, 'ชื่อ'),
      name_en: fit('name_en', 200, 'ชื่อภาษาอังกฤษ'),
      academic_title_th: fit('academic_title_th', 200, 'ตำแหน่งทางวิชาการ'),
      email: fit('email', 254, 'อีเมล').toLowerCase(),
      phone: fit('phone', 40, 'โทรศัพท์'),
      affiliation: fit('affiliation', 300, 'สังกัด'),
      nationality: ''
    };
    if (!artist.name_th) errors.push('ไม่มีชื่อ');
    if (artist.email && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(artist.email)) errors.push(`อีเมลไม่ถูกต้อง (${artist.email})`);
    const country = get(r, 'nationality');
    if (country) {
      const m = matchCountry(country);
      if (m.code) artist.nationality = m.code; else errors.push(`อ่านชื่อประเทศไม่ออก (${country})`);
    }
    const channel = parseChannel(get(r, 'channel'));
    if (channel === null) errors.push(`ช่องทางไม่ถูกต้อง (${get(r, 'channel')}) ใช้ 1–4`);
    const roster = parseRoster(get(r, 'roster'));
    if (roster === null) errors.push(`สถานะไม่ถูกต้อง (${get(r, 'roster')})`);
    const roster_note = fit('roster_note', 500, 'หมายเหตุ');
    // Coordinator column: a coordinator's name or email (must be set up by the admin first).
    const coordText = get(r, 'coordinator');
    let coordinator_id = null;
    if (coordText) {
      const t = coordText.toLowerCase().replace(/\s+/g, ' ');
      const c = coordinators.find((x) => x.email.toLowerCase() === t || String(x.name || '').toLowerCase().replace(/\s+/g, ' ') === t);
      if (c) coordinator_id = c.id; else errors.push(`ไม่พบผู้ประสานงานชื่อ “${coordText}” (ต้องเป็นผู้ประสานงานของนิทรรศการนี้)`);
    }
    const names = [artist.name_th, artist.name_en].map(normName).filter(Boolean);
    let duplicate = null;
    for (const n of names) {
      const a = known.get(n);
      if (a) { duplicate = { where: 'list', id: a.id, name_th: a.name_th, name_en: a.name_en || '' }; break; }
      const f = inFile.get(n);
      if (f) { duplicate = { where: 'file', line: f }; break; }
    }
    for (const n of names) if (!inFile.has(n)) inFile.set(n, i + 1);
    out.push({ line: i + 1, artist, channel: channel ?? 0, roster: roster ?? '', roster_note, coordinator_id, errors, duplicate });
  }
  if (out.length > IMPORT_MAX_ROWS) throw new Error(`นำเข้าได้ครั้งละไม่เกิน ${IMPORT_MAX_ROWS} คน (ไฟล์นี้มี ${out.length})`);
  return { header: Object.keys(head.map), headerLine: head.index + 1, rows: out };
}
