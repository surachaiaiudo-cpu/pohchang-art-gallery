import { handle, json, readJson, clientIp, bad, notFound, HttpError } from '../../../../_lib/http.js';
import { audit } from '../../../../_lib/exhibitions.js';
import { verifyUploadedFile, deleteFile } from '../../../../_lib/storage.js';
import { checkTicket } from '../../../../_lib/ticket.js';
import { enforce } from '../../../../_lib/ratelimit.js';
import {
  loadAcceptExhibition, acceptWindow, parseReply, coreUpdate, parseJson, maskEmail, maskPhone,
  MIN_PHOTO_PIXELS, SIGNABLE
} from '../../../../_lib/acceptance.js';

async function signable(db, ex, id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) throw notFound('ไม่พบรายชื่อ');
  const a = await db.prepare(`SELECT * FROM artists WHERE id = ? AND exhibition_id = ? AND ${SIGNABLE}`).bind(n, ex.id).first();
  if (!a) throw notFound('ไม่พบรายชื่อ');
  return a;
}

// GET /api/x/:slug/accept/:id - what staff entered, to pre-fill the form.
// Email and phone are private: only a masked hint is sent ("so•••@gmail.com"); blank in the form = keep.
// A previous reply is never sent back (anyone can find the name), the form starts from the artist record.
export const onRequestGet = handle(async ({ env, params }) => {
  const ex = await loadAcceptExhibition(env.DB, params.slug);
  const win = acceptWindow(ex);
  if (!win.open) throw new HttpError(409, win.reason);
  const a = await signable(env.DB, ex, params.id);
  const done = await env.DB.prepare('SELECT updated_at FROM acceptances WHERE artist_id = ?').bind(a.id).first();
  return json({
    ok: true,
    artist: {
      id: a.id, name_th: a.name_th, name_en: a.name_en, nationality: a.nationality, affiliation: a.affiliation,
      photo: a.avatar_url || '', email_hint: maskEmail(a.email), phone_hint: maskPhone(a.phone),
      signed_at: done ? done.updated_at : ''
    }
  });
});

// POST /api/x/:slug/accept/:id { ticket, ...form, photo_file? } - sign (again, until closing: the new reply replaces the old).
export const onRequestPost = handle(async ({ request, env, params }) => {
  const db = env.DB;
  const ex = await loadAcceptExhibition(db, params.slug);
  const win = acceptWindow(ex);
  if (!win.open) throw new HttpError(409, win.reason);
  const b = await readJson(request);
  await checkTicket(env, request, `${ex.slug}#accept`, b.ticket);
  await enforce(db, `accept:${clientIp(request)}`, { limit: 60, windowSec: 3600 });
  const a = await signable(db, ex, params.id);
  const { core, data, signedName, filledBy } = parseReply(b, a);

  let photo = null;
  if (b.photo_file && b.photo_file.public_id) {
    photo = await verifyUploadedFile(ex, env, b.photo_file, 'artist');
    if (photo.width && photo.height && photo.width * photo.height < MIN_PHOTO_PIXELS) {
      await deleteFile(ex, env, photo.fileId);
      throw bad('รูปศิลปินต้องมีความละเอียดอย่างน้อย 5 ล้านพิกเซล (Photo must be at least 5 megapixels)', { photoSmall: true });
    }
    if (ex.storage_bytes + photo.size > ex.storage_quota_bytes) {
      await deleteFile(ex, env, photo.fileId);
      throw new HttpError(507, 'พื้นที่เก็บรูปของนิทรรศการนี้เต็มแล้ว กรุณาติดต่อผู้จัด');
    }
  } else if (!a.avatar_url) {
    throw bad('กรุณาแนบรูปศิลปิน (Please attach your photo)');
  }

  const { next, changes } = coreUpdate(a, core, photo ? photo.url : '');
  const prev = await db.prepare('SELECT before, changes, times FROM acceptances WHERE artist_id = ?').bind(a.id).first();
  const at = new Date().toISOString().slice(0, 19).replace('T', ' ');
  // Never show the private values in the change list; the staff page reads the current ones from the artist.
  const hide = (k, s) => (k === 'avatar_url' ? (s ? 'รูป' : '') : s);
  const log = [...parseJson(prev && prev.changes, []), ...changes.map((c) => ({ field: c.field, from: hide(c.field, c.from), to: hide(c.field, c.to), at }))].slice(-200);
  const before = prev ? prev.before : JSON.stringify(Object.fromEntries(
    ['name_th', 'name_en', 'email', 'phone', 'nationality', 'affiliation', 'avatar_url'].map((k) => [k, a[k] ?? ''])
  ));
  const stmts = [
    db.prepare(
      `UPDATE artists SET name_th = ?, name_en = ?, email = ?, phone = ?, nationality = ?, affiliation = ?,
              avatar_url = ?, avatar_file_id = ?, accepted_at = COALESCE(accepted_at, datetime('now')), accepted_by = ?,
              updated_at = datetime('now') WHERE id = ?`
    ).bind(next.name_th, next.name_en, next.email, next.phone, next.nationality, next.affiliation,
      next.avatar_url, photo ? photo.fileId : a.avatar_file_id, filledBy, a.id),
    db.prepare(
      `INSERT INTO acceptances (artist_id, exhibition_id, data, before, changes, signed_name, filled_by, times)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(artist_id) DO UPDATE SET data = excluded.data, changes = excluded.changes, signed_name = excluded.signed_name,
              filled_by = excluded.filled_by, times = acceptances.times + 1, updated_at = datetime('now')`
    ).bind(a.id, ex.id, JSON.stringify(data), before, JSON.stringify(log), signedName, filledBy)
  ];
  if (photo) stmts.push(db.prepare('UPDATE exhibitions SET storage_bytes = storage_bytes + ? WHERE id = ?').bind(photo.size, ex.id));
  await db.batch(stmts);
  await audit(db, ex.id, 'public', 'acceptance', { artistId: a.id, times: (prev ? prev.times : 0) + 1, changed: changes.map((c) => c.field) });
  return json({ ok: true, name: next.name_en || next.name_th, again: !!prev }, { status: 201 });
});
