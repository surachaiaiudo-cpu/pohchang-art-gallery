import { handle, json, readJson, bad, HttpError } from '../../_lib/http.js';
import { requireAdmin, actorOf } from '../../_lib/auth.js';
import { audit } from '../../_lib/exhibitions.js';
import { DEFAULT_CLOUD_NAME, DEFAULT_UPLOAD_PRESET } from '../../_lib/storage.js';
import { PRESETS } from '../../_lib/themes.js';
import { CHUNK, sourceUrl, fetchConfig, fetchWorks, mapOldWork, artistKey, summarize } from '../../_lib/import-old.js';
import * as v from '../../_lib/validate.js';

// POST /api/admin/import - bring a past exhibition over from the old event sites. Admin only.
//   { step: 'preview', source }                                   -> what would be imported
//   { step: 'create', source, slug, title_th, title_en, theme_preset } -> new DRAFT exhibition
//   { step: 'chunk', source, exhibition_id, offset, imported }    -> imports the next CHUNK works
// Works are imported in small chunks so each request stays well inside the free-plan limits.
export const onRequestPost = handle(async (context) => {
  const admin = await requireAdmin(context);
  const db = context.env.DB;
  const b = await readJson(context.request);
  const source = sourceUrl(b.source, context.env);
  const step = v.oneOf(b.step, ['preview', 'create', 'chunk'], { field: 'ขั้นตอน' });

  if (step === 'preview') {
    const [cfg, list] = await Promise.all([fetchConfig(source), fetchWorks(source)]);
    return json({ ok: true, source, title: String(cfg.eventTitle || ''), summary: summarize(list) });
  }

  if (step === 'create') {
    const slug = v.slug(b.slug);
    const title_th = v.text(b.title_th, { field: 'ชื่อนิทรรศการ', max: 200, required: true });
    const title_en = v.text(b.title_en, { field: 'ชื่อภาษาอังกฤษ', max: 200 });
    const theme_preset = v.oneOf(b.theme_preset, Object.keys(PRESETS), { field: 'ธีม', fallback: 'heritage' });
    const taken = await db.prepare('SELECT 1 FROM exhibitions WHERE slug = ? UNION SELECT 1 FROM slug_redirects WHERE old_slug = ?')
      .bind(slug, slug).first();
    if (taken) throw bad('slug นี้ถูกใช้แล้ว');
    const list = await fetchWorks(source);
    // Draft: nobody outside sees it until an admin checks it and sets the status to "คลัง".
    // Old events had no categories; storage settings are the defaults (imported images stay on the old accounts).
    const res = await db.prepare(
      `INSERT INTO exhibitions (slug, title_th, title_en, theme_preset, status, categories, cloudinary_cloud_name, cloudinary_upload_preset)
       VALUES (?, ?, ?, ?, 'draft', '', ?, ?)`
    ).bind(slug, title_th, title_en, theme_preset, DEFAULT_CLOUD_NAME, DEFAULT_UPLOAD_PRESET).run();
    const id = res.meta.last_row_id;
    await audit(db, id, actorOf(admin), 'exhibition.import.start', { slug, source, works: list.length });
    return json({ ok: true, exhibition: { id, slug }, total: list.length, chunk: CHUNK }, { status: 201 });
  }

  // step === 'chunk'
  const exId = v.int(b.exhibition_id, { field: 'exhibition_id', min: 1 });
  const offset = v.int(b.offset, { field: 'offset', min: 0, max: 100000 });
  const imported = v.int(b.imported, { field: 'imported', min: 0, max: 100000 });
  const ex = await db.prepare('SELECT id, slug, status FROM exhibitions WHERE id = ?').bind(exId).first();
  if (!ex) throw bad('ไม่พบนิทรรศการปลายทาง');
  if (ex.status !== 'draft') throw bad('นำเข้าได้เฉพาะนิทรรศการที่ยังเป็นฉบับร่าง');
  // Guards against a chunk being sent twice (double click, retry after a timeout).
  const have = await db.prepare('SELECT COUNT(*) AS n FROM works WHERE exhibition_id = ?').bind(exId).first();
  if (have.n !== imported) throw new HttpError(409, `จำนวนผลงานในปลายทาง (${have.n}) ไม่ตรงกับที่นำเข้าแล้ว (${imported}) กรุณาตรวจก่อนนำเข้าต่อ`);

  const list = await fetchWorks(source, { limit: CHUNK, offset });
  const mapped = list.map(mapOldWork);
  const ok = mapped.filter((m) => !m.skip);
  const skipped = mapped.filter((m) => m.skip).map((m) => m.skip);

  if (ok.length) {
    const known = async () => {
      const { results } = await db.prepare('SELECT id, email, name_th FROM artists WHERE exhibition_id = ?').bind(exId).all();
      return new Map((results || []).map((a) => [artistKey({ email: a.email || '', name_th: a.name_th || '' }), a.id]));
    };
    let ids = await known();
    const fresh = [];
    const seen = new Set();
    for (const m of ok) {
      const k = artistKey(m.artist);
      if (!ids.has(k) && !seen.has(k)) { seen.add(k); fresh.push(m.artist); }
    }
    if (fresh.length) {
      await db.prepare(
        `INSERT INTO artists (exhibition_id, name_th, name_en, academic_title_th, academic_title_en, email, nationality, bio_th, bio_en, avatar_url)
         SELECT ?, json_extract(value, '$.name_th'), json_extract(value, '$.name_en'), json_extract(value, '$.academic_title_th'),
                json_extract(value, '$.academic_title_en'), json_extract(value, '$.email'), json_extract(value, '$.nationality'),
                json_extract(value, '$.bio_th'), json_extract(value, '$.bio_en'), json_extract(value, '$.avatar_url')
           FROM json_each(?)`
      ).bind(exId, JSON.stringify(fresh)).run();
      ids = await known();
    }
    // Keep the order the old site listed the works in.
    const rows = ok.map((m, i) => ({ ...m.work, artist_id: ids.get(artistKey(m.artist)), display_order: (offset + i + 1) * 10 }));
    await db.prepare(
      `INSERT INTO works (exhibition_id, artist_id, title_th, title_en, technique_th, technique_en, dimensions, year_created, price,
                          concept_th, concept_en, zone, image_url, display_order, status, created_at, updated_at)
       SELECT ?, json_extract(value, '$.artist_id'), json_extract(value, '$.title_th'), json_extract(value, '$.title_en'),
              json_extract(value, '$.technique_th'), json_extract(value, '$.technique_en'), json_extract(value, '$.dimensions'),
              json_extract(value, '$.year_created'), json_extract(value, '$.price'), json_extract(value, '$.concept_th'),
              json_extract(value, '$.concept_en'), json_extract(value, '$.zone'), json_extract(value, '$.image_url'),
              json_extract(value, '$.display_order'), 'shown',
              COALESCE(json_extract(value, '$.created_at'), datetime('now')), datetime('now')
         FROM json_each(?)`
    ).bind(exId, JSON.stringify(rows)).run();
  }
  const done = list.length < CHUNK;
  if (done) await audit(db, exId, actorOf(admin), 'exhibition.import.done', { source, works: imported + ok.length });
  return json({ ok: true, inserted: ok.length, skipped, next: offset + list.length, imported: imported + ok.length, done });
});
