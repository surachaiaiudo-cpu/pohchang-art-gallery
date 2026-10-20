import { handle, json, readJson } from '../../../../_lib/http.js';
import { actorOf } from '../../../../_lib/auth.js';
import { requireManager, audit } from '../../../../_lib/exhibitions.js';
import { recompute } from '../../../../_lib/review.js';
import * as v from '../../../../_lib/validate.js';

// GET /api/manage/:slug/works?status=submitted|shown|rejected|all
// Everything the curator needs, including private artist contacts and the panel tally.
export const onRequestGet = handle(async (context) => {
  const { ex } = await requireManager(context);
  const db = context.env.DB;
  const status = new URL(context.request.url).searchParams.get('status') || 'all';
  v.oneOf(status, ['all', 'submitted', 'shown', 'rejected'], { field: 'สถานะ' });
  const where = ['w.exhibition_id = ?', 'w.deleted_at IS NULL'];
  const params = [ex.id];
  if (status !== 'all') { where.push('w.status = ?'); params.push(status); }
  const { results } = await db.prepare(
    `SELECT w.*, a.name_th AS artist_name_th, a.name_en AS artist_name_en, a.academic_title_th,
            a.email AS artist_email, a.phone AS artist_phone, a.affiliation, a.nationality, a.avatar_url,
            (SELECT COUNT(*) FROM votes x JOIN reviewers r ON r.id = x.reviewer_id AND r.active = 1
              WHERE x.work_id = w.id AND x.decision = 'approve') AS approvals,
            (SELECT COUNT(*) FROM votes x JOIN reviewers r ON r.id = x.reviewer_id AND r.active = 1
              WHERE x.work_id = w.id AND x.decision = 'reject') AS rejections,
            (SELECT COUNT(*) FROM votes x JOIN reviewers r ON r.id = x.reviewer_id AND r.active = 1
              WHERE x.work_id = w.id AND x.decision = 'abstain') AS abstentions
       FROM works w JOIN artists a ON a.id = w.artist_id
      WHERE ${where.join(' AND ')}
      ORDER BY w.display_order, w.id`
  ).bind(...params).all();
  return json({ ok: true, works: results || [] });
});

// POST /api/manage/:slug/works { ids: [], status } - screen many works at once.
export const onRequestPost = handle(async (context) => {
  const { user, ex } = await requireManager(context);
  const db = context.env.DB;
  const b = await readJson(context.request);
  const status = v.oneOf(b.status, ['submitted', 'shown', 'rejected'], { field: 'สถานะ' });
  const ids = (Array.isArray(b.ids) ? b.ids : []).slice(0, 500).map((i) => v.int(i, { field: 'id', min: 1 }));
  if (!ids.length) return json({ ok: true, updated: 0 });
  const stmts = ids.map((id) => db.prepare(
    "UPDATE works SET status = ?, updated_at = datetime('now') WHERE id = ? AND exhibition_id = ? AND deleted_at IS NULL"
  ).bind(status, id, ex.id));
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
  if (status !== 'shown') {
    // D1 allows at most 100 bound parameters per statement, so update in chunks.
    for (let i = 0; i < ids.length; i += 90) {
      const chunk = ids.slice(i, i + 90);
      await db.prepare(
        `UPDATE works SET endorsed = 0, review_result = 'pending' WHERE exhibition_id = ? AND id IN (${chunk.map(() => '?').join(',')})`
      ).bind(ex.id, ...chunk).run();
    }
  } else {
    await recompute(db, ex, ids.length <= 90 ? ids : null);
  }
  await audit(db, ex.id, actorOf(user), 'works.screen', { status, count: ids.length });
  return json({ ok: true, updated: ids.length });
});
