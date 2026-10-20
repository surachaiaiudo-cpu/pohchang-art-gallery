import { handle, publicJson } from '../_lib/http.js';
import { publicExhibition } from '../_lib/exhibitions.js';

// GET /api/exhibitions - lobby: every non-draft exhibition with its counts.
export const onRequestGet = handle(async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT e.*,
            (SELECT COUNT(*) FROM works w WHERE w.exhibition_id = e.id AND w.status = 'shown' AND w.deleted_at IS NULL) AS work_count,
            (SELECT COUNT(*) FROM works w WHERE w.exhibition_id = e.id AND w.status = 'shown' AND w.endorsed = 1 AND w.deleted_at IS NULL) AS endorsed_count,
            (SELECT image_url FROM works w WHERE w.exhibition_id = e.id AND w.status = 'shown' AND w.deleted_at IS NULL
              ORDER BY w.endorsed DESC, w.display_order, w.id LIMIT 1) AS cover_url
       FROM exhibitions e WHERE e.status != 'draft'
      ORDER BY COALESCE(e.starts_on, e.created_at) DESC`
  ).all();
  return publicJson({
    ok: true,
    exhibitions: (results || []).map((e) => ({
      ...publicExhibition(e),
      work_count: e.work_count,
      endorsed_count: e.endorsed_count,
      cover_url: e.hero_url || e.cover_url || ''
    }))
  }, 60);
});
