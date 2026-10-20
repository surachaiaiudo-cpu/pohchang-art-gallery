import { handle, publicJson } from '../../../_lib/http.js';
import { loadPublicExhibition, publicExhibition } from '../../../_lib/exhibitions.js';
import { PUBLIC_WORK_SQL } from '../../../_lib/public.js';

// GET /api/x/:slug - one exhibition and its shown works (public).
export const onRequestGet = handle(async ({ env, params }) => {
  const ex = await loadPublicExhibition(env.DB, params.slug);
  const { results } = await env.DB.prepare(`${PUBLIC_WORK_SQL} ORDER BY w.display_order, w.id`).bind(ex.id).all();
  return publicJson({
    ok: true,
    exhibition: publicExhibition(ex),
    redirectTo: ex._redirectedFrom ? ex.slug : null,
    works: results || []
  }, 60);
});
