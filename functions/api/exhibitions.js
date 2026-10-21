import { handle, publicJson } from '../_lib/http.js';
import { publicExhibition } from '../_lib/exhibitions.js';

// Shown works per exhibition offered to the lobby's preview strip; the browser picks 6 of them at random.
const SAMPLE_POOL = 24;

// GET /api/exhibitions - lobby: every non-draft exhibition with its counts and a pool of sample images.
export const onRequestGet = handle(async ({ env }) => {
  const samples = await env.DB.prepare(
    `SELECT exhibition_id, image_url FROM (
       SELECT w.exhibition_id, w.image_url,
              ROW_NUMBER() OVER (PARTITION BY w.exhibition_id ORDER BY random()) AS rn
         FROM works w JOIN exhibitions e ON e.id = w.exhibition_id
        WHERE w.status = 'shown' AND w.deleted_at IS NULL AND e.status != 'draft')
      WHERE rn <= ?`
  ).bind(SAMPLE_POOL).all();
  const pool = new Map();
  for (const r of samples.results || []) {
    if (!pool.has(r.exhibition_id)) pool.set(r.exhibition_id, []);
    pool.get(r.exhibition_id).push(r.image_url);
  }
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
      cover_url: e.hero_url || e.cover_url || '',
      samples: pool.get(e.id) || []
    }))
  }, 60);
});
