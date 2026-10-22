import { handle, json, readJson, bad } from '../../../_lib/http.js';
import { actorOf } from '../../../_lib/auth.js';
import { requireManager, audit, isPublic } from '../../../_lib/exhibitions.js';
import { catalogPayload, templateList, resolveTemplate } from '../../../_lib/catalog.js';
import { normalizeSettings, parseSettings } from '../../../../public/js/catalog-core.js';

// GET /api/manage/:slug/catalog - settings, publish state and the template list.
// ?full=1 also returns the whole book (for the preview of an unpublished catalogue).
export const onRequestGet = handle(async (context) => {
  const { ex } = await requireManager(context);
  const db = context.env.DB;
  const full = new URL(context.request.url).searchParams.get('full') === '1';
  const base = {
    ok: true,
    settings: parseSettings(ex.catalog),
    saved: !!ex.catalog,
    published_at: ex.catalog_published_at || null,
    exhibition_public: isPublic(ex),
    templates: await templateList(db)
  };
  if (!full) return json(base);
  return json({ ...base, ...(await catalogPayload(db, ex)) });
});

// PUT /api/manage/:slug/catalog { settings?, publish?: true|false }
export const onRequestPut = handle(async (context) => {
  const { user, ex } = await requireManager(context);
  const db = context.env.DB;
  const b = await readJson(context.request);
  const set = {};
  if (b.settings !== undefined) {
    if (!b.settings || typeof b.settings !== 'object') throw bad('ข้อมูลการตั้งค่าสูจิบัตรไม่ถูกต้อง');
    const s = normalizeSettings(b.settings);
    const t = await resolveTemplate(db, s.template);
    if (t.ref !== s.template) throw bad('ไม่พบเทมเพลตที่เลือก อาจถูกลบไปแล้ว');
    set.catalog = JSON.stringify(s);
  }
  if (b.publish !== undefined) set.catalog_published_at = b.publish ? new Date().toISOString() : null;
  const keys = Object.keys(set);
  if (!keys.length) return json({ ok: true });
  await db.prepare(`UPDATE exhibitions SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...keys.map((k) => set[k]), ex.id).run();
  const action = b.publish === true ? 'catalog.publish' : b.publish === false ? 'catalog.unpublish' : 'catalog.update';
  await audit(db, ex.id, actorOf(user), action, keys.join(','));
  return json({ ok: true, published_at: b.publish !== undefined ? set.catalog_published_at : ex.catalog_published_at || null });
});
