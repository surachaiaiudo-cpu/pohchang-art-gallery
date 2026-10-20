import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { signParams, verifyUploadedFile, folderFor } from '../functions/_lib/storage.js';
import { encryptSecret } from '../functions/_lib/crypto.js';

const sha1 = (s) => createHash('sha1').update(s).digest('hex');
const SECRET = 'abcdEFGH1234secret';
const env = { APP_ENCRYPTION_KEY: 'test-encryption-key-0123456789' };

test('upload signature matches the Cloudinary recipe (sorted params + secret, SHA-1)', async () => {
  const sig = await signParams({ timestamp: 1700000000, folder: 'poh-chang-20/works', allowed_formats: 'jpg,png,webp' }, SECRET);
  assert.equal(sig, sha1(`allowed_formats=jpg,png,webp&folder=poh-chang-20/works&timestamp=1700000000${SECRET}`));
});

test('an upload is accepted only with a valid Cloudinary response signature in the right folder', async () => {
  const ex = { slug: 'poh-chang-20', cloudinary_cloud_name: 'demo', cloudinary_api_key: '123456',
    cloudinary_api_secret_enc: await encryptSecret(SECRET, env.APP_ENCRYPTION_KEY) };
  const public_id = `${folderFor(ex, 'work')}/abc123`;
  const good = { public_id, version: '1712345678', format: 'jpg', bytes: 2048, width: 4000, height: 3000,
    signature: sha1(`public_id=${public_id}&version=1712345678${SECRET}`) };
  const f = await verifyUploadedFile(ex, env, good, 'work');
  assert.equal(f.url, `https://res.cloudinary.com/demo/image/upload/v1712345678/${public_id}.jpg`);
  assert.equal(f.size, 2048);
  await assert.rejects(verifyUploadedFile(ex, env, { ...good, signature: 'x'.repeat(40) }, 'work'));
  await assert.rejects(verifyUploadedFile(ex, env, { ...good, version: '1712345679' }, 'work'));
  await assert.rejects(verifyUploadedFile(ex, env, { ...good, public_id: 'other-show/works/abc123' }, 'work'));
  await assert.rejects(verifyUploadedFile(ex, env, { ...good, format: 'svg' }, 'work'));
});
