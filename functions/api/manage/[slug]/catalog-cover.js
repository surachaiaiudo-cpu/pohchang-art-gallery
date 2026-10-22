import { handle, json, readJson } from '../../../_lib/http.js';
import { actorOf } from '../../../_lib/auth.js';
import { requireManager, audit } from '../../../_lib/exhibitions.js';
import { verifyUploadedFile, deleteFile } from '../../../_lib/storage.js';

// PUT /api/manage/:slug/catalog-cover { file } - the catalogue's cover page image (file: null removes it).
export const onRequestPut = handle(async (context) => {
  const { user, ex } = await requireManager(context);
  const { env } = context;
  const b = await readJson(context.request);
  let url = '', fileId = '', size = 0, width = 0, height = 0;
  if (b.file) {
    const f = await verifyUploadedFile(ex, env, b.file, 'catalog');
    ({ url, fileId, size, width, height } = f);
  }
  if (ex.catalog_cover_file_id && ex.catalog_cover_file_id !== fileId) await deleteFile(ex, env, ex.catalog_cover_file_id);
  await env.DB.prepare(
    `UPDATE exhibitions SET catalog_cover_url = ?, catalog_cover_file_id = ?, catalog_cover_width = ?, catalog_cover_height = ?,
            storage_bytes = MAX(0, storage_bytes + ?), updated_at = datetime('now') WHERE id = ?`
  ).bind(url, fileId, width || 0, height || 0, size, ex.id).run();
  await audit(env.DB, ex.id, actorOf(user), 'catalog.cover', fileId);
  return json({ ok: true, cover: { url, width, height } });
});
