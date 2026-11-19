import { handle, json, readJson, bad, forbidden } from '../../../../_lib/http.js';
import { actorOf } from '../../../../_lib/auth.js';
import { requireManager, audit } from '../../../../_lib/exhibitions.js';
import { normName } from '../../../../_lib/artist-match.js';
import * as v from '../../../../_lib/validate.js';
import { STAGE_KEYS, planNumbers } from '../../../../../public/js/roster-logic.js';
import { ROSTER_ARTIST_TEXT, channelOf, rosterOf, parseImport, IMPORT_MAX_ROWS, coordinatorsOf, coordinatorOf } from '../../../../_lib/roster.js';
import { matchCountry } from '../../../../_lib/import-old.js';
import { isCountryCode } from '../../../../../public/js/countries.js';


// GET /api/manage/:slug/roster - every artist of the exhibition with channel, status, number and work counts.
// Back office only: includes email and phone.
export const onRequestGet = handle(async (context) => {
  const { ex } = await requireManager(context);
  const { results } = await context.env.DB.prepare(
    `SELECT a.id, a.name_th, a.name_en, a.name_zh, a.academic_title_th, a.email, a.phone, a.nationality, a.affiliation,
            a.channel, a.roster, a.artist_no, a.withdrawn, a.roster_note, a.created_at,
            a.coordinator_id, a.notified_at, a.accepted_at, a.accepted_by,
            (SELECT COUNT(*) FROM works w WHERE w.artist_id = a.id AND w.deleted_at IS NULL AND w.stage = 'selection') AS works_selection,
            (SELECT COUNT(*) FROM works w WHERE w.artist_id = a.id AND w.deleted_at IS NULL AND w.stage != 'selection') AS works_exhibit,
            (SELECT COUNT(*) FROM works w WHERE w.artist_id = a.id AND w.deleted_at IS NULL AND w.stage = 'selection'
                AND w.status = 'shown' AND w.endorsed = 1) AS selection_endorsed,
            (SELECT COUNT(*) FROM works w WHERE w.artist_id = a.id AND w.deleted_at IS NULL AND w.stage = 'selection'
                AND w.status = 'shown') AS selection_reviewed
       FROM artists a WHERE a.exhibition_id = ?
      ORDER BY a.artist_no IS NULL, a.artist_no, a.id`
  ).bind(ex.id).all();
  const stages = await context.env.DB.prepare(
    'SELECT stage, COUNT(*) AS n FROM works WHERE exhibition_id = ? AND deleted_at IS NULL GROUP BY stage'
  ).bind(ex.id).all();
  // Work groups (categories, กลุ่มงาน) of each artist's works, in the order the works were sent (column + filter).
  const cats = await context.env.DB.prepare(
    `SELECT artist_id, category, MIN(display_order) AS o, MIN(id) AS i FROM works
      WHERE exhibition_id = ? AND deleted_at IS NULL GROUP BY artist_id, category ORDER BY artist_id, o, i`
  ).bind(ex.id).all();
  const byArtist = new Map();
  for (const r of cats.results || []) {
    if (!byArtist.has(r.artist_id)) byArtist.set(r.artist_id, []);
    byArtist.get(r.artist_id).push(r.category || '');
  }
  for (const a of results || []) a.categories = byArtist.get(a.id) || [];
  const workStages = { exhibit: 0, selection: 0 };
  for (const r of stages.results || []) workStages[r.stage === 'selection' ? 'selection' : 'exhibit'] += r.n;
  const coordinators = await coordinatorsOf(context.env.DB, ex.id);
  return json({ ok: true, artists: results || [], work_stages: workStages, submit_stage: ex.submit_stage || 'exhibit', coordinators });
});

// Sheet rows from the browser: at most IMPORT_MAX_ROWS + 10 rows of 30 cells, each cell text up to 600 characters.
function cleanSheet(rows) {
  if (!Array.isArray(rows)) throw bad('ไม่พบข้อมูลในไฟล์');
  return rows.slice(0, IMPORT_MAX_ROWS + 10).map((r) => (Array.isArray(r) ? r.slice(0, 30) : [])
    .map((c) => (c === null || c === undefined ? '' : String(c).slice(0, 600))));
}
// "TH" / "th" as a code, else the importer's names in Thai, English and Chinese.
const countryOf = (text) => {
  const up = String(text || '').trim().toUpperCase();
  return isCountryCode(up) ? { code: up } : matchCountry(text);
};

const ids = (list) => (Array.isArray(list) ? list : []).slice(0, 1000).map((i) => v.int(i, { field: 'id', min: 1 }));

// POST /api/manage/:slug/roster
//   { action: 'add', artist: {...}, channel, roster, force? }      add an artist by hand (channels 1 and 3)
//   { action: 'set', ids: [], channel?, roster? }                   change many artists at once
//   { action: 'number' }                                            give numbers to selected artists without one
//   { action: 'clear_numbers' }                                     (admin) remove every number, to run again
//   { action: 'stage_all', stage }                                  mark every current work as selection / exhibit
//   { action: 'import_preview', rows: string[][] }                  check an Excel sheet, save nothing
//   { action: 'import', rows: string[][], force_lines: [] }          save the good rows (duplicates only when forced)
export const onRequestPost = handle(async (context) => {
  const { user, ex } = await requireManager(context);
  const db = context.env.DB;
  const b = await readJson(context.request, { max: 1536 * 1024 });
  const action = v.oneOf(b.action, ['add', 'set', 'number', 'clear_numbers', 'stage_all', 'import_preview', 'import'], { field: 'คำสั่ง' });

  if (action === 'import_preview' || action === 'import') {
    const rows = cleanSheet(b.rows);
    const { results } = await db.prepare('SELECT id, name_th, name_en FROM artists WHERE exhibition_id = ?').bind(ex.id).all();
    let parsed;
    try {
      parsed = parseImport(rows, results || [], { matchCountry: countryOf, normName, coordinators: await coordinatorsOf(db, ex.id) });
    } catch (err) { throw bad(err.message); }
    if (action === 'import_preview') return json({ ok: true, ...parsed });
    const force = new Set((Array.isArray(b.force_lines) ? b.force_lines : []).map(Number));
    const take = parsed.rows.filter((r) => !r.errors.length && (!r.duplicate || force.has(r.line)));
    const stmts = take.map((r) => db.prepare(
      `INSERT INTO artists (exhibition_id, name_th, name_en, academic_title_th, email, phone, nationality, affiliation, channel, roster, roster_note, coordinator_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(ex.id, r.artist.name_th, r.artist.name_en, r.artist.academic_title_th, r.artist.email, r.artist.phone,
      r.artist.nationality, r.artist.affiliation, r.channel, r.roster, r.roster_note, r.coordinator_id || null));
    for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
    await audit(db, ex.id, actorOf(user), 'roster.import', { added: take.length, rows: parsed.rows.length });
    return json({ ok: true, added: take.length, skipped: parsed.rows.length - take.length });
  }

  if (action === 'add') {
    const a = b.artist || {};
    const artist = {};
    for (const [k, opts] of Object.entries(ROSTER_ARTIST_TEXT)) artist[k] = v.text(a[k], opts);
    artist.email = v.email(a.email);
    artist.nationality = v.country(a.nationality);
    const channel = channelOf(b.channel ?? 0);
    const roster = rosterOf(b.roster ?? '');
    if (!b.force) {
      const { results } = await db.prepare('SELECT id, name_th, name_en FROM artists WHERE exhibition_id = ?').bind(ex.id).all();
      // Any of the new names against any name already in the list (Thai and English are often swapped).
      const mine = [artist.name_th, artist.name_en].map(normName).filter(Boolean);
      const same = (results || []).find((x) => [x.name_th, x.name_en].map(normName).some((n) => n && mine.includes(n)));
      if (same) return json({ ok: false, duplicate: { id: same.id, name_th: same.name_th, name_en: same.name_en }, error: 'มีศิลปินชื่อนี้ในรายชื่อแล้ว' }, { status: 409 });
    }
    const res = await db.prepare(
      `INSERT INTO artists (exhibition_id, name_th, name_en, name_zh, academic_title_th, email, phone, nationality, affiliation, channel, roster)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(ex.id, artist.name_th, artist.name_en, artist.name_zh, artist.academic_title_th, artist.email, artist.phone,
      artist.nationality, artist.affiliation, channel, roster).run();
    await audit(db, ex.id, actorOf(user), 'roster.add', { artistId: res.meta.last_row_id, channel, roster });
    return json({ ok: true, id: res.meta.last_row_id }, { status: 201 });
  }

  if (action === 'set') {
    const list = ids(b.ids);
    const set = {};
    if (b.channel !== undefined) set.channel = channelOf(b.channel);
    if (b.roster !== undefined) set.roster = rosterOf(b.roster);
    if (b.coordinator_id !== undefined) set.coordinator_id = await coordinatorOf(db, ex.id, b.coordinator_id);
    if (!list.length || !Object.keys(set).length) return json({ ok: true, updated: 0 });
    const cols = Object.keys(set);
    const stmts = list.map((id) => db.prepare(
      `UPDATE artists SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ? AND exhibition_id = ?`
    ).bind(...cols.map((c) => set[c]), id, ex.id));
    for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
    await audit(db, ex.id, actorOf(user), 'roster.set', { count: list.length, ...set });
    return json({ ok: true, updated: list.length });
  }

  if (action === 'number') {
    const { results } = await db.prepare(
      'SELECT id, name_th, name_en, nationality, roster, withdrawn, artist_no FROM artists WHERE exhibition_id = ?'
    ).bind(ex.id).all();
    const { plan, appended, skipped } = planNumbers(results || []);
    const stmts = plan.map((p) => db.prepare(
      "UPDATE artists SET artist_no = ?, updated_at = datetime('now') WHERE id = ? AND exhibition_id = ? AND artist_no IS NULL"
    ).bind(p.artist_no, p.id, ex.id));
    for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
    await audit(db, ex.id, actorOf(user), 'roster.number', { count: plan.length, appended });
    return json({ ok: true, numbered: plan.length, appended, skipped });
  }

  if (action === 'clear_numbers') {
    if (user.role !== 'admin') throw forbidden('ล้างเลขที่ทั้งหมดได้เฉพาะผู้ดูแลหอศิลป์');
    const r = await db.prepare("UPDATE artists SET artist_no = NULL, updated_at = datetime('now') WHERE exhibition_id = ? AND artist_no IS NOT NULL")
      .bind(ex.id).run();
    await audit(db, ex.id, actorOf(user), 'roster.clear_numbers', { count: r.meta.changes || 0 });
    return json({ ok: true, cleared: r.meta.changes || 0 });
  }

  // stage_all: the owner marks the works already sent (e.g. the 20th's committee samples) as selection round.
  const stage = v.oneOf(b.stage, STAGE_KEYS, { field: 'ประเภทผลงาน' });
  if (b.confirm !== ex.slug) throw bad('กรุณายืนยันด้วยรหัสนิทรรศการ');
  const r = await db.prepare("UPDATE works SET stage = ?, updated_at = datetime('now') WHERE exhibition_id = ? AND deleted_at IS NULL AND stage != ?")
    .bind(stage, ex.id, stage).run();
  await audit(db, ex.id, actorOf(user), 'roster.stage_all', { stage, count: r.meta.changes || 0 });
  return json({ ok: true, updated: r.meta.changes || 0 });
});
