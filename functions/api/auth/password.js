import { handle, json, readJson, HttpError, bad } from '../../_lib/http.js';
import { requireUser } from '../../_lib/auth.js';
import { hashPassword, verifyPassword, sha256Hex } from '../../_lib/crypto.js';
import { readCookie, SESSION_COOKIE } from '../../_lib/auth.js';
import * as v from '../../_lib/validate.js';

// POST /api/auth/password { current, next } - also used to replace a temporary password.
export const onRequestPost = handle(async (context) => {
  const { request, env } = context;
  const user = await requireUser(context, { allowTempPassword: true });
  const body = await readJson(request);
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  if (!(await verifyPassword(typeof body.current === 'string' ? body.current : '', row))) {
    throw new HttpError(401, 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
  }
  const next = v.password(body.next);
  if (next === body.current) throw bad('รหัสผ่านใหม่ต้องไม่ซ้ำรหัสเดิม');
  const h = await hashPassword(next);
  // Sign out every other session of this user.
  const keep = await sha256Hex(readCookie(request, SESSION_COOKIE) || '');
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ?, password_iters = ?, must_change_password = 0 WHERE id = ?')
      .bind(h.hash, h.salt, h.iters, user.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').bind(user.id, keep)
  ]);
  return json({ ok: true });
});
