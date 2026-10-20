import { handle, json, readJson, bad } from '../../../_lib/http.js';
import { actorOf } from '../../../_lib/auth.js';
import { requireManager, hasStorage, audit } from '../../../_lib/exhibitions.js';
import { encryptSecret } from '../../../_lib/crypto.js';
import { usage, usageFor, checkUploadPreset } from '../../../_lib/storage.js';
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

// GET /api/manage/:slug/storage - Cloudinary account status and optional usage report.
export const onRequestGet = handle(async (context) => {
  const { ex } = await requireManager(context);
  let u = null;
  try { u = await usageFor(ex, context.env); } catch { u = null; }
  let warning = '';
  if (ex.cloudinary_cloud_name && ex.cloudinary_upload_preset && !ex.cloudinary_api_secret_enc) {
    try {
      const check = await checkUploadPreset(ex.cloudinary_cloud_name, ex.cloudinary_upload_preset, context.env);
      warning = check.warning || '';
    } catch { /* ignore */ }
  }
  return json({
    ok: true,
    connected: hasStorage(ex),
    cloudName: ex.cloudinary_cloud_name,
    uploadPreset: ex.cloudinary_upload_preset || '',
    hasPrivateKey: !!ex.cloudinary_api_secret_enc,
    warning,
    usage: summary(u)
  });
});

// PUT /api/manage/:slug/storage { cloud_name, upload_preset?, api_key?, api_secret? }
export const onRequestPut = handle(async (context) => {
  const { user, ex } = await requireManager(context);
  const { env } = context;
  const b = await readJson(context.request);
  const cloudName = v.text(b.cloud_name, { field: 'Cloud name', max: 100, required: true }).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,99}$/.test(cloudName)) throw bad('Cloud name ไม่ถูกต้อง');

  const uploadPreset = v.text(b.upload_preset, { field: 'Upload preset', max: 100 });
  if (uploadPreset && !/^[A-Za-z0-9_-]{1,100}$/.test(uploadPreset)) throw bad('Upload preset ไม่ถูกต้อง');

  const apiKey = v.text(b.api_key, { field: 'API key', max: 40 });
  const apiSecret = v.text(b.api_secret, { field: 'API secret', max: 100 });

  if (!uploadPreset && !apiSecret && !ex.cloudinary_api_secret_enc) {
    throw bad('กรุณากรอก Upload preset (เช่น 20workshop) หรือกรอก API key + API secret');
  }

  let u = null;
  let enc = ex.cloudinary_api_secret_enc || '';
  let nextApiKey = apiKey || ex.cloudinary_api_key || '';
  if (apiKey || apiSecret) {
    if (!/^\d{6,30}$/.test(apiKey)) throw bad('API key ต้องเป็นตัวเลข');
    if (!/^[A-Za-z0-9_-]{10,100}$/.test(apiSecret)) throw bad('API secret ไม่ถูกต้อง');
    try { u = await usage(cloudName, apiKey, apiSecret, env); } catch { u = null; }
    if (!u) throw bad('Cloudinary ปฏิเสธกุญแจนี้ กรุณาตรวจ Cloud name, API key และ API secret');
    enc = await encryptSecret(apiSecret, env.APP_ENCRYPTION_KEY);
    nextApiKey = apiKey;
  }

  let warning = '';
  if (uploadPreset) {
    const check = await checkUploadPreset(cloudName, uploadPreset, env);
    warning = check.warning || '';
  }

  await env.DB.prepare(
    "UPDATE exhibitions SET cloudinary_cloud_name = ?, cloudinary_upload_preset = ?, cloudinary_api_key = ?, cloudinary_api_secret_enc = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(cloudName, uploadPreset, nextApiKey, enc, ex.id).run();
  await audit(env.DB, ex.id, actorOf(user), 'storage.set', { cloudName, uploadPreset });
  return json({ ok: true, warning, usage: summary(u) });
});
