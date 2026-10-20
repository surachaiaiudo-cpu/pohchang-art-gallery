import { handle, publicJson, notFound } from '../../../../_lib/http.js';
import { loadPublicExhibition, publicExhibition } from '../../../../_lib/exhibitions.js';
import { PUBLIC_WORK_SQL } from '../../../../_lib/public.js';
import * as v from '../../../../_lib/validate.js';

// GET /api/x/:slug/works/:id - one shown work with its neighbours for prev/next navigation.
export const onRequestGet = handle(async ({ env, params }) => {
  const ex = await loadPublicExhibition(env.DB, params.slug);
  const id = v.int(params.id, { field: 'id', min: 1 });
  const work = await env.DB.prepare(`${PUBLIC_WORK_SQL} AND w.id = ?`).bind(ex.id, id).first();
  if (!work) throw notFound('ไม่พบผลงาน');
  const { results } = await env.DB.prepare(
    "SELECT id FROM works WHERE exhibition_id = ? AND status = 'shown' AND deleted_at IS NULL ORDER BY display_order, id"
  ).bind(ex.id).all();
  const ids = (results || []).map((r) => r.id);
  const i = ids.indexOf(id);
  return publicJson({
    ok: true,
    exhibition: publicExhibition(ex),
    work,
    prev: i > 0 ? ids[i - 1] : null,
    next: i >= 0 && i < ids.length - 1 ? ids[i + 1] : null,
    position: i + 1,
    total: ids.length
  }, 60);
});
