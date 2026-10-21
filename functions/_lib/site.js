// Gallery-wide settings: the home page hero text and the footer (organiser, address, contact,
// social links). Stored as one JSON row in site_settings; empty fields are simply not shown.
import * as v from './validate.js';

const LANGS = ['th', 'en', 'zh'];
const TEXT = { hero_title: 120, org_name: 200 };
const LONG = { hero_lead: 500, address: 600 };
export const LINKS = ['website', 'facebook', 'instagram', 'youtube', 'tiktok', 'line'];

export function emptySite() {
  const s = { email: '', phone: '' };
  for (const k of [...Object.keys(TEXT), ...Object.keys(LONG)]) for (const l of LANGS) s[`${k}_${l}`] = '';
  for (const k of LINKS) s[k] = '';
  return s;
}

export async function loadSite(db) {
  const row = await db.prepare("SELECT value FROM site_settings WHERE key = 'site'").first();
  let saved = {};
  try { saved = row ? JSON.parse(row.value) : {}; } catch { saved = {}; }
  const s = emptySite();
  for (const k of Object.keys(s)) if (typeof saved[k] === 'string') s[k] = saved[k];
  return s;
}

// Validates a full settings object from the admin form.
export function normalizeSite(b) {
  const s = emptySite();
  for (const [k, max] of Object.entries(TEXT)) for (const l of LANGS) s[`${k}_${l}`] = v.text(b[`${k}_${l}`], { field: k, max });
  for (const [k, max] of Object.entries(LONG)) for (const l of LANGS) s[`${k}_${l}`] = v.longText(b[`${k}_${l}`], { field: k, max });
  s.email = v.email(b.email);
  s.phone = v.text(b.phone, { field: 'เบอร์โทร', max: 60 });
  for (const k of LINKS) s[k] = v.httpsUrl(b[k], { field: `ลิงก์ ${k}` });
  return s;
}

export async function saveSite(db, s) {
  await db.prepare(
    `INSERT INTO site_settings (key, value, updated_at) VALUES ('site', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(JSON.stringify(s)).run();
}
