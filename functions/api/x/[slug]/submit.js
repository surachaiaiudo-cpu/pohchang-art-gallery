import { handle, json, readJson, clientIp, bad, HttpError } from '../../../_lib/http.js';
import { loadPublicExhibition, submissionWindow, audit } from '../../../_lib/exhibitions.js';
import { verifyUploadedFile, deleteFile } from '../../../_lib/imagekit.js';
import { checkTicket } from '../../../_lib/ticket.js';
import { enforce } from '../../../_lib/ratelimit.js';
import * as v from '../../../_lib/validate.js';

// POST /api/x/:slug/submit { ticket, consent, artist: {...}, works: [{..., file_id}] }
export const onRequestPost = handle(async ({ request, env, params }) => {
  const db = env.DB;
  const ex = await loadPublicExhibition(db, params.slug);
  const win = submissionWindow(ex);
  if (!win.open) throw new HttpError(409, win.reason);
  const b = await readJson(request);
  await checkTicket(env, request, ex.slug, b.ticket);
  await enforce(db, `submit:${clientIp(request)}`, { limit: 10, windowSec: 3600 });
  if (b.consent !== true) throw bad('กรุณายืนยันการยินยอมให้เผยแพร่ผลงาน');

  const a = b.artist && typeof b.artist === 'object' ? b.artist : {};
  const artist = {
    name_th: v.text(a.name_th, { field: 'ชื่อ-นามสกุล', max: 200, required: true }),
    name_en: v.text(a.name_en, { field: 'ชื่อภาษาอังกฤษ', max: 200 }),
    academic_title_th: v.text(a.academic_title_th, { field: 'ตำแหน่งทางวิชาการ', max: 200 }),
    email: v.email(a.email, { required: true }),
    phone: v.text(a.phone, { field: 'โทรศัพท์', max: 40 }),
    nationality: v.text(a.nationality, { field: 'สัญชาติ', max: 80 }) || 'Thailand',
    affiliation: v.text(a.affiliation, { field: 'สังกัด', max: 300 }),
    bio_th: v.longText(a.bio_th, { field: 'ประวัติ', max: 6000 }),
    bio_en: v.longText(a.bio_en, { field: 'ประวัติภาษาอังกฤษ', max: 6000 })
  };
  const list = Array.isArray(b.works) ? b.works : [];
  if (!list.length) throw bad('กรุณาเพิ่มผลงานอย่างน้อย 1 ชิ้น');
  if (list.length > ex.max_works_per_artist) throw bad(`ส่งได้ไม่เกิน ${ex.max_works_per_artist} ผลงาน`);
  const works = list.map((w, i) => ({
    title_th: v.text(w.title_th, { field: `ชื่อผลงานชิ้นที่ ${i + 1}`, max: 300, required: true }),
    title_en: v.text(w.title_en, { field: 'ชื่อผลงานภาษาอังกฤษ', max: 300 }),
    technique_th: v.text(w.technique_th, { field: 'เทคนิค', max: 300, required: true }),
    dimensions: v.text(w.dimensions, { field: 'ขนาด', max: 120 }),
    year_created: v.text(w.year_created, { field: 'ปีที่สร้าง', max: 20 }),
    concept_th: v.longText(w.concept_th, { field: 'แนวคิด', max: 4000 }),
    concept_en: v.longText(w.concept_en, { field: 'แนวคิดภาษาอังกฤษ', max: 4000 }),
    file_id: w.file_id
  }));

  // Respect the per-artist limit across several submissions with the same email.
  const prior = await db.prepare(
    `SELECT a.id, (SELECT COUNT(*) FROM works w WHERE w.artist_id = a.id AND w.deleted_at IS NULL) AS n
       FROM artists a WHERE a.exhibition_id = ? AND a.email = ? ORDER BY a.id LIMIT 1`
  ).bind(ex.id, artist.email).first();
  if (prior && prior.n + works.length > ex.max_works_per_artist) {
    throw bad(`อีเมลนี้ส่งผลงานไว้แล้ว ${prior.n} ชิ้น (สูงสุด ${ex.max_works_per_artist} ชิ้น)`);
  }

  const ids = works.map((w) => String(w.file_id || ''));
  if (new Set(ids).size !== ids.length) throw bad('มีรูปผลงานซ้ำกัน กรุณาใช้รูปแยกสำหรับแต่ละผลงาน');
  const reused = await db.prepare(
    `SELECT 1 FROM works WHERE exhibition_id = ? AND image_file_id IN (${ids.map(() => '?').join(',')}) LIMIT 1`
  ).bind(ex.id, ...ids).first();
  if (reused) throw bad('รูปนี้ถูกใช้ส่งผลงานไปแล้ว กรุณาอัปโหลดใหม่');

  // Confirm every image really sits in this exhibition's ImageKit folder.
  const files = [];
  for (const w of works) files.push(await verifyUploadedFile(ex, env, w.file_id, 'work'));
  let avatar = null;
  if (a.avatar_file_id) avatar = await verifyUploadedFile(ex, env, a.avatar_file_id, 'artist');
  const added = files.reduce((s, f) => s + f.size, 0) + (avatar ? avatar.size : 0);
  if (ex.storage_bytes + added > ex.storage_quota_bytes) {
    for (const f of files) await deleteFile(ex, env, f.fileId);
    if (avatar) await deleteFile(ex, env, avatar.fileId);
    throw new HttpError(507, 'พื้นที่เก็บรูปของนิทรรศการนี้เต็มแล้ว กรุณาติดต่อผู้จัด');
  }

  let artistId = prior ? prior.id : null;
  if (!artistId) {
    const res = await db.prepare(
      `INSERT INTO artists (exhibition_id, name_th, name_en, academic_title_th, email, phone, nationality, affiliation, bio_th, bio_en, avatar_url, avatar_file_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(ex.id, artist.name_th, artist.name_en, artist.academic_title_th, artist.email, artist.phone, artist.nationality,
      artist.affiliation, artist.bio_th, artist.bio_en, avatar ? avatar.url : '', avatar ? avatar.fileId : '').run();
    artistId = res.meta.last_row_id;
  }
  const order = await db.prepare('SELECT COALESCE(MAX(display_order), 0) AS m FROM works WHERE exhibition_id = ?').bind(ex.id).first();
  const stmts = works.map((w, i) => db.prepare(
    `INSERT INTO works (exhibition_id, artist_id, title_th, title_en, technique_th, dimensions, year_created, concept_th, concept_en,
                        image_url, image_file_id, image_width, image_height, image_bytes, display_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(ex.id, artistId, w.title_th, w.title_en, w.technique_th, w.dimensions, w.year_created, w.concept_th, w.concept_en,
    files[i].url, files[i].fileId, files[i].width, files[i].height, files[i].size, order.m + 10 * (i + 1)));
  stmts.push(db.prepare('UPDATE exhibitions SET storage_bytes = storage_bytes + ? WHERE id = ?').bind(added, ex.id));
  await db.batch(stmts);
  await audit(db, ex.id, 'public', 'submission', { artistId, works: works.length });
  return json({ ok: true, received: works.length, name: artist.name_th }, { status: 201 });
});
