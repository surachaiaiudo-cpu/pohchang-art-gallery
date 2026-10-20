import { handle, json, readJson, bad } from '../../../_lib/http.js';
import { actorOf } from '../../../_lib/auth.js';
import { requireManager, audit, parseOverrides, submissionWindow } from '../../../_lib/exhibitions.js';
import { PRESETS, HEADING_FONTS, ORNAMENTS } from '../../../_lib/themes.js';
import { recompute, reviewOpen } from '../../../_lib/review.js';
import * as v from '../../../_lib/validate.js';

function managerView(ex) {
  const { imagekit_private_enc, ...rest } = ex;
  return {
    ...rest,
    theme_overrides: parseOverrides(ex),
    has_private_key: !!imagekit_private_enc,
    submission: submissionWindow(ex),
    review_is_open: reviewOpen(ex)
  };
}

// GET /api/manage/:slug - settings and counters for the exhibition dashboard.
export const onRequestGet = handle(async (context) => {
  const { ex } = await requireManager(context);
  const db = context.env.DB;
  const [counts, reviewers] = await db.batch([
    db.prepare(
      `SELECT status, COUNT(*) AS n, SUM(endorsed) AS endorsed FROM works
        WHERE exhibition_id = ? AND deleted_at IS NULL GROUP BY status`
    ).bind(ex.id),
    db.prepare('SELECT COUNT(*) AS n FROM reviewers WHERE exhibition_id = ? AND active = 1').bind(ex.id)
  ]);
  const c = { submitted: 0, shown: 0, rejected: 0, endorsed: 0 };
  for (const r of counts.results || []) {
    c[r.status] = r.n;
    if (r.status === 'shown') c.endorsed = r.endorsed || 0;
  }
  return json({ ok: true, exhibition: managerView(ex), counts: c, reviewers: reviewers.results[0].n, presets: PRESETS, headingFonts: HEADING_FONTS });
});

// PUT /api/manage/:slug - texts, dates, look and review settings. Only fields present are changed.
export const onRequestPut = handle(async (context) => {
  const { user, ex } = await requireManager(context);
  const db = context.env.DB;
  const b = await readJson(context.request);
  const set = {};
  const t = (k, opts) => { if (b[k] !== undefined) set[k] = v.text(b[k], opts); };
  const lt = (k, opts) => { if (b[k] !== undefined) set[k] = v.longText(b[k], opts); };

  t('title_th', { field: 'ชื่อนิทรรศการ', max: 200, required: true });
  t('title_en', { field: 'ชื่อภาษาอังกฤษ', max: 200 });
  t('subtitle_th', { field: 'คำโปรย', max: 300 });
  t('subtitle_en', { field: 'คำโปรยภาษาอังกฤษ', max: 300 });
  lt('statement_th', { field: 'บทภัณฑารักษ์' });
  lt('statement_en', { field: 'บทภัณฑารักษ์ภาษาอังกฤษ' });
  t('venue', { field: 'สถานที่', max: 300 });
  t('badge_label_th', { field: 'ข้อความ badge', max: 80, required: true });
  t('badge_label_en', { field: 'ข้อความ badge ภาษาอังกฤษ', max: 80 });
  if (b.status !== undefined) {
    // Staff may open/close their exhibition; archiving is for admins (admin endpoint).
    const allowed = user.role === 'admin' ? ['draft', 'open', 'closed', 'archived'] : ['draft', 'open', 'closed'];
    set.status = v.oneOf(b.status, allowed, { field: 'สถานะ' });
  }
  if (b.starts_on !== undefined) set.starts_on = v.dateOnly(b.starts_on, { field: 'วันเริ่มนิทรรศการ' });
  if (b.ends_on !== undefined) set.ends_on = v.dateOnly(b.ends_on, { field: 'วันสิ้นสุดนิทรรศการ' });
  if (b.submission_opens_at !== undefined) set.submission_opens_at = v.dateTime(b.submission_opens_at, { field: 'วันเปิดรับผลงาน' });
  if (b.submission_closes_at !== undefined) set.submission_closes_at = v.dateTime(b.submission_closes_at, { field: 'วันปิดรับผลงาน' });
  if (b.max_works_per_artist !== undefined) set.max_works_per_artist = v.int(b.max_works_per_artist, { field: 'จำนวนผลงานต่อคน', min: 1, max: 20 });
  if (b.theme_preset !== undefined) set.theme_preset = v.oneOf(b.theme_preset, Object.keys(PRESETS), { field: 'ธีม' });
  if (b.layout !== undefined) set.layout = v.oneOf(b.layout, ['grid', 'masonry', 'salon'], { field: 'รูปแบบการจัดวาง' });
  if (b.theme_overrides !== undefined) {
    const o = b.theme_overrides && typeof b.theme_overrides === 'object' ? b.theme_overrides : {};
    set.theme_overrides = JSON.stringify({
      accent: v.color(o.accent, { field: 'สีหลัก' }),
      headingFont: v.oneOf(o.headingFont || '', HEADING_FONTS, { field: 'ฟอนต์หัวเรื่อง' }),
      ornament: v.oneOf(o.ornament || 'light', ORNAMENTS, { field: 'ลวดลายประดับ' })
    });
  }
  let reviewChanged = false;
  if (b.review_open !== undefined) { set.review_open = b.review_open ? 1 : 0; }
  if (b.review_deadline !== undefined) set.review_deadline = v.dateTime(b.review_deadline, { field: 'วันปิดการพิจารณา' });
  if (b.review_blind !== undefined) set.review_blind = b.review_blind ? 1 : 0;
  if (b.review_panel_size !== undefined) { set.review_panel_size = v.int(b.review_panel_size, { field: 'จำนวนผู้ทรงคุณวุฒิ', min: 1, max: 15 }); reviewChanged = true; }
  if (b.review_threshold !== undefined) { set.review_threshold = v.int(b.review_threshold, { field: 'เกณฑ์ผ่าน', min: 1, max: 15 }); reviewChanged = true; }
  const panel = set.review_panel_size ?? ex.review_panel_size;
  const threshold = set.review_threshold ?? ex.review_threshold;
  if (threshold > panel) throw bad('เกณฑ์ผ่านต้องไม่มากกว่าจำนวนผู้ทรงคุณวุฒิ');
  const opens = set.submission_opens_at !== undefined ? set.submission_opens_at : ex.submission_opens_at;
  const closes = set.submission_closes_at !== undefined ? set.submission_closes_at : ex.submission_closes_at;
  if (opens && closes && Date.parse(opens) >= Date.parse(closes)) throw bad('วันปิดรับต้องอยู่หลังวันเปิดรับ');

  const keys = Object.keys(set);
  if (!keys.length) return json({ ok: true });
  await db.prepare(`UPDATE exhibitions SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...keys.map((k) => set[k]), ex.id).run();
  if (reviewChanged) {
    const fresh = await db.prepare('SELECT * FROM exhibitions WHERE id = ?').bind(ex.id).first();
    await recompute(db, fresh);
  }
  await audit(db, ex.id, actorOf(user), 'exhibition.update', keys.join(','));
  return json({ ok: true });
});
