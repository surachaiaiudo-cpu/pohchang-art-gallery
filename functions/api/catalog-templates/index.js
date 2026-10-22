import { handle, json, readJson, bad } from '../../_lib/http.js';
import { requireUser, actorOf } from '../../_lib/auth.js';
import { audit } from '../../_lib/exhibitions.js';
import { templateList, resolveTemplate } from '../../_lib/catalog.js';
import { normalizeLayout } from '../../../public/js/catalog-core.js';
import * as v from '../../_lib/validate.js';

// Catalogue templates are shared: every admin and exhibition staff member may use and copy any of them;
// changing or deleting one is for its author and admins.

// GET /api/catalog-templates - built-in and shared templates (no layouts).
export const onRequestGet = handle(async (context) => {
  const user = await requireUser(context);
  return json({ ok: true, templates: await templateList(context.env.DB), me: { id: user.id, role: user.role } });
});

// POST /api/catalog-templates { name, description?, from?: "b:classic" | "t:12", layout? } -> new template
export const onRequestPost = handle(async (context) => {
  const user = await requireUser(context);
  const db = context.env.DB;
  const b = await readJson(context.request);
  const name = v.text(b.name, { field: 'ชื่อเทมเพลต', max: 120, required: true });
  const description = v.text(b.description, { field: 'คำอธิบาย', max: 400 });
  let layout;
  if (b.layout !== undefined) layout = normalizeLayout(b.layout);
  else {
    const src = await resolveTemplate(db, typeof b.from === 'string' ? b.from : 'b:classic');
    if (b.from && src.ref !== b.from) throw bad('ไม่พบเทมเพลตต้นแบบ');
    layout = src.layout;
  }
  const count = await db.prepare('SELECT COUNT(*) AS n FROM catalog_templates').first();
  if (count.n >= 300) throw bad('มีเทมเพลตครบ 300 แบบแล้ว กรุณาลบแบบที่ไม่ใช้ก่อน');
  const res = await db.prepare('INSERT INTO catalog_templates (name, description, layout, created_by) VALUES (?, ?, ?, ?)')
    .bind(name, description, JSON.stringify(layout), user.id).run();
  const id = res.meta.last_row_id;
  await audit(db, null, actorOf(user), 'catalog_template.create', String(id));
  return json({ ok: true, id, ref: `t:${id}` });
});
