import { handle, json, readJson, notFound } from '../../../../_lib/http.js';
import { actorOf } from '../../../../_lib/auth.js';
import { requireManager, audit } from '../../../../_lib/exhibitions.js';
import { verifyUploadedFile, deleteFile } from '../../../../_lib/imagekit.js';
import { recompute } from '../../../../_lib/review.js';
import * as v from '../../../../_lib/validate.js';

async function loadWork(db, ex, id) {
  const w = await db.prepare('SELECT * FROM works WHERE id = ? AND exhibition_id = ? AND deleted_at IS NULL').bind(id, ex.id).first();
  if (!w) throw notFound('ไม่พบผลงาน');
  return w;
}

const WORK_TEXT = {
  title_th: { field: 'ชื่อผลงาน', max: 300, required: true },
  title_en: { field: 'ชื่อผลงานภาษาอังกฤษ', max: 300 },
  technique_th: { field: 'เทคนิค', max: 300 },
  technique_en: { field: 'เทคนิคภาษาอังกฤษ', max: 300 },
  dimensions: { field: 'ขนาด', max: 120 },
  year_created: { field: 'ปีที่สร้าง', max: 20 },
  price: { field: 'ราคา', max: 120 },
  zone: { field: 'โซน', max: 120 }
};
const WORK_LONG = { concept_th: 'แนวคิด', concept_en: 'แนวคิดภาษาอังกฤษ' };
const ARTIST_TEXT = {
  name_th: { field: 'ชื่อศิลปิน', max: 200, required: true },
  name_en: { field: 'ชื่อศิลปินภาษาอังกฤษ', max: 200 },
  academic_title_th: { field: 'ตำแหน่งทางวิชาการ', max: 200 },
  academic_title_en: { field: 'ตำแหน่งทางวิชาการภาษาอังกฤษ', max: 200 },
  phone: { field: 'โทรศัพท์', max: 40 },
  nationality: { field: 'สัญชาติ', max: 80 },
  affiliation: { field: 'สังกัด', max: 300 }
};

// PUT /api/manage/:slug/works/:id
// { status?, badge_override?: 'endorsed'|'not_endorsed'|null, display_order?, <work fields>, file_id?, artist: {...}? }
export const onRequestPut = handle(async (context) => {
  const { user, ex } = await requireManager(context);
  const { env } = context;
  const db = env.DB;
  const id = v.int(context.params.id, { field: 'id', min: 1 });
  const work = await loadWork(db, ex, id);
  const b = await readJson(context.request);

  const set = {};
  for (const [k, opts] of Object.entries(WORK_TEXT)) if (b[k] !== undefined) set[k] = v.text(b[k], opts);
  for (const [k, field] of Object.entries(WORK_LONG)) if (b[k] !== undefined) set[k] = v.longText(b[k], { field });
  if (b.display_order !== undefined) set.display_order = v.int(b.display_order, { field: 'ลำดับ', min: 0, max: 100000 });
  if (b.status !== undefined) set.status = v.oneOf(b.status, ['submitted', 'shown', 'rejected'], { field: 'สถานะ' });
  if (b.badge_override !== undefined) {
    set.badge_override = b.badge_override === null || b.badge_override === ''
      ? null : v.oneOf(b.badge_override, ['endorsed', 'not_endorsed'], { field: 'การตัดสินของภัณฑารักษ์' });
  }
  let oldFile = null;
  if (b.file_id) {
    const f = await verifyUploadedFile(ex, env, b.file_id, 'work');
    Object.assign(set, { image_url: f.url, image_file_id: f.fileId, image_width: f.width, image_height: f.height, image_bytes: f.size });
    oldFile = work.image_file_id;
  }

  const stmts = [];
  const keys = Object.keys(set);
  if (keys.length) {
    stmts.push(db.prepare(`UPDATE works SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ? AND exhibition_id = ?`)
      .bind(...keys.map((k) => set[k]), id, ex.id));
  }
  if (b.file_id) {
    stmts.push(db.prepare('UPDATE exhibitions SET storage_bytes = MAX(0, storage_bytes + ? - ?) WHERE id = ?')
      .bind(set.image_bytes, work.image_bytes, ex.id));
  }
  if (b.artist && typeof b.artist === 'object') {
    const a = {};
    for (const [k, opts] of Object.entries(ARTIST_TEXT)) if (b.artist[k] !== undefined) a[k] = v.text(b.artist[k], opts);
    if (b.artist.email !== undefined) a.email = v.email(b.artist.email);
    if (b.artist.bio_th !== undefined) a.bio_th = v.longText(b.artist.bio_th, { field: 'ประวัติศิลปิน' });
    if (b.artist.bio_en !== undefined) a.bio_en = v.longText(b.artist.bio_en, { field: 'ประวัติศิลปินภาษาอังกฤษ' });
    const ak = Object.keys(a);
    if (ak.length) {
      stmts.push(db.prepare(`UPDATE artists SET ${ak.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ? AND exhibition_id = ?`)
        .bind(...ak.map((k) => a[k]), work.artist_id, ex.id));
    }
  }
  if (stmts.length) await db.batch(stmts);

  if (set.status !== undefined || set.badge_override !== undefined) {
    if ((set.status ?? work.status) === 'shown') await recompute(db, ex, [id]);
    else await db.prepare("UPDATE works SET endorsed = 0, review_result = 'pending' WHERE id = ? AND exhibition_id = ?").bind(id, ex.id).run();
  }
  if (oldFile && oldFile !== set.image_file_id) await deleteFile(ex, env, oldFile);
  await audit(db, ex.id, actorOf(user), 'work.update', { id, fields: keys });
  const updated = await db.prepare('SELECT * FROM works WHERE id = ?').bind(id).first();
  return json({ ok: true, work: updated });
});

// DELETE /api/manage/:slug/works/:id - removes the work and its image file.
export const onRequestDelete = handle(async (context) => {
  const { user, ex } = await requireManager(context);
  const { env } = context;
  const db = env.DB;
  const id = v.int(context.params.id, { field: 'id', min: 1 });
  const work = await loadWork(db, ex, id);
  await db.batch([
    db.prepare("UPDATE works SET deleted_at = datetime('now'), endorsed = 0 WHERE id = ? AND exhibition_id = ?").bind(id, ex.id),
    db.prepare('UPDATE exhibitions SET storage_bytes = MAX(0, storage_bytes - ?) WHERE id = ?').bind(work.image_bytes, ex.id)
  ]);
  const file = await deleteFile(ex, env, work.image_file_id);
  await audit(db, ex.id, actorOf(user), 'work.delete', { id, title: work.title_th, file });
  return json({ ok: true, file });
});
