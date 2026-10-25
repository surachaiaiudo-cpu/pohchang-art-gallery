import { handle, json, readJson } from '../../../_lib/http.js';
import { actorOf } from '../../../_lib/auth.js';
import { requireManager, audit } from '../../../_lib/exhibitions.js';
import { normalizeCaptionSettings } from '../../../../public/js/caption-text.js';

// PUT /api/manage/:slug/caption-settings { settings } - caption design shared by the exhibition's team.
export const onRequestPut = handle(async (context) => {
  const { user, ex } = await requireManager(context);
  const b = await readJson(context.request);
  const settings = normalizeCaptionSettings(b.settings);
  const value = JSON.stringify(settings);
  await context.env.DB.prepare("UPDATE exhibitions SET caption_settings = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(value, ex.id).run();
  if (value !== ex.caption_settings) await audit(context.env.DB, ex.id, actorOf(user), 'caption_settings.set', settings.template);
  return json({ ok: true, settings });
});
