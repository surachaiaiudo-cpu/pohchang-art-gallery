// Exhibition catalogue (สูจิบัตร) on the server: template lookup and the data a catalogue page needs.
// Templates are shared by every exhibition: built-in ones live in public/js/catalog-core.js, the ones
// made by admins and exhibition staff in catalog_templates. A catalogue refers to one as
// "b:<key>" (built-in) or "t:<id>" (made in the back office).
import { notFound } from './http.js';
import { publicExhibition } from './exhibitions.js';
import { PUBLIC_WORK_SQL } from './public.js';
import { BUILTIN_TEMPLATES, builtinTemplate, normalizeLayout, parseSettings, DEFAULT_TEMPLATE } from '../../public/js/catalog-core.js';

export function parseLayout(text) {
  try { return normalizeLayout(JSON.parse(text || '{}')); } catch { return normalizeLayout({}); }
}

export async function templateRow(db, id) {
  return db.prepare(
    `SELECT t.id, t.name, t.description, t.layout, t.created_by, t.created_at, t.updated_at, u.name AS author
       FROM catalog_templates t LEFT JOIN users u ON u.id = t.created_by WHERE t.id = ?`
  ).bind(id).first();
}

// Resolves a template reference; an unknown or deleted one falls back to the default built-in.
export async function resolveTemplate(db, ref) {
  const m = /^t:(\d+)$/.exec(ref || '');
  if (m) {
    const row = await templateRow(db, Number(m[1]));
    if (row) return { ref, name: row.name, layout: parseLayout(row.layout), missing: false };
  }
  const b = builtinTemplate(ref);
  if (b) return { ref: b.ref, name: b.name, layout: normalizeLayout(b.layout), missing: false };
  const d = builtinTemplate(DEFAULT_TEMPLATE);
  return { ref: d.ref, name: d.name, layout: normalizeLayout(d.layout), missing: !!ref };
}

// Every template a back-office user may choose: built-in first, then the shared ones (newest first).
export async function templateList(db) {
  const { results } = await db.prepare(
    `SELECT t.id, t.name, t.description, t.created_by, t.updated_at, u.name AS author
       FROM catalog_templates t LEFT JOIN users u ON u.id = t.created_by ORDER BY t.updated_at DESC, t.id DESC`
  ).all();
  return [
    ...BUILTIN_TEMPLATES.map((t) => ({ ref: t.ref, name: t.name, description: t.description, builtin: true })),
    ...(results || []).map((t) => ({ ref: `t:${t.id}`, id: t.id, name: t.name, description: t.description,
      builtin: false, created_by: t.created_by, author: t.author || '', updated_at: t.updated_at }))
  ];
}

// The whole book: exhibition (public fields), settings, template layout, works and the expert panel.
// Only shown works; reviewers only with the fields the curator chose (never email or link).
export async function catalogPayload(db, ex) {
  const settings = parseSettings(ex.catalog);
  const template = await resolveTemplate(db, settings.template);
  const { results: works } = await db.prepare(`${PUBLIC_WORK_SQL} ORDER BY w.display_order, w.id`).bind(ex.id).all();
  let reviewers = [];
  if (settings.sections.committee) {
    const { results } = await db.prepare('SELECT name, title FROM reviewers WHERE exhibition_id = ? AND active = 1 ORDER BY id').bind(ex.id).all();
    reviewers = (results || []).map((r) => ({
      name: settings.reviewerFields.name ? r.name : '',
      title: settings.reviewerFields.title ? r.title : ''
    })).filter((r) => r.name || r.title);
  }
  // Data the curator switched off is not sent at all.
  const f = settings.fields;
  const clean = (works || []).map((w) => {
    const o = { ...w };
    if (!f.price) o.price = '';
    if (!f.concept) { o.concept_th = ''; o.concept_en = ''; o.concept_zh = ''; }
    if (!f.bio) { o.bio_th = ''; o.bio_en = ''; o.bio_zh = ''; }
    if (!f.affiliation) o.affiliation = '';
    if (!f.avatar) o.avatar_url = '';
    return o;
  });
  return {
    exhibition: publicExhibition(ex),
    settings,
    template: { ref: template.ref, name: template.name, layout: template.layout, missing: template.missing },
    works: clean,
    reviewers,
    // Uploaded cover page (one image for the whole A4 cover); empty = a simple cover made from the texts.
    cover: { url: ex.catalog_cover_url || '', width: ex.catalog_cover_width || 0, height: ex.catalog_cover_height || 0 },
    published_at: ex.catalog_published_at || null
  };
}

export function requirePublished(ex) {
  if (!ex.catalog_published_at) throw notFound('นิทรรศการนี้ยังไม่ได้เผยแพร่สูจิบัตร');
}
