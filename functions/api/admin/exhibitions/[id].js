import { handle, json, readJson, bad, notFound } from '../../../_lib/http.js';
import { requireAdmin, actorOf } from '../../../_lib/auth.js';
import { audit } from '../../../_lib/exhibitions.js';
import * as v from '../../../_lib/validate.js';
import { CARD_STYLES } from '../../../_lib/themes.js';

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
  for (const k of ['on_view', 'accepting']) {
    if (body[k] !== undefined) stmts.push(db.prepare(`UPDATE exhibitions SET ${k} = ?, updated_at = datetime('now') WHERE id = ?`).bind(body[k] ? 1 : 0, id));
  }
  if (body.card_style !== undefined) {
    const card = v.oneOf(body.card_style, CARD_STYLES, { field: 'สไตล์การ์ดหน้าแรก' });
    stmts.push(db.prepare("UPDATE exhibitions SET card_style = ?, updated_at = datetime('now') WHERE id = ?").bind(card, id));
  }
  if (Array.isArray(body.staff_user_ids)) {
    stmts.push(db.prepare("DELETE FROM exhibition_members WHERE exhibition_id = ? AND member_role = 'manager'").bind(id));
    for (const uid of body.staff_user_ids.slice(0, 50)) {
      // A manager wins over a coordinator for the same person.
      stmts.push(db.prepare(`INSERT INTO exhibition_members (exhibition_id, user_id, member_role) SELECT ?, id, 'manager' FROM users WHERE id = ?
                             ON CONFLICT (exhibition_id, user_id) DO UPDATE SET member_role = 'manager'`)
        .bind(id, v.int(uid, { field: 'ผู้ใช้', min: 1 })));
    }
  }
  // Coordinators (ผู้ประสานงาน, owner 2026-11-19): set by the admin. Their artists lose the link when removed.
  if (Array.isArray(body.coordinator_user_ids)) {
    const keep = body.coordinator_user_ids.slice(0, 100).map((uid) => v.int(uid, { field: 'ผู้ใช้', min: 1 }));
    stmts.push(db.prepare("DELETE FROM exhibition_members WHERE exhibition_id = ? AND member_role = 'coordinator'").bind(id));
    for (const uid of keep) {
      stmts.push(db.prepare(`INSERT INTO exhibition_members (exhibition_id, user_id, member_role) SELECT ?, id, 'coordinator' FROM users WHERE id = ?
                             ON CONFLICT (exhibition_id, user_id) DO NOTHING`).bind(id, uid));
    }
  }
  // Artists whose coordinator is no longer a member (coordinator or manager, owner 2026-11-20) lose the link.
  if (Array.isArray(body.coordinator_user_ids) || Array.isArray(body.staff_user_ids)) {
    stmts.push(db.prepare(`UPDATE artists SET coordinator_id = NULL WHERE exhibition_id = ? AND coordinator_id IS NOT NULL
                             AND coordinator_id NOT IN (SELECT user_id FROM exhibition_members WHERE exhibition_id = ?)`)
      .bind(id, id));
  }
  if (stmts.length) await db.batch(stmts);
  await audit(db, id, actorOf(admin), 'exhibition.admin_update', body);
  return json({ ok: true });
});
