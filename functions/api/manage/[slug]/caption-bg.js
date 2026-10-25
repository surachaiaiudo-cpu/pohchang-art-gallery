import { handle, json, readJson } from '../../../_lib/http.js';
import { actorOf } from '../../../_lib/auth.js';
import { requireManager, audit } from '../../../_lib/exhibitions.js';
import { verifyUploadedFile, deleteFile } from '../../../_lib/storage.js';
import * as v from '../../../_lib/validate.js';

// Column pairs per part; fixed names only (never built from input).
const PARTS = {
  logo: { url: 'caption_bg_logo_url', id: 'caption_bg_logo_file_id' },
  body: { url: 'caption_bg_body_url', id: 'caption_bg_body_file_id' }
};

// PUT /api/manage/:slug/caption-bg { part: 'logo' | 'body', file } - caption background picture (file: null removes it).
export const onRequestPut = handle(async (context) => {
  const { user, ex } = await requireManager(context);
  const { env } = context;
  const b = await readJson(context.request);
  const part = PARTS[v.oneOf(b.part, Object.keys(PARTS), { field: 'ส่วนของป้าย' })];
  let url = '', fileId = '', size = 0;
  if (b.file) {
    const f = await verifyUploadedFile(ex, env, b.file, 'logo');
    url = f.url; fileId = f.fileId; size = f.size;
  }
  if (ex[part.id] && ex[part.id] !== fileId) await deleteFile(ex, env, ex[part.id]);
  await env.DB.prepare(
    `UPDATE exhibitions SET ${part.url} = ?, ${part.id} = ?, storage_bytes = MAX(0, storage_bytes + ?), updated_at = datetime('now') WHERE id = ?`
  ).bind(url, fileId, size, ex.id).run();
  await audit(env.DB, ex.id, actorOf(user), 'caption_bg.set', `${b.part}:${fileId}`);
  return json({ ok: true, url });
});
