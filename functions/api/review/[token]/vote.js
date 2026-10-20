import { handle, json, readJson, HttpError, notFound } from '../../../_lib/http.js';
import { loadReviewer } from '../../../_lib/reviewer.js';
import { recompute, reviewOpen } from '../../../_lib/review.js';
import { audit } from '../../../_lib/exhibitions.js';
import * as v from '../../../_lib/validate.js';

// POST /api/review/:token/vote { work_id, decision: approve|reject|abstain|null, comment? }
// decision null clears the vote. Votes can change until the deadline.
export const onRequestPost = handle(async ({ request, env, params }) => {
  const { reviewer, ex } = await loadReviewer(env, request, params.token);
  if (!reviewOpen(ex)) {
    throw new HttpError(409, ex.review_open ? 'ปิดการพิจารณาแล้ว (เลยกำหนด)' : 'ยังไม่เปิดให้พิจารณา');
  }
  const db = env.DB;
  const b = await readJson(request);
  const workId = v.int(b.work_id, { field: 'ผลงาน', min: 1 });
  const work = await db.prepare(
    "SELECT id FROM works WHERE id = ? AND exhibition_id = ? AND status = 'shown' AND deleted_at IS NULL"
  ).bind(workId, ex.id).first();
  if (!work) throw notFound('ไม่พบผลงาน');
  if (b.decision === null) {
    await db.prepare('DELETE FROM votes WHERE work_id = ? AND reviewer_id = ?').bind(workId, reviewer.id).run();
  } else {
    const decision = v.oneOf(b.decision, ['approve', 'reject', 'abstain'], { field: 'ผลการพิจารณา' });
    const comment = v.longText(b.comment, { field: 'ความเห็น', max: 2000 });
    await db.prepare(
      `INSERT INTO votes (work_id, reviewer_id, exhibition_id, decision, comment) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(work_id, reviewer_id) DO UPDATE SET decision = excluded.decision, comment = excluded.comment, updated_at = datetime('now')`
    ).bind(workId, reviewer.id, ex.id, decision, comment).run();
  }
  await recompute(db, ex, [workId]);
  await audit(db, ex.id, `reviewer:${reviewer.id}`, 'vote', { workId, decision: b.decision });
  return json({ ok: true });
});
