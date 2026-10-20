import { handle, json, readJson, bad } from '../../../_lib/http.js';
import { requireAdmin, actorOf } from '../../../_lib/auth.js';
import { hashPassword, randomToken } from '../../../_lib/crypto.js';
import { audit } from '../../../_lib/exhibitions.js';
import * as v from '../../../_lib/validate.js';

// A readable temporary password, e.g. "Gk7p-Qx2m-Rt9w".
export function tempPassword() {
  const t = randomToken(12).replace(/[-_]/g, 'x');
  return `${t.slice(0, 4)}-${t.slice(4, 8)}-${t.slice(8, 12)}`;
}

// GET /api/admin/users
export const onRequestGet = handle(async (context) => {
  await requireAdmin(context);
  const db = context.env.DB;
  const [users, members] = await db.batch([
    db.prepare('SELECT id, email, name, role, active, must_change_password, created_at, last_login_at FROM users ORDER BY role, name'),
    db.prepare('SELECT m.user_id, e.slug, e.title_th FROM exhibition_members m JOIN exhibitions e ON e.id = m.exhibition_id')
  ]);
  const byUser = new Map();
  for (const m of members.results || []) {
    if (!byUser.has(m.user_id)) byUser.set(m.user_id, []);
    byUser.get(m.user_id).push({ slug: m.slug, title_th: m.title_th });
  }
  return json({ ok: true, users: (users.results || []).map((u) => ({ ...u, exhibitions: byUser.get(u.id) || [] })) });
});

// POST /api/admin/users { email, name, role, exhibition_slugs? } -> returns a one-time temporary password
export const onRequestPost = handle(async (context) => {
  const admin = await requireAdmin(context);
  const db = context.env.DB;
  const body = await readJson(context.request);
  const email = v.email(body.email, { required: true });
  const name = v.text(body.name, { field: 'ชื่อ', max: 120, required: true });
  const role = v.oneOf(body.role, ['admin', 'staff'], { field: 'บทบาท', fallback: 'staff' });
  const exists = await db.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first();
  if (exists) throw bad('มีผู้ใช้อีเมลนี้แล้ว');

  const temp = tempPassword();
  const h = await hashPassword(temp);
  const res = await db.prepare(
    `INSERT INTO users (email, name, role, password_hash, password_salt, password_iters, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, 1)`
  ).bind(email, name, role, h.hash, h.salt, h.iters).run();
  const userId = res.meta.last_row_id;

  const slugs = Array.isArray(body.exhibition_slugs) ? body.exhibition_slugs.slice(0, 50) : [];
  if (slugs.length) {
    const stmts = slugs.map((s) => db.prepare(
      'INSERT OR IGNORE INTO exhibition_members (exhibition_id, user_id) SELECT id, ? FROM exhibitions WHERE slug = ?'
    ).bind(userId, String(s)));
    await db.batch(stmts);
  }
  await audit(db, null, actorOf(admin), 'user.create', { email, role });
  return json({ ok: true, user: { id: userId, email, name, role }, temporaryPassword: temp }, { status: 201 });
});
