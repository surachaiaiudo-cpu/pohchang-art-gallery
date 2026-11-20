import { handle, json, readJson, clientIp, HttpError } from '../../../../_lib/http.js';
import { uploadAuth } from '../../../../_lib/storage.js';
import { checkTicket } from '../../../../_lib/ticket.js';
import { enforce } from '../../../../_lib/ratelimit.js';
import { loadAcceptExhibition, acceptWindow } from '../../../../_lib/acceptance.js';

// POST /api/x/:slug/accept/upload-auth { ticket } - signs one upload of the artist's photo.
export const onRequestPost = handle(async ({ request, env, params }) => {
  const ex = await loadAcceptExhibition(env.DB, params.slug);
  const win = acceptWindow(ex);
  if (!win.open) throw new HttpError(409, win.reason);
  const body = await readJson(request);
  await checkTicket(env, request, `${ex.slug}#accept`, body.ticket);
  if (ex.storage_bytes >= ex.storage_quota_bytes) throw new HttpError(507, 'พื้นที่เก็บรูปของนิทรรศการนี้เต็มแล้ว กรุณาติดต่อผู้จัด');
  await enforce(env.DB, `upload:${clientIp(request)}`, { limit: 240, windowSec: 3600 }, 'อัปโหลดถี่เกินไป กรุณารอสักครู่');
  return json({ ok: true, upload: await uploadAuth(ex, env, 'artist') });
});
