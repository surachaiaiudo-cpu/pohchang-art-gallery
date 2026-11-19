// Artist roster (owner's workshop process, 2026-11-14): how an artist came in (channel), where they are
// in the selection, and the artist number (เลขที่ศิลปิน). Shared by the roster page and the Functions.
import { isCountryCode, countryName } from './countries.js';

// How the artist came in. 0 = not set (artists from before the roster existed).
export const CHANNELS = [
  { key: 0, label: 'ยังไม่ระบุช่องทาง' },
  { key: 1, label: '1 · เชิญโดยตรง' },
  { key: 2, label: '2 · กรรมการเสนอ (ผู้ทรงฯ เลือก)' },
  { key: 3, label: '3 · MOU' },
  { key: 4, label: '4 · สมัครเอง (ผู้ทรงฯ เลือก)' }
];
export const CHANNEL_KEYS = CHANNELS.map((c) => c.key);

// Selection status: pass / not pass (owner, 2026-11-19); '' = not decided yet. Keys kept from part A so the
// statuses already set stay. Later steps (acceptance, attendance) keep their own columns.
export const ROSTER = [
  { key: '', label: 'ยังไม่ระบุ' },
  { key: 'selected', label: 'ผ่าน' },
  { key: 'not_selected', label: 'ไม่ผ่าน' }
];
export const ROSTER_KEYS = ROSTER.map((r) => r.key);

// Works sent for the selection round are never public (owner, 2026-11-14): the committee picked them
// for the experts; they may not be the artist's new work. 'exhibit' = works for the exhibition.
export const STAGES = [
  { key: 'exhibit', label: 'ผลงานจัดแสดง' },
  { key: 'selection', label: 'ผลงานรอบคัดเลือก (ไม่เผยแพร่)' }
];
export const STAGE_KEYS = STAGES.map((s) => s.key);

export const MAX_ARTIST_NO = 999;
export const formatNo = (n) => (Number.isInteger(n) && n > 0 ? String(n).padStart(3, '0') : '');

const nameKey = (a) => String(a.name_en || a.name_th || '').normalize('NFC').replace(/\s+/g, ' ').trim();

// Number order (owner, 2026-11-14): foreign artists first, grouped by country (English name A–Z),
// then Thai artists; inside a group by the English name A–Z (Thai name when there is no English one).
// A nationality that is not a known code goes after the foreign countries, before Thai artists.
export function numberGroup(a) {
  if (a.nationality === 'TH') return 2;
  return isCountryCode(a.nationality) ? 0 : 1;
}

export function compareForNumber(a, b) {
  const ga = numberGroup(a);
  const gb = numberGroup(b);
  if (ga !== gb) return ga - gb;
  if (ga === 0) {
    const c = countryName(a.nationality, 'en').localeCompare(countryName(b.nationality, 'en'), 'en', { sensitivity: 'base' });
    if (c) return c;
  }
  const n = nameKey(a).localeCompare(nameKey(b), 'en', { sensitivity: 'base' });
  return n || (a.id - b.id);
}

// Who gets a number now: selected, not withdrawn, no number yet. Numbers already given never change
// (withdrawn artists keep theirs, owner 2026-11-14); new ones continue after the highest number.
export function planNumbers(artists) {
  const used = artists.map((a) => a.artist_no).filter((n) => Number.isInteger(n) && n > 0);
  let next = used.length ? Math.max(...used) + 1 : 1;
  const todo = artists
    .filter((a) => a.roster === 'selected' && !a.withdrawn && !(Number.isInteger(a.artist_no) && a.artist_no > 0))
    .sort(compareForNumber);
  const plan = [];
  for (const a of todo) {
    if (next > MAX_ARTIST_NO) break;
    plan.push({ id: a.id, artist_no: next });
    next += 1;
  }
  return { plan, appended: used.length > 0, skipped: todo.length - plan.length };
}
