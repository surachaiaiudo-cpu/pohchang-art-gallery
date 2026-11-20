import { handle, json, notFound } from '../../../../_lib/http.js';
import { requireCoordinator } from '../../../../_lib/exhibitions.js';
import { parseJson } from '../../../../_lib/acceptance.js';
import * as v from '../../../../_lib/validate.js';

// GET /api/coord/:slug/acceptance/:id - one artist's reply form (แบบตอบรับ) for staff: admins, managers, coordinators.
// `before` = what staff had entered before the artist's first reply; `changes` = every field the artist corrected.
export const onRequestGet = handle(async (context) => {
  const { ex } = await requireCoordinator(context);
  const db = context.env.DB;
  const id = v.int(context.params.id, { field: 'id', min: 1 });
  const a = await db.prepare(
    `SELECT id, artist_no, name_th, name_en, email, phone, nationality, affiliation, avatar_url, accepted_at, accepted_by
       FROM artists WHERE id = ? AND exhibition_id = ?`
  ).bind(id, ex.id).first();
  if (!a) throw notFound('ไม่พบศิลปิน');
  const r = await db.prepare('SELECT * FROM acceptances WHERE artist_id = ?').bind(id).first();
  return json({
    ok: true,
    artist: a,
    reply: r ? {
      data: parseJson(r.data, {}), before: parseJson(r.before, {}), changes: parseJson(r.changes, []),
      signed_name: r.signed_name, filled_by: r.filled_by, times: r.times, created_at: r.created_at, updated_at: r.updated_at
    } : null
  });
});
