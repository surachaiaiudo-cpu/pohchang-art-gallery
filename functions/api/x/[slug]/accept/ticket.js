import { handle, json, readJson, clientIp, HttpError } from '../../../../_lib/http.js';
import { issueTicket, verifyTurnstile } from '../../../../_lib/ticket.js';
import { enforce } from '../../../../_lib/ratelimit.js';
import { loadAcceptExhibition, acceptWindow } from '../../../../_lib/acceptance.js';

// POST /api/x/:slug/accept/ticket { turnstile } - anti-spam check once, then upload + sign for 2 hours.
// Scoped to "<slug>#accept" so it cannot be used on the submission form (and the other way round).
export const onRequestPost = handle(async ({ request, env, params }) => {
  const ex = await loadAcceptExhibition(env.DB, params.slug);
  const win = acceptWindow(ex);
  if (!win.open) throw new HttpError(409, win.reason);
  await enforce(env.DB, `ticket:${clientIp(request)}`, { limit: 150, windowSec: 3600 });
  const body = await readJson(request);
  if (!(await verifyTurnstile(env, request, body.turnstile))) throw new HttpError(403, 'ยืนยันว่าไม่ใช่โปรแกรมอัตโนมัติไม่สำเร็จ');
  return json({ ok: true, ticket: await issueTicket(env, request, `${ex.slug}#accept`) });
});
