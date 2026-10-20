import { handle, json, readJson, bad, notFound } from '../../../_lib/http.js';
import { requireAdmin, actorOf } from '../../../_lib/auth.js';
import { audit } from '../../../_lib/exhibitions.js';
import * as v from '../../../_lib/validate.js';

// PUT /api/admin/exhibitions/:id { slug?, status?, staff_user_ids? }
// Admin-only changes: renaming the slug (old one keeps redirecting), archiving, assigning staff.
export const onRequestPut = handle(async (context) => {
  const admin = await requireAdmin(context);
  const db = context.env.DB;
  const id = v.int(context.params.id, { field: 'id', min: 1 });
  const ex = await db.prepare('SELECT * FROM exhibitions WHERE id = ?').bind(id).first();
  if (!ex) throw notFound('ไม่พบนิทรรศการ');
  const body = await readJson(context.request);
  const stmts = [];

  if (body.slug !== undefined && body.slug !== ex.slug) {
    const slug = v.slug(body.slug);
    const taken = await db.prepare(
      'SELECT 1 FROM exhibitions WHERE slug = ? UNION SELECT 1 FROM slug_redirects WHERE old_slug = ? AND exhibition_id != ?'
    ).bind(slug, slug, id).first();
    if (taken) throw bad('slug นี้ถูกใช้แล้ว');
    stmts.push(db.prepare('DELETE FROM slug_redirects WHERE old_slug = ?').bind(slug));
    stmts.push(db.prepare('INSERT OR REPLACE INTO slug_redirects (old_slug, exhibition_id) VALUES (?, ?)').bind(ex.slug, id));
    stmts.push(db.prepare("UPDATE exhibitions SET slug = ?, updated_at = datetime('now') WHERE id = ?").bind(slug, id));
  }
  if (body.status !== undefined) {
    const status = v.oneOf(body.status, ['draft', 'open', 'closed', 'archived'], { field: 'สถานะ' });
    stmts.push(db.prepare("UPDATE exhibitions SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(status, id));
  }
  if (Array.isArray(body.staff_user_ids)) {
    stmts.push(db.prepare('DELETE FROM exhibition_members WHERE exhibition_id = ?').bind(id));
    for (const uid of body.staff_user_ids.slice(0, 50)) {
      stmts.push(db.prepare('INSERT OR IGNORE INTO exhibition_members (exhibition_id, user_id) SELECT ?, id FROM users WHERE id = ?')
        .bind(id, v.int(uid, { field: 'ผู้ใช้', min: 1 })));
    }
  }
  if (stmts.length) await db.batch(stmts);
  await audit(db, id, actorOf(admin), 'exhibition.admin_update', body);
  return json({ ok: true });
});
