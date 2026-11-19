import { handle, json, readJson, notFound } from '../../../_lib/http.js';
import { actorOf } from '../../../_lib/auth.js';
import { requireCoordinator, audit } from '../../../_lib/exhibitions.js';
import * as v from '../../../_lib/validate.js';
import { coordinatorsOf } from '../../../_lib/roster.js';

// Coordinators (ผู้ประสานงาน, owner 2026-11-19): each selected artist has one coordinator, who contacts them and
// follows whether they have signed the acceptance on the website. Coordinators see every selected artist (to help
// each other, owner 2026-11-14) but only this page; admins and managers see it too. Notices are on the page only.

// GET /api/coord/:slug -> the selected artists (passed, incl. withdrawn) with contact details and progress.
export const onRequestGet = handle(async (context) => {
  const { user, ex, role } = await requireCoordinator(context);
  const db = context.env.DB;
  const { results } = await db.prepare(
    `SELECT a.id, a.artist_no, a.name_th, a.name_en, a.academic_title_th, a.nationality, a.affiliation, a.email, a.phone,
            a.channel, a.withdrawn, a.roster_note, a.coordinator_id, a.notified_at, a.notified_by, a.accepted_at, a.accepted_by,
            n.name AS notified_by_name
       FROM artists a LEFT JOIN users n ON n.id = a.notified_by
      WHERE a.exhibition_id = ? AND a.roster = 'selected'
      ORDER BY a.artist_no IS NULL, a.artist_no, a.id`
  ).bind(ex.id).all();
  return json({
    ok: true,
    exhibition: { slug: ex.slug, title_th: ex.title_th },
    me: { id: user.id, name: user.name, role },
    coordinators: (await coordinatorsOf(db, ex.id)).map((c) => ({ id: c.id, name: c.name })),
    artists: results || []
  });
});

// POST /api/coord/:slug { artist_id, notified: true|false } - "แจ้งศิลปินแล้ว" (records when and by whom) or undo.
export const onRequestPost = handle(async (context) => {
  const { user, ex } = await requireCoordinator(context);
  const db = context.env.DB;
  const b = await readJson(context.request);
  const id = v.int(b.artist_id, { field: 'ศิลปิน', min: 1 });
  const a = await db.prepare("SELECT id, name_th FROM artists WHERE id = ? AND exhibition_id = ? AND roster = 'selected'").bind(id, ex.id).first();
  if (!a) throw notFound('ไม่พบศิลปิน');
  if (b.notified) {
    await db.prepare("UPDATE artists SET notified_at = datetime('now'), notified_by = ?, updated_at = datetime('now') WHERE id = ?").bind(user.id, id).run();
  } else {
    await db.prepare("UPDATE artists SET notified_at = NULL, notified_by = NULL, updated_at = datetime('now') WHERE id = ?").bind(id).run();
  }
  await audit(db, ex.id, actorOf(user), b.notified ? 'coord.notified' : 'coord.unnotified', { artistId: id, name: a.name_th });
  return json({ ok: true });
});
