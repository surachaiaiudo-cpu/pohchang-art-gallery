import { handle, json, readJson, bad, forbidden, notFound } from '../../_lib/http.js';
import { requireUser, actorOf } from '../../_lib/auth.js';
import { audit } from '../../_lib/exhibitions.js';
import { templateRow, parseLayout } from '../../_lib/catalog.js';
import { normalizeLayout, builtinTemplate } from '../../../public/js/catalog-core.js';
import * as v from '../../_lib/validate.js';

// :id is a number (shared template) or a built-in key such as "b-classic" (read only).
async function load(context) {
  const raw = String(context.params.id || '');
  const b = /^b-([a-z0-9-]{1,30})$/.exec(raw);
  if (b) {
    const t = builtinTemplate(`b:${b[1]}`);
    if (!t) throw notFound('ไม่พบเทมเพลต');
    return { builtin: true, ref: t.ref, name: t.name, description: t.description, layout: normalizeLayout(t.layout) };
  }
  if (!/^\d{1,9}$/.test(raw)) throw notFound('ไม่พบเทมเพลต');
  const row = await templateRow(context.env.DB, Number(raw));
  if (!row) throw notFound('ไม่พบเทมเพลต');
  return { builtin: false, ref: `t:${row.id}`, id: row.id, name: row.name, description: row.description,
    layout: parseLayout(row.layout), created_by: row.created_by, author: row.author || '', updated_at: row.updated_at };
}

const mayEdit = (user, t) => !t.builtin && (user.role === 'admin' || t.created_by === user.id);

// Exhibitions whose catalogue uses this template.
async function usedBy(db, ref) {
  const { results } = await db.prepare(
    "SELECT slug, title_th FROM exhibitions WHERE catalog != '' AND json_valid(catalog) AND json_extract(catalog, '$.template') = ?"
  ).bind(ref).all();
  return results || [];
}

// GET /api/catalog-templates/:id
export const onRequestGet = handle(async (context) => {
  const user = await requireUser(context);
  const t = await load(context);
  return json({ ok: true, template: { ...t, can_edit: mayEdit(user, t), used_by: t.builtin ? [] : await usedBy(context.env.DB, t.ref) } });
});

// PUT /api/catalog-templates/:id { name?, description?, layout? }
export const onRequestPut = handle(async (context) => {
  const user = await requireUser(context);
  const t = await load(context);
  if (t.builtin) throw bad('เทมเพลตหลักของระบบแก้ไขไม่ได้ กรุณาคัดลอกเป็นแบบของคุณก่อน');
  if (!mayEdit(user, t)) throw forbidden('แก้ไขได้เฉพาะผู้สร้างเทมเพลตและผู้ดูแลหอศิลป์ คัดลอกเป็นแบบของคุณแทนได้');
  const b = await readJson(context.request);
  const set = {};
  if (b.name !== undefined) set.name = v.text(b.name, { field: 'ชื่อเทมเพลต', max: 120, required: true });
  if (b.description !== undefined) set.description = v.text(b.description, { field: 'คำอธิบาย', max: 400 });
  if (b.layout !== undefined) set.layout = JSON.stringify(normalizeLayout(b.layout));
  const keys = Object.keys(set);
  if (!keys.length) return json({ ok: true });
  await context.env.DB.prepare(`UPDATE catalog_templates SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...keys.map((k) => set[k]), t.id).run();
  await audit(context.env.DB, null, actorOf(user), 'catalog_template.update', `${t.id}:${keys.join(',')}`);
  return json({ ok: true });
});

// DELETE /api/catalog-templates/:id - refused while an exhibition's catalogue still uses it.
export const onRequestDelete = handle(async (context) => {
  const user = await requireUser(context);
  const t = await load(context);
  if (t.builtin) throw bad('ลบเทมเพลตหลักของระบบไม่ได้');
  if (!mayEdit(user, t)) throw forbidden('ลบได้เฉพาะผู้สร้างเทมเพลตและผู้ดูแลหอศิลป์');
  const used = await usedBy(context.env.DB, t.ref);
  if (used.length) throw bad(`ยังมีนิทรรศการใช้เทมเพลตนี้อยู่: ${used.map((e) => e.title_th).join(', ')} กรุณาเปลี่ยนเทมเพลตของนิทรรศการเหล่านั้นก่อน`);
  await context.env.DB.prepare('DELETE FROM catalog_templates WHERE id = ?').bind(t.id).run();
  await audit(context.env.DB, null, actorOf(user), 'catalog_template.delete', String(t.id));
  return json({ ok: true });
});
