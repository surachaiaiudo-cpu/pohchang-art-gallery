import { handle, json, readJson } from '../../../_lib/http.js';
import { actorOf } from '../../../_lib/auth.js';
import { requireManager, audit } from '../../../_lib/exhibitions.js';
import { verifyUploadedFile, deleteFile } from '../../../_lib/imagekit.js';

// PUT /api/manage/:slug/hero { file_id } - the exhibition's cover image (empty file_id removes it).
export const onRequestPut = handle(async (context) => {
  const { user, ex } = await requireManager(context);
  const { env } = context;
  const b = await readJson(context.request);
  let url = '', fileId = '', size = 0;
  if (b.file_id) {
    const f = await verifyUploadedFile(ex, env, b.file_id, 'hero');
    url = f.url; fileId = f.fileId; size = f.size;
  }
  if (ex.hero_file_id && ex.hero_file_id !== fileId) await deleteFile(ex, env, ex.hero_file_id);
  await env.DB.prepare(
    "UPDATE exhibitions SET hero_url = ?, hero_file_id = ?, storage_bytes = MAX(0, storage_bytes + ?), updated_at = datetime('now') WHERE id = ?"
  ).bind(url, fileId, size, ex.id).run();
  await audit(env.DB, ex.id, actorOf(user), 'hero.set', fileId);
  return json({ ok: true, hero_url: url });
});
