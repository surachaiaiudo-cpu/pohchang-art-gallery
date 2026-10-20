import { handle, json } from '../../../_lib/http.js';
import { requireManager } from '../../../_lib/exhibitions.js';
import { recompute } from '../../../_lib/review.js';

// GET /api/manage/:slug/results - every reviewer's vote and comment per shown work.
export const onRequestGet = handle(async (context) => {
  const { ex } = await requireManager(context);
  const db = context.env.DB;
  const [works, votes, reviewers] = await db.batch([
    db.prepare(
      `SELECT w.id, w.title_th, w.image_url, w.review_result, w.badge_override, w.endorsed, a.name_th AS artist_name_th
         FROM works w JOIN artists a ON a.id = w.artist_id
        WHERE w.exhibition_id = ? AND w.status = 'shown' AND w.deleted_at IS NULL
        ORDER BY w.display_order, w.id`
    ).bind(ex.id),
    db.prepare('SELECT work_id, reviewer_id, decision, comment, updated_at FROM votes WHERE exhibition_id = ?').bind(ex.id),
    db.prepare('SELECT id, name, active FROM reviewers WHERE exhibition_id = ? ORDER BY id').bind(ex.id)
  ]);
  return json({
    ok: true,
    threshold: ex.review_threshold,
    panelSize: ex.review_panel_size,
    reviewers: reviewers.results || [],
    works: works.results || [],
    votes: votes.results || []
  });
});

// POST /api/manage/:slug/results - recompute every badge (after changing the panel or rules).
export const onRequestPost = handle(async (context) => {
  const { ex } = await requireManager(context);
  const n = await recompute(context.env.DB, ex);
  return json({ ok: true, recomputed: n });
});
