import { handle, json, readJson, bad } from '../../../_lib/http.js';
import { requireAdmin, actorOf } from '../../../_lib/auth.js';
import { audit } from '../../../_lib/exhibitions.js';
import { PRESETS } from '../../../_lib/themes.js';
import * as v from '../../../_lib/validate.js';

// GET /api/admin/exhibitions - every exhibition with counts and its staff.
export const onRequestGet = handle(async (context) => {
  await requireAdmin(context);
  const db = context.env.DB;
  const [ex, members] = await db.batch([
    db.prepare(
      `SELECT e.id, e.slug, e.title_th, e.status, e.theme_preset, e.storage_bytes, e.created_at,
              (e.imagekit_private_enc != '') AS has_storage,
              (SELECT COUNT(*) FROM works w WHERE w.exhibition_id = e.id AND w.deleted_at IS NULL) AS works,
              (SELECT COUNT(*) FROM works w WHERE w.exhibition_id = e.id AND w.status = 'shown' AND w.deleted_at IS NULL) AS shown
         FROM exhibitions e ORDER BY e.created_at DESC`
    ),
    db.prepare('SELECT m.exhibition_id, u.id, u.name, u.email FROM exhibition_members m JOIN users u ON u.id = m.user_id')
  ]);
  const staff = new Map();
  for (const m of members.results || []) {
    if (!staff.has(m.exhibition_id)) staff.set(m.exhibition_id, []);
    staff.get(m.exhibition_id).push({ id: m.id, name: m.name, email: m.email });
  }
  return json({ ok: true, exhibitions: (ex.results || []).map((e) => ({ ...e, staff: staff.get(e.id) || [] })) });
});

// POST /api/admin/exhibitions { slug, title_th, title_en?, theme_preset? }
export const onRequestPost = handle(async (context) => {
  const admin = await requireAdmin(context);
  const db = context.env.DB;
  const body = await readJson(context.request);
  const slug = v.slug(body.slug);
  const title_th = v.text(body.title_th, { field: 'ชื่อนิทรรศการ', max: 200, required: true });
  const title_en = v.text(body.title_en, { field: 'ชื่อภาษาอังกฤษ', max: 200 });
  const theme_preset = v.oneOf(body.theme_preset, Object.keys(PRESETS), { field: 'ธีม', fallback: 'white-cube' });
  const taken = await db.prepare(
    'SELECT 1 FROM exhibitions WHERE slug = ? UNION SELECT 1 FROM slug_redirects WHERE old_slug = ?'
  ).bind(slug, slug).first();
  if (taken) throw bad('slug นี้ถูกใช้แล้ว');
  const res = await db.prepare('INSERT INTO exhibitions (slug, title_th, title_en, theme_preset) VALUES (?, ?, ?, ?)')
    .bind(slug, title_th, title_en, theme_preset).run();
  await audit(db, res.meta.last_row_id, actorOf(admin), 'exhibition.create', { slug });
  return json({ ok: true, exhibition: { id: res.meta.last_row_id, slug, title_th } }, { status: 201 });
});
