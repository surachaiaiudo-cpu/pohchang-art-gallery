import { handle, json, readJson, bad } from '../../../_lib/http.js';
import { actorOf } from '../../../_lib/auth.js';
import { requireManager, audit } from '../../../_lib/exhibitions.js';
import { parseTechniques, checkTechnique } from '../../../_lib/techniques.js';
import * as v from '../../../_lib/validate.js';

// POST /api/manage/:slug/techniques { items: [{ id, technique_group }] }
// Sets the technique group of many works at once (confirming the suggestions for old works).
export const onRequestPost = handle(async (context) => {
  const { user, ex } = await requireManager(context);
  const db = context.env.DB;
  const b = await readJson(context.request);
  const techs = parseTechniques(ex.techniques);
  if (!techs.length) throw bad('นิทรรศการนี้ยังไม่มีรายการเทคนิค');
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 1000).map((it) => ({
    id: v.int(it && it.id, { field: 'id', min: 1 }),
    t: checkTechnique(techs, it && it.technique_group, { required: false })
  }));
  if (!items.length) return json({ ok: true, updated: 0 });
  // One statement for the whole list: the values travel as one JSON parameter (D1 allows 100 per statement).
  const res = await db.prepare(
    `UPDATE works SET technique_group = j.t, updated_at = datetime('now')
       FROM (SELECT json_extract(value, '$.id') AS id, json_extract(value, '$.t') AS t FROM json_each(?)) AS j
      WHERE works.id = j.id AND works.exhibition_id = ? AND works.deleted_at IS NULL`
  ).bind(JSON.stringify(items), ex.id).run();
  const updated = res.meta.changes ?? items.length;
  await audit(db, ex.id, actorOf(user), 'works.technique', { count: updated });
  return json({ ok: true, updated });
});
