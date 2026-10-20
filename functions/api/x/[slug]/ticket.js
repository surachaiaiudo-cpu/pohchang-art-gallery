import { handle, json, readJson, clientIp, HttpError } from '../../../_lib/http.js';
import { loadPublicExhibition, submissionWindow } from '../../../_lib/exhibitions.js';
import { issueTicket, verifyTurnstile } from '../../../_lib/ticket.js';
import { enforce } from '../../../_lib/ratelimit.js';

// POST /api/x/:slug/ticket { turnstile } - start a submission session.
export const onRequestPost = handle(async ({ request, env, params }) => {
  const ex = await loadPublicExhibition(env.DB, params.slug);
  const win = submissionWindow(ex);
  if (!win.open) throw new HttpError(409, win.reason);
  await enforce(env.DB, `ticket:${clientIp(request)}`, { limit: 20, windowSec: 3600 });
  const body = await readJson(request);
  if (!(await verifyTurnstile(env, request, body.turnstile))) throw new HttpError(403, 'ยืนยันว่าไม่ใช่โปรแกรมอัตโนมัติไม่สำเร็จ');
  return json({ ok: true, ticket: await issueTicket(env, request, ex.slug) });
});
