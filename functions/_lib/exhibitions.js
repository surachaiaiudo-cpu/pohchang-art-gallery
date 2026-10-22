// Exhibition lookup and access control. Every exhibition-scoped endpoint goes through
// loadExhibition / requireManager so exhibition_id is always resolved in one place.
import { forbidden, notFound } from './http.js';
import { requireUser } from './auth.js';
import { parseCategories } from './categories.js';
import { parseTechniques } from './techniques.js';

export async function findBySlug(db, slug) {
  if (typeof slug !== 'string' || slug.length > 60) return null;
  let ex = await db.prepare('SELECT * FROM exhibitions WHERE slug = ?').bind(slug).first();
  if (!ex) {
    const r = await db.prepare(
      'SELECT e.* FROM slug_redirects r JOIN exhibitions e ON e.id = r.exhibition_id WHERE r.old_slug = ?'
    ).bind(slug).first();
    if (r) ex = { ...r, _redirectedFrom: slug };
  }
  return ex;
}

// Exhibition status (owner's model, 2026-10-21). The stored values are kept from the first schema
// because its CHECK constraint cannot be changed in place; what each one means now:
//   draft    = ร่าง  being prepared (imports go here); not public
//   open     = เปิด  on view, listed under "on view"; accepts work only inside its submission dates
//   archived = ปิด   finished, listed under past exhibitions; never accepts work
//   closed   = ซ่อน  hidden from the public (was shown before); never accepts work
// Accepting submissions is decided by the dates alone; there is no separate switch.
export const PUBLIC_STATUSES = ['open', 'archived'];
export const isPublic = (ex) => PUBLIC_STATUSES.includes(ex.status);

// Public view: drafts and hidden exhibitions are not found.
export async function loadPublicExhibition(db, slug) {
  const ex = await findBySlug(db, slug);
  if (!ex || !isPublic(ex)) throw notFound('ไม่พบนิทรรศการ');
  return ex;
}

export async function canManage(db, user, exhibitionId) {
  if (user.role === 'admin') return true;
  const m = await db.prepare('SELECT 1 FROM exhibition_members WHERE exhibition_id = ? AND user_id = ?')
    .bind(exhibitionId, user.id).first();
  return !!m;
}

// For /api/manage/:slug/* — returns { user, ex } or throws 401/403/404.
export async function requireManager(context) {
  const user = await requireUser(context);
  const ex = await findBySlug(context.env.DB, context.params.slug);
  if (!ex) throw notFound('ไม่พบนิทรรศการ');
  if (!(await canManage(context.env.DB, user, ex.id))) throw forbidden('คุณไม่ได้เป็นผู้ดูแลนิทรรศการนี้');
  return { user, ex };
}

export function hasStorage(ex) {
  return !!(ex.cloudinary_cloud_name && (ex.cloudinary_upload_preset || ex.cloudinary_api_secret_enc));
}

// phase: 'none' (no call for work), 'upcoming', 'open' or 'ended' - what the public pages show.
export function submissionWindow(ex, at = Date.now()) {
  if (ex.status !== 'open') return { open: false, phase: 'none', reason: 'นิทรรศการนี้ไม่ได้เปิดรับผลงาน' };
  if (!ex.submission_closes_at) return { open: false, phase: 'none', reason: 'ยังไม่ได้กำหนดวันปิดรับผลงาน' };
  if (at > Date.parse(ex.submission_closes_at)) return { open: false, phase: 'ended', reason: 'ปิดรับผลงานแล้ว' };
  if (ex.submission_opens_at && at < Date.parse(ex.submission_opens_at)) {
    return { open: false, phase: 'upcoming', reason: 'ยังไม่ถึงวันเปิดรับผลงาน' };
  }
  if (!hasStorage(ex)) return { open: false, phase: 'none', reason: 'นิทรรศการยังไม่ได้ตั้งค่าที่เก็บรูป' };
  return { open: true, phase: 'open', reason: '' };
}

export function parseOverrides(ex) {
  try {
    const o = JSON.parse(ex.theme_overrides || '{}');
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

// Fields safe to show anyone.
export function publicExhibition(ex) {
  return {
    slug: ex.slug,
    title_th: ex.title_th,
    title_en: ex.title_en,
    title_zh: ex.title_zh || '',
    subtitle_th: ex.subtitle_th,
    subtitle_en: ex.subtitle_en,
    subtitle_zh: ex.subtitle_zh || '',
    statement_th: ex.statement_th,
    statement_en: ex.statement_en,
    statement_zh: ex.statement_zh || '',
    venue: ex.venue,
    status: ex.status,
    starts_on: ex.starts_on,
    ends_on: ex.ends_on,
    submission_opens_at: ex.submission_opens_at,
    submission_closes_at: ex.submission_closes_at,
    max_works_per_artist: ex.max_works_per_artist,
    theme_preset: ex.theme_preset,
    // Home page card style: '' follows the theme (cardStyle() in public/js/presets.js).
    card_style: ex.card_style || '',
    layout: ex.layout,
    theme_overrides: parseOverrides(ex),
    hero_url: ex.hero_url,
    badge_label_th: ex.badge_label_th,
    badge_label_en: ex.badge_label_en,
    badge_label_zh: ex.badge_label_zh || '',
    review_threshold: ex.review_threshold,
    review_panel_size: ex.review_panel_size,
    categories: parseCategories(ex.categories),
    techniques: parseTechniques(ex.techniques),
    submission: submissionWindow(ex),
    // The catalogue page link shows only after the curator publishes it.
    catalog: !!ex.catalog_published_at
  };
}

export async function audit(db, exhibitionId, actor, action, detail = '') {
  await db.prepare('INSERT INTO audit_log (exhibition_id, actor, action, detail) VALUES (?, ?, ?, ?)')
    .bind(exhibitionId, actor, action, typeof detail === 'string' ? detail : JSON.stringify(detail)).run();
}
