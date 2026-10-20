import { handle, json } from '../../_lib/http.js';
import { destroySession } from '../../_lib/auth.js';

// POST /api/auth/logout
export const onRequestPost = handle(async ({ request, env }) => {
  const cookie = await destroySession(env.DB, request);
  return json({ ok: true }, { headers: { 'Set-Cookie': cookie } });
});
