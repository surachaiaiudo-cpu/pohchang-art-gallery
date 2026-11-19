import { handle, json, readJson, bad, notFound } from '../../../../_lib/http.js';
import { actorOf } from '../../../../_lib/auth.js';
import { requireManager, audit } from '../../../../_lib/exhibitions.js';
import * as v from '../../../../_lib/validate.js';
import { MAX_ARTIST_NO } from '../../../../../public/js/roster-logic.js';
import { ROSTER_ARTIST_TEXT, channelOf, rosterOf, coordinatorOf } from '../../../../_lib/roster.js';

async function loadArtist(db, ex, id) {
  const a = await db.prepare('SELECT * FROM artists WHERE id = ? AND exhibition_id = ?').bind(id, ex.id).first();
  if (!a) throw notFound('ไม่พบศิลปิน');
  return a;
}

// PUT /api/manage/:slug/roster/:id { channel?, roster?, withdrawn?, roster_note?, artist_no? (null = none), <artist fields>? }
export const onRequestPut = handle(async (context) => {
  const { user, ex } = await requireManager(context);
  const db = context.env.DB;
  const id = v.int(context.params.id, { field: 'id', min: 1 });
  const artist = await loadArtist(db, ex, id);
  const b = await readJson(context.request);
  const set = {};
  for (const [k, opts] of Object.entries(ROSTER_ARTIST_TEXT)) if (b[k] !== undefined) set[k] = v.text(b[k], opts);
  if (b.email !== undefined) set.email = v.email(b.email);
  if (b.nationality !== undefined) set.nationality = v.country(b.nationality);
  if (b.channel !== undefined) set.channel = channelOf(b.channel);
  if (b.roster !== undefined) set.roster = rosterOf(b.roster);
  if (b.withdrawn !== undefined) set.withdrawn = b.withdrawn ? 1 : 0;
  if (b.coordinator_id !== undefined) set.coordinator_id = await coordinatorOf(db, ex.id, b.coordinator_id);
  if (b.roster_note !== undefined) set.roster_note = v.text(b.roster_note, { field: 'หมายเหตุ', max: 500 });
  if (b.artist_no !== undefined) {
    set.artist_no = b.artist_no === null || b.artist_no === '' ? null
      : v.int(b.artist_no, { field: 'เลขที่ศิลปิน', min: 1, max: MAX_ARTIST_NO });
    if (set.artist_no !== null) {
      const taken = await db.prepare('SELECT id, name_th FROM artists WHERE exhibition_id = ? AND artist_no = ? AND id != ?')
        .bind(ex.id, set.artist_no, id).first();
      if (taken) throw bad(`เลขที่ ${String(set.artist_no).padStart(3, '0')} เป็นของ ${taken.name_th} แล้ว`);
    }
  }
  const cols = Object.keys(set);
  if (!cols.length) return json({ ok: true });
  await db.prepare(`UPDATE artists SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ? AND exhibition_id = ?`)
    .bind(...cols.map((c) => set[c]), id, ex.id).run();
  const changed = Object.fromEntries(cols.filter((c) => !['email', 'phone'].includes(c)).map((c) => [c, set[c]]));
  await audit(db, ex.id, actorOf(user), 'roster.update', { artistId: id, name: artist.name_th, ...changed });
  return json({ ok: true });
});

// DELETE /api/manage/:slug/roster/:id - only an artist with no works at all (added by mistake).
export const onRequestDelete = handle(async (context) => {
  const { user, ex } = await requireManager(context);
  const db = context.env.DB;
  const id = v.int(context.params.id, { field: 'id', min: 1 });
  const artist = await loadArtist(db, ex, id);
  const w = await db.prepare('SELECT COUNT(*) AS n FROM works WHERE artist_id = ?').bind(id).first();
  if (w.n > 0) throw bad('ศิลปินท่านนี้มีผลงานในระบบ ลบออกจากรายชื่อไม่ได้');
  await db.prepare('DELETE FROM artists WHERE id = ? AND exhibition_id = ?').bind(id, ex.id).run();
  await audit(db, ex.id, actorOf(user), 'roster.delete', { artistId: id, name: artist.name_th });
  return json({ ok: true });
});
