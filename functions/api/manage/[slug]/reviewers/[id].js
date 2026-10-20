import { handle, json, readJson, notFound, bad } from '../../../../_lib/http.js';
import { actorOf } from '../../../../_lib/auth.js';
import { requireManager, audit } from '../../../../_lib/exhibitions.js';
import { randomToken, sha256Hex } from '../../../../_lib/crypto.js';
import { recompute } from '../../../../_lib/review.js';
import { reviewLink } from './index.js';
import * as v from '../../../../_lib/validate.js';

// PUT /api/manage/:slug/reviewers/:id { name?, title?, email?, active?, new_link? }
// new_link: issue a fresh personal link; the old one stops working at once.
export const onRequestPut = handle(async (context) => {
  const { user, ex } = await requireManager(context);
  const db = context.env.DB;
  const id = v.int(context.params.id, { field: 'id', min: 1 });
  const r = await db.prepare('SELECT * FROM reviewers WHERE id = ? AND exhibition_id = ?').bind(id, ex.id).first();
  if (!r) throw notFound('ไม่พบผู้ทรงคุณวุฒิ');
  const b = await readJson(context.request);
  const name = b.name !== undefined ? v.text(b.name, { field: 'ชื่อ', max: 200, required: true }) : r.name;
  const title = b.title !== undefined ? v.text(b.title, { field: 'ตำแหน่ง', max: 200 }) : r.title;
  const email = b.email !== undefined ? v.email(b.email) : r.email;
  const active = b.active !== undefined ? (b.active ? 1 : 0) : r.active;
  if (active && !r.active) {
    const n = await db.prepare('SELECT COUNT(*) AS n FROM reviewers WHERE exhibition_id = ? AND active = 1').bind(ex.id).first();
    if (n.n >= ex.review_panel_size) throw bad(`คณะผู้ทรงคุณวุฒิครบ ${ex.review_panel_size} ท่านแล้ว`);
  }
  let link;
  let tokenHash = r.token_hash;
  if (b.new_link) {
    const token = randomToken(32);
    tokenHash = await sha256Hex(token);
    link = reviewLink(context.request, token);
  }
  await db.prepare('UPDATE reviewers SET name = ?, title = ?, email = ?, active = ?, token_hash = ? WHERE id = ? AND exhibition_id = ?')
    .bind(name, title, email, active, tokenHash, id, ex.id).run();
  if (active !== r.active) await recompute(db, ex);
  await audit(db, ex.id, actorOf(user), 'reviewer.update', { id, active, newLink: !!b.new_link });
  return json({ ok: true, ...(link ? { link } : {}) });
});
