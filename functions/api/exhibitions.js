import { handle, publicJson } from '../_lib/http.js';
import { publicExhibition } from '../_lib/exhibitions.js';

// Shown works per exhibition offered to the lobby's preview strip; the browser picks 6 of them at random.
const SAMPLE_POOL = 24;

// GET /api/exhibitions - lobby: every public (open or archived) exhibition with its counts and a pool of sample images.
export const onRequestGet = handle(async ({ env }) => {
  const samples = await env.DB.prepare(
    `SELECT exhibition_id, id, image_url, title_th, title_en, title_zh, name_th, name_en, name_zh FROM (
       SELECT w.exhibition_id, w.id, w.image_url, w.title_th, w.title_en, w.title_zh,
              a.name_th, a.name_en, a.name_zh,
              ROW_NUMBER() OVER (PARTITION BY w.exhibition_id ORDER BY random()) AS rn
         FROM works w JOIN exhibitions e ON e.id = w.exhibition_id JOIN artists a ON a.id = w.artist_id
        WHERE w.status = 'shown' AND w.deleted_at IS NULL AND e.status IN ('open', 'archived'))
      WHERE rn <= ?`
  ).bind(SAMPLE_POOL).all();
  const pool = new Map();
  for (const r of samples.results || []) {
    if (!pool.has(r.exhibition_id)) pool.set(r.exhibition_id, []);
    // Title and artist name only, for the hero caption; never contact details.
    pool.get(r.exhibition_id).push({
      id: r.id, url: r.image_url,
      title_th: r.title_th || '', title_en: r.title_en || '', title_zh: r.title_zh || '',
      name_th: r.name_th || '', name_en: r.name_en || '', name_zh: r.name_zh || ''
    });
  }
  const { results } = await env.DB.prepare(
    `SELECT e.*,
            (SELECT COUNT(*) FROM works w WHERE w.exhibition_id = e.id AND w.status = 'shown' AND w.deleted_at IS NULL) AS work_count,
            (SELECT COUNT(*) FROM works w WHERE w.exhibition_id = e.id AND w.status = 'shown' AND w.endorsed = 1 AND w.deleted_at IS NULL) AS endorsed_count,
            (SELECT image_url FROM works w WHERE w.exhibition_id = e.id AND w.status = 'shown' AND w.deleted_at IS NULL
              ORDER BY w.endorsed DESC, w.display_order, w.id LIMIT 1) AS cover_url
       FROM exhibitions e WHERE e.status IN ('open', 'archived')
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
