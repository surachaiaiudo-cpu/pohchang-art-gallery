import { handle, json, readJson, clientIp, HttpError } from '../../../_lib/http.js';
import { loadPublicExhibition, submissionWindow } from '../../../_lib/exhibitions.js';
import { uploadAuth } from '../../../_lib/imagekit.js';
import { checkTicket } from '../../../_lib/ticket.js';
import { enforce } from '../../../_lib/ratelimit.js';
import * as v from '../../../_lib/validate.js';

// POST /api/x/:slug/upload-auth { ticket, kind: 'work' | 'artist' }
// Signs one direct browser upload to this exhibition's ImageKit account.
export const onRequestPost = handle(async ({ request, env, params }) => {
  const ex = await loadPublicExhibition(env.DB, params.slug);
  const win = submissionWindow(ex);
  if (!win.open) throw new HttpError(409, win.reason);
  const body = await readJson(request);
  await checkTicket(env, request, ex.slug, body.ticket);
  const kind = v.oneOf(body.kind, ['work', 'artist'], { field: 'ประเภทไฟล์' });
  if (ex.storage_bytes >= ex.storage_quota_bytes) throw new HttpError(507, 'พื้นที่เก็บรูปของนิทรรศการนี้เต็มแล้ว กรุณาติดต่อผู้จัด');
  await enforce(env.DB, `upload:${clientIp(request)}`, { limit: 15, windowSec: 3600 }, 'อัปโหลดถี่เกินไป กรุณารอสักครู่');
  await enforce(env.DB, `upload-ex:${ex.id}`, { limit: 400, windowSec: 3600 }, 'ระบบรับไฟล์ของนิทรรศการนี้หนาแน่น กรุณาลองใหม่ภายหลัง');
  return json({ ok: true, upload: await uploadAuth(ex, env, kind) });
});
