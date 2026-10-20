import { handle, json } from '../../../_lib/http.js';
import { loadReviewer } from '../../../_lib/reviewer.js';
import { reviewOpen } from '../../../_lib/review.js';
import { parseCategories } from '../../../_lib/categories.js';

// GET /api/review/:token - the works this reviewer judges and their own votes so far.
export const onRequestGet = handle(async ({ request, env, params }) => {
  const { reviewer, ex } = await loadReviewer(env, request, params.token);
  const db = env.DB;
  const blind = !!ex.review_blind;
  const [works, mine] = await db.batch([
    db.prepare(
      `SELECT w.id, w.title_th, w.title_en, w.title_zh, w.technique_th, w.technique_en, w.technique_zh, w.dimensions, w.year_created,
              w.concept_th, w.concept_en, w.concept_zh, w.category, w.subcategory, w.video_url,
              w.image_url, w.image_width, w.image_height,
              a.name_th AS artist_name_th, a.name_en AS artist_name_en, a.name_zh AS artist_name_zh, a.academic_title_th, a.affiliation
         FROM works w JOIN artists a ON a.id = w.artist_id
        WHERE w.exhibition_id = ? AND w.status = 'shown' AND w.deleted_at IS NULL
        ORDER BY w.display_order, w.id`
    ).bind(ex.id),
    db.prepare('SELECT work_id, decision, comment FROM votes WHERE reviewer_id = ?').bind(reviewer.id),
    db.prepare("UPDATE reviewers SET last_seen_at = datetime('now') WHERE id = ?").bind(reviewer.id)
  ]);
  const votes = Object.fromEntries((mine.results || []).map((v) => [v.work_id, { decision: v.decision, comment: v.comment }]));
  return json({
    ok: true,
    reviewer,
    exhibition: {
      slug: ex.slug, title_th: ex.title_th, title_en: ex.title_en, title_zh: ex.title_zh || '', theme_preset: ex.theme_preset,
      review_deadline: ex.review_deadline, review_threshold: ex.review_threshold,
      review_panel_size: ex.review_panel_size, review_blind: blind,
      badge_label_th: ex.badge_label_th, badge_label_en: ex.badge_label_en, badge_label_zh: ex.badge_label_zh || '',
      categories: parseCategories(ex.categories)
    },
    open: reviewOpen(ex),
    works: (works.results || []).map((w) => (blind
      ? { ...w, artist_name_th: '', artist_name_en: '', artist_name_zh: '', academic_title_th: '', affiliation: '' }
      : w)),
    votes
  });
});
