import { handle, json, readJson } from '../../../_lib/http.js';
import { requireManager } from '../../../_lib/exhibitions.js';
import { uploadAuth } from '../../../_lib/imagekit.js';
import * as v from '../../../_lib/validate.js';

// POST /api/manage/:slug/upload-auth { kind: 'work' | 'artist' | 'hero' } - for staff edits.
export const onRequestPost = handle(async (context) => {
  const { ex } = await requireManager(context);
  const b = await readJson(context.request);
  const kind = v.oneOf(b.kind, ['work', 'artist', 'hero'], { field: 'ประเภทไฟล์' });
  return json({ ok: true, upload: await uploadAuth(ex, context.env, kind) });
});
