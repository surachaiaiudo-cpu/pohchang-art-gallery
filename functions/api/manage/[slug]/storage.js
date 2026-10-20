import { handle, json, readJson, bad } from '../../../_lib/http.js';
import { actorOf } from '../../../_lib/auth.js';
import { requireManager, audit } from '../../../_lib/exhibitions.js';
import { encryptSecret } from '../../../_lib/crypto.js';
import { usage, usageFor } from '../../../_lib/storage.js';
import * as v from '../../../_lib/validate.js';

function summary(u) {
  if (!u) return null;
  const c = u.credits || {};
  return {
    plan: u.plan || '',
    creditsUsed: c.usage ?? null,
    creditsLimit: c.limit ?? null,
    creditsPercent: c.used_percent ?? null,
    storageBytes: (u.storage && u.storage.usage) || 0,
    bandwidthBytes: (u.bandwidth && u.bandwidth.usage) || 0,
    transformations: (u.transformations && u.transformations.usage) || 0
  };
}

// GET /api/manage/:slug/storage - Cloudinary account usage (credits are shared by everything in that account).
export const onRequestGet = handle(async (context) => {
  const { ex } = await requireManager(context);
  let u = null;
  try { u = await usageFor(ex, context.env); } catch { u = null; }
  return json({ ok: true, connected: !!ex.cloudinary_api_secret_enc, cloudName: ex.cloudinary_cloud_name, usage: summary(u) });
});

// PUT /api/manage/:slug/storage { cloud_name, api_key, api_secret }
// Values from the Cloudinary console (Settings > API Keys). Checked against Cloudinary, then the
// secret is stored encrypted and never sent back to the browser.
export const onRequestPut = handle(async (context) => {
  const { user, ex } = await requireManager(context);
  const { env } = context;
  const b = await readJson(context.request);
  const cloudName = v.text(b.cloud_name, { field: 'Cloud name', max: 100, required: true }).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,99}$/.test(cloudName)) throw bad('Cloud name ไม่ถูกต้อง');
  const apiKey = v.text(b.api_key, { field: 'API key', max: 40, required: true });
  if (!/^\d{6,30}$/.test(apiKey)) throw bad('API key ต้องเป็นตัวเลข');
  const apiSecret = v.text(b.api_secret, { field: 'API secret', max: 100, required: true });
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(apiSecret)) throw bad('API secret ไม่ถูกต้อง');
  let u = null;
  try { u = await usage(cloudName, apiKey, apiSecret, env); } catch { u = null; }
  if (!u) throw bad('Cloudinary ปฏิเสธกุญแจนี้ กรุณาตรวจ Cloud name, API key และ API secret');
  const enc = await encryptSecret(apiSecret, env.APP_ENCRYPTION_KEY);
  await env.DB.prepare(
    "UPDATE exhibitions SET cloudinary_cloud_name = ?, cloudinary_api_key = ?, cloudinary_api_secret_enc = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(cloudName, apiKey, enc, ex.id).run();
  await audit(env.DB, ex.id, actorOf(user), 'storage.set', cloudName);
  return json({ ok: true, usage: summary(u) });
});
