import { handle, json } from '../../_lib/http.js';
import { currentUser } from '../../_lib/auth.js';

// GET /api/auth/me -> the signed-in user and the exhibitions they look after.
export const onRequestGet = handle(async ({ request, env }) => {
  const user = await currentUser(env.DB, request);
  if (!user) return json({ ok: true, user: null });
  const sql = user.role === 'admin'
    ? 'SELECT slug, title_th, status FROM exhibitions ORDER BY created_at DESC'
    : `SELECT e.slug, e.title_th, e.status FROM exhibitions e
         JOIN exhibition_members m ON m.exhibition_id = e.id
        WHERE m.user_id = ? ORDER BY e.created_at DESC`;
  const stmt = user.role === 'admin' ? env.DB.prepare(sql) : env.DB.prepare(sql).bind(user.id);
  const { results } = await stmt.all();
  return json({ ok: true, user, exhibitions: results || [] });
});
