import { handle, json, readJson, bad } from '../../../../_lib/http.js';
import { actorOf } from '../../../../_lib/auth.js';
import { requireManager, audit } from '../../../../_lib/exhibitions.js';
import { randomToken, sha256Hex } from '../../../../_lib/crypto.js';
import { recompute } from '../../../../_lib/review.js';
import * as v from '../../../../_lib/validate.js';

export const reviewLink = (request, token) => `${new URL(request.url).origin}/review/${token}`;

// GET /api/manage/:slug/reviewers - panel members and how far each one has got.
export const onRequestGet = handle(async (context) => {
  const { ex } = await requireManager(context);
  const db = context.env.DB;
  const [rev, shown] = await db.batch([
    db.prepare(
      `SELECT r.id, r.name, r.title, r.email, r.active, r.created_at, r.last_seen_at,
              (SELECT COUNT(*) FROM votes v JOIN works w ON w.id = v.work_id
                WHERE v.reviewer_id = r.id AND w.status = 'shown' AND w.deleted_at IS NULL) AS voted
         FROM reviewers r WHERE r.exhibition_id = ? ORDER BY r.id`
    ).bind(ex.id),
    db.prepare("SELECT COUNT(*) AS n FROM works WHERE exhibition_id = ? AND status = 'shown' AND deleted_at IS NULL").bind(ex.id)
  ]);
  return json({ ok: true, reviewers: rev.results || [], shownWorks: shown.results[0].n });
});

// POST /api/manage/:slug/reviewers { name, title?, email? } -> the personal link, shown once.
export const onRequestPost = handle(async (context) => {
  const { user, ex } = await requireManager(context);
  const db = context.env.DB;
  const b = await readJson(context.request);
  const name = v.text(b.name, { field: 'ชื่อผู้ทรงคุณวุฒิ', max: 200, required: true });
  const title = v.text(b.title, { field: 'ตำแหน่ง', max: 200 });
  const email = v.email(b.email);
  const active = await db.prepare('SELECT COUNT(*) AS n FROM reviewers WHERE exhibition_id = ? AND active = 1').bind(ex.id).first();
  if (active.n >= ex.review_panel_size) {
    throw bad(`คณะผู้ทรงคุณวุฒิครบ ${ex.review_panel_size} ท่านแล้ว ปิดการใช้งานท่านเดิมหรือเพิ่มจำนวนในหน้าตั้งค่าก่อน`);
  }
  const token = randomToken(32);
  const res = await db.prepare('INSERT INTO reviewers (exhibition_id, name, title, email, token_hash) VALUES (?, ?, ?, ?, ?)')
    .bind(ex.id, name, title, email, await sha256Hex(token)).run();
  await recompute(db, ex);
  await audit(db, ex.id, actorOf(user), 'reviewer.add', { id: res.meta.last_row_id, name });
  return json({ ok: true, reviewer: { id: res.meta.last_row_id, name }, link: reviewLink(context.request, token) }, { status: 201 });
});
