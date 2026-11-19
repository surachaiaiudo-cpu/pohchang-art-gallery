import { handle, json, readJson, bad, notFound } from '../../../_lib/http.js';
import { requireAdmin, actorOf } from '../../../_lib/auth.js';
import { hashPassword, sealPassword, decryptSecret } from '../../../_lib/crypto.js';
import { audit } from '../../../_lib/exhibitions.js';
import { tempPassword } from './index.js';
import * as v from '../../../_lib/validate.js';

// PUT /api/admin/users/:id { name?, role?, active?, reset_password?, set_password?, must_change?, exhibition_slugs? }
// set_password: the admin sets the password (owner 2026-11-19); must_change (default true) = replace at next sign-in.
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
    stmts.push(db.prepare('UPDATE users SET password_hash = ?, password_salt = ?, password_iters = ?, must_change_password = 1, password_enc = ? WHERE id = ?')
      .bind(h.hash, h.salt, h.iters, await sealPassword(temporaryPassword, context.env.APP_ENCRYPTION_KEY), id));
  }
  const setOwn = typeof body.set_password === 'string' && body.set_password !== '';
  if (setOwn && !body.reset_password) {
    const pw = v.password(body.set_password);
    const h = await hashPassword(pw);
    stmts.push(db.prepare('UPDATE users SET password_hash = ?, password_salt = ?, password_iters = ?, must_change_password = ?, password_enc = ? WHERE id = ?')
      .bind(h.hash, h.salt, h.iters, body.must_change === false ? 0 : 1, await sealPassword(pw, context.env.APP_ENCRYPTION_KEY), id));
  }
  if (body.reset_password || setOwn || !active) stmts.push(db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id));
  if (Array.isArray(body.exhibition_slugs)) {
    // Manager memberships only; coordinator memberships are set in the exhibition editor.
    stmts.push(db.prepare("DELETE FROM exhibition_members WHERE user_id = ? AND member_role = 'manager'").bind(id));
    for (const s of body.exhibition_slugs.slice(0, 50)) {
      stmts.push(db.prepare(`INSERT INTO exhibition_members (exhibition_id, user_id, member_role) SELECT id, ?, 'manager' FROM exhibitions WHERE slug = ?
                             ON CONFLICT (exhibition_id, user_id) DO UPDATE SET member_role = 'manager'`)
        .bind(id, String(s)));
    }
  }
  await db.batch(stmts);
  await audit(db, null, actorOf(admin), 'user.update', { id, role, active, reset: !!body.reset_password, setPassword: setOwn && !body.reset_password });
  return json({ ok: true, ...(temporaryPassword ? { temporaryPassword } : {}) });
});

// DELETE /api/admin/users/:id - delete an account (owner, 2026-11-19: e.g. a coordinator who leaves). Not yourself,
// not the last admin. Their sessions and memberships go; artists they coordinated are left without a coordinator
// (the "แจ้งแล้ว" date stays). The audit log keeps "user:<id>" as text.
export const onRequestDelete = handle(async (context) => {
  const admin = await requireAdmin(context);
  const db = context.env.DB;
  const id = v.int(context.params.id, { field: 'id', min: 1 });
  if (id === admin.id) throw bad('ลบบัญชีของตัวเองไม่ได้');
  const user = await db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').bind(id).first();
  if (!user) throw notFound('ไม่พบผู้ใช้');
  if (user.role === 'admin') {
    const n = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id != ?").bind(id).first();
    if (!n.n) throw bad('ต้องมีผู้ดูแลหอศิลป์อย่างน้อย 1 บัญชี');
  }
  const res = await db.batch([
    db.prepare('UPDATE artists SET coordinator_id = NULL WHERE coordinator_id = ?').bind(id),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    db.prepare('DELETE FROM exhibition_members WHERE user_id = ?').bind(id),
    db.prepare('DELETE FROM users WHERE id = ?').bind(id)
  ]);
  await audit(db, null, actorOf(admin), 'user.delete', { id, email: user.email, name: user.name, artistsUnassigned: res[0].meta.changes || 0 });
  return json({ ok: true, artistsUnassigned: res[0].meta.changes || 0 });
});

// GET /api/admin/users/:id?password=1 - show the user's current password to an admin (owner's choice 2026-11-19,
// option 3, after the risks were explained). Every view is written to the audit log.
export const onRequestGet = handle(async (context) => {
  const admin = await requireAdmin(context);
  const db = context.env.DB;
  const id = v.int(context.params.id, { field: 'id', min: 1 });
  const user = await db.prepare('SELECT id, email, password_enc FROM users WHERE id = ?').bind(id).first();
  if (!user) throw notFound('ไม่พบผู้ใช้');
  let password = null;
  if (user.password_enc) {
    try { password = await decryptSecret(user.password_enc, context.env.APP_ENCRYPTION_KEY); } catch { password = null; }
  }
  await audit(db, null, actorOf(admin), 'user.view_password', { id, email: user.email, shown: password !== null });
  return json({ ok: true, password, stored: password !== null });
});
