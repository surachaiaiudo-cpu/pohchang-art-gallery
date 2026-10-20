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
    "SELECT id, title_th, title_en, title_zh FROM works WHERE exhibition_id = ? AND status = 'shown' AND deleted_at IS NULL ORDER BY display_order, id"
  ).bind(ex.id).all();
  const rows = results || [];
  const i = rows.findIndex((r) => r.id === id);
  return publicJson({
    ok: true,
    exhibition: publicExhibition(ex),
    work,
    // Neighbours carry their titles so the pager can name them.
    prev: i > 0 ? rows[i - 1] : null,
    next: i >= 0 && i < rows.length - 1 ? rows[i + 1] : null,
    position: i + 1,
    total: rows.length
  }, 60);
});
