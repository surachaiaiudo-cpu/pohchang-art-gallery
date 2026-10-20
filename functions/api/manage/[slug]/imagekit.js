import { handle, json, readJson, bad } from '../../../_lib/http.js';
import { actorOf } from '../../../_lib/auth.js';
import { requireManager, audit } from '../../../_lib/exhibitions.js';
import { encryptSecret } from '../../../_lib/crypto.js';
import { testCredentials } from '../../../_lib/imagekit.js';
import * as v from '../../../_lib/validate.js';

// PUT /api/manage/:slug/imagekit { url_endpoint, public_key, private_key }
// Keys come from the exhibition's own ImageKit account (Developer options). The private key is
// checked against ImageKit, then stored encrypted; it is never sent back to the browser.
export const onRequestPut = handle(async (context) => {
  const { user, ex } = await requireManager(context);
  const { env } = context;
  const b = await readJson(context.request);
  const urlEndpoint = v.httpsUrl(b.url_endpoint, { field: 'URL endpoint' }).replace(/\/+$/, '');
  if (!/^https:\/\/ik\.imagekit\.io\/[A-Za-z0-9_-]+$/.test(urlEndpoint)) {
    throw bad('URL endpoint ต้องมีรูปแบบ https://ik.imagekit.io/<ชื่อบัญชี>');
  }
  const publicKey = v.text(b.public_key, { field: 'Public key', max: 200, required: true });
  const privateKey = v.text(b.private_key, { field: 'Private key', max: 200, required: true });
  if (!publicKey.startsWith('public_') || !privateKey.startsWith('private_')) {
    throw bad('Public key ต้องขึ้นต้นด้วย public_ และ Private key ต้องขึ้นต้นด้วย private_');
  }
  let ok = false;
  try { ok = await testCredentials(urlEndpoint, publicKey, privateKey, env); } catch { ok = false; }
  if (!ok) throw bad('ImageKit ปฏิเสธกุญแจนี้ กรุณาตรวจ Private key อีกครั้ง');
  const enc = await encryptSecret(privateKey, env.APP_ENCRYPTION_KEY);
  await env.DB.prepare(
    "UPDATE exhibitions SET imagekit_url_endpoint = ?, imagekit_public_key = ?, imagekit_private_enc = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(urlEndpoint, publicKey, enc, ex.id).run();
  await audit(env.DB, ex.id, actorOf(user), 'imagekit.set', urlEndpoint);
  return json({ ok: true });
});
