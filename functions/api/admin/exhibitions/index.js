import { handle, json, readJson, bad } from '../../../_lib/http.js';
import { requireAdmin, actorOf } from '../../../_lib/auth.js';
import { audit, submissionWindow } from '../../../_lib/exhibitions.js';
import { DEFAULT_CLOUD_NAME, DEFAULT_UPLOAD_PRESET } from '../../../_lib/storage.js';
import { PRESETS } from '../../../_lib/themes.js';
import { DEFAULT_CATEGORIES } from '../../../_lib/categories.js';
import { DEFAULT_TECHNIQUES } from '../../../_lib/techniques.js';
import * as v from '../../../_lib/validate.js';

// GET /api/admin/exhibitions - every exhibition with counts and its staff.
export const onRequestGet = handle(async (context) => {
  await requireAdmin(context);
  const db = context.env.DB;
  const [ex, members] = await db.batch([
    db.prepare(
      `SELECT e.id, e.slug, e.title_th, e.status, e.on_view, e.accepting, e.theme_preset, e.card_style, e.storage_bytes, e.created_at,
              e.submission_opens_at, e.submission_closes_at, e.cloudinary_cloud_name, e.cloudinary_upload_preset,
              (e.cloudinary_api_secret_enc != '') AS has_secret,
              (e.cloudinary_cloud_name != '' AND (e.cloudinary_upload_preset != '' OR e.cloudinary_api_secret_enc != '')) AS has_storage,
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
  return json({
    ok: true,
    exhibitions: (ex.results || []).map(({ cloudinary_upload_preset, has_secret, ...e }) => ({
      ...e,
      // Whether the submission form is actually accepting work right now (status, dates and storage).
      submission: submissionWindow({ ...e, cloudinary_upload_preset, cloudinary_api_secret_enc: has_secret ? 'x' : '' }),
      staff: staff.get(e.id) || []
    }))
  });
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
  const res = await db.prepare(
    'INSERT INTO exhibitions (slug, title_th, title_en, theme_preset, cloudinary_cloud_name, cloudinary_upload_preset, categories, techniques) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(slug, title_th, title_en, theme_preset, DEFAULT_CLOUD_NAME, DEFAULT_UPLOAD_PRESET, DEFAULT_CATEGORIES, DEFAULT_TECHNIQUES).run();
  await audit(db, res.meta.last_row_id, actorOf(admin), 'exhibition.create', { slug });
  return json({ ok: true, exhibition: { id: res.meta.last_row_id, slug, title_th } }, { status: 201 });
});
