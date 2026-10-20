import { handle, json, readJson, bad, notFound } from '../../../_lib/http.js';
import { requireAdmin, actorOf } from '../../../_lib/auth.js';
import { hashPassword } from '../../../_lib/crypto.js';
import { audit } from '../../../_lib/exhibitions.js';
import { tempPassword } from './index.js';
import * as v from '../../../_lib/validate.js';

// PUT /api/admin/users/:id { name?, role?, active?, reset_password?, exhibition_slugs? }
export const onRequestPut = handle(async (context) => {
  const admin = await requireAdmin(context);
  const db = context.env.DB;
  const id = v.int(context.params.id, { field: 'id', min: 1 });
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!user) throw notFound('ไม่พบผู้ใช้');
  const body = await readJson(context.request);

  const name = body.name !== undefined ? v.text(body.name, { field: 'ชื่อ', max: 120, required: true }) : user.name;
  const role = body.role !== undefined ? v.oneOf(body.role, ['admin', 'staff'], { field: 'บทบาท' }) : user.role;
  const active = body.active !== undefined ? (body.active ? 1 : 0) : user.active;
  if (id === admin.id && (role !== 'admin' || !active)) throw bad('ไม่สามารถลดสิทธิ์หรือปิดบัญชีของตัวเองได้');

  const stmts = [db.prepare('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?').bind(name, role, active, id)];
  let temporaryPassword;
  if (body.reset_password) {
    temporaryPassword = tempPassword();
    const h = await hashPassword(temporaryPassword);
    stmts.push(db.prepare('UPDATE users SET password_hash = ?, password_salt = ?, password_iters = ?, must_change_password = 1 WHERE id = ?')
      .bind(h.hash, h.salt, h.iters, id));
  }
  if (body.reset_password || !active) stmts.push(db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id));
  if (Array.isArray(body.exhibition_slugs)) {
    stmts.push(db.prepare('DELETE FROM exhibition_members WHERE user_id = ?').bind(id));
    for (const s of body.exhibition_slugs.slice(0, 50)) {
      stmts.push(db.prepare('INSERT OR IGNORE INTO exhibition_members (exhibition_id, user_id) SELECT id, ? FROM exhibitions WHERE slug = ?')
        .bind(id, String(s)));
    }
  }
  await db.batch(stmts);
  await audit(db, null, actorOf(admin), 'user.update', { id, role, active, reset: !!body.reset_password });
  return json({ ok: true, ...(temporaryPassword ? { temporaryPassword } : {}) });
});
