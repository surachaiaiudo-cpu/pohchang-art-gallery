import { handle, json, readJson } from '../../_lib/http.js';
import { requireAdmin, actorOf } from '../../_lib/auth.js';
import { audit } from '../../_lib/exhibitions.js';
import { loadSite, normalizeSite, saveSite } from '../../_lib/site.js';

// GET /api/admin/site - current settings (never cached, for the admin form).
export const onRequestGet = handle(async (context) => {
  await requireAdmin(context);
  return json({ ok: true, site: await loadSite(context.env.DB) });
});

// PUT /api/admin/site { hero_title_th, ..., email, phone, facebook, ... } - replaces all settings.
export const onRequestPut = handle(async (context) => {
  const admin = await requireAdmin(context);
  const site = normalizeSite(await readJson(context.request));
  await saveSite(context.env.DB, site);
  await audit(context.env.DB, null, actorOf(admin), 'site.update', '');
  return json({ ok: true, site });
});
