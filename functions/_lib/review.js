// Expert panel tally. Pure function so it can be unit-tested.
//
// threshold  approvals needed for the badge (e.g. 3)
// eligible   active reviewers on the panel (e.g. 5)
// votes      [{ decision: 'approve' | 'reject' | 'abstain' }]
//
// endorsed       approvals >= threshold
// not_endorsed   the badge can no longer be reached even if everyone left approves
// needs_curator  too many abstentions: fewer voters than the threshold remain
// pending        still open
export function tally({ threshold, eligible, votes }) {
  let approve = 0, reject = 0, abstain = 0;
  for (const v of votes) {
    if (v.decision === 'approve') approve++;
    else if (v.decision === 'reject') reject++;
    else if (v.decision === 'abstain') abstain++;
  }
  const voters = eligible - abstain;               // reviewers who can still give a yes/no
  const undecided = Math.max(0, voters - approve - reject);
  let result = 'pending';
  if (approve >= threshold) result = 'endorsed';
  else if (voters < threshold) result = 'needs_curator';
  else if (approve + undecided < threshold) result = 'not_endorsed';
  return { approve, reject, abstain, undecided, result };
}

// The public badge: a curator override wins over the panel result.
export const isEndorsed = (result, override) => (override ? override === 'endorsed' : result === 'endorsed');

// Recomputes review_result/endorsed for the given works (all shown works when ids is null).
export async function recompute(db, ex, ids = null) {
  const eligibleRow = await db.prepare('SELECT COUNT(*) AS n FROM reviewers WHERE exhibition_id = ? AND active = 1')
    .bind(ex.id).first();
  const eligible = Math.min(eligibleRow ? eligibleRow.n : 0, ex.review_panel_size || 99);
  const params = [ex.id];
  let where = "w.exhibition_id = ? AND w.status = 'shown' AND w.deleted_at IS NULL";
  if (ids && ids.length && ids.length <= 90) { // D1: max 100 bound parameters
    where += ` AND w.id IN (${ids.map(() => '?').join(',')})`;
    params.push(...ids);
  }
  const [works, votes] = await db.batch([
    db.prepare(`SELECT w.id, w.badge_override FROM works w WHERE ${where}`).bind(...params),
    db.prepare(
      `SELECT v.work_id, v.decision FROM votes v
         JOIN reviewers r ON r.id = v.reviewer_id AND r.active = 1
        WHERE v.exhibition_id = ?`
    ).bind(ex.id)
  ]);
  const byWork = new Map();
  for (const w of works.results || []) byWork.set(w.id, { override: w.badge_override, votes: [] });
  for (const v of votes.results || []) {
    const w = byWork.get(v.work_id);
    if (w) w.votes.push({ decision: v.decision });
  }
  const stmts = [];
  for (const [id, w] of byWork) {
    const t = tally({ threshold: ex.review_threshold, eligible, votes: w.votes });
    stmts.push(db.prepare("UPDATE works SET review_result = ?, endorsed = ?, updated_at = datetime('now') WHERE id = ? AND exhibition_id = ?")
      .bind(t.result, isEndorsed(t.result, w.override) ? 1 : 0, id, ex.id));
  }
  // D1 batch keeps this to one round trip regardless of the number of works.
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
  return byWork.size;
}

export function reviewOpen(ex, at = Date.now()) {
  if (!ex.review_open) return false;
  if (ex.review_deadline && at > Date.parse(ex.review_deadline)) return false;
  return true;
}
