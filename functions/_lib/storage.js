// Image storage on Cloudinary. Each exhibition keeps its own cloud name + API key, and the
// API secret encrypted in D1 (several exhibitions may share one Cloudinary account).
// The secret never leaves the server: it signs short-lived browser uploads, verifies the
// signature Cloudinary returns after an upload, deletes files and reads the usage report.
import { decryptSecret, sha1Hex, timingSafeEqual } from './crypto.js';
import { HttpError, bad } from './http.js';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // Cloudinary free plan: 10 MB per image
export const MAX_PIXELS = 25e6;                   // and 25 megapixels
const FORMATS = ['jpg', 'png', 'webp'];

const isFake = (env) => env.DEV_FAKE_STORAGE === '1';
const api = (cloud, path) => `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}${path}`;

async function secretOf(ex, env) {
  if (!ex.cloudinary_api_secret_enc) throw new HttpError(409, 'นิทรรศการนี้ยังไม่ได้ตั้งค่า Cloudinary');
  try {
    return await decryptSecret(ex.cloudinary_api_secret_enc, env.APP_ENCRYPTION_KEY);
  } catch {
    throw new HttpError(500, 'ถอดรหัสกุญแจ Cloudinary ไม่ได้ (ตรวจ APP_ENCRYPTION_KEY)');
  }
}

// Cloudinary signature: SHA-1 of the sorted "key=value" pairs joined by "&", then the API secret.
export async function signParams(params, secret) {
  const s = Object.keys(params).filter((k) => params[k] !== undefined && params[k] !== '')
    .sort().map((k) => `${k}=${params[k]}`).join('&');
  return sha1Hex(s + secret);
}

export function folderFor(ex, kind) {
  const sub = { work: 'works', artist: 'artists', hero: 'site' }[kind];
  if (!sub) throw bad('ประเภทไฟล์ไม่ถูกต้อง');
  return `${ex.slug}/${sub}`;
}

// Everything the browser needs for one signed upload straight to Cloudinary (valid ~1 hour).
export async function uploadAuth(ex, env, kind) {
  const folder = folderFor(ex, kind);
  if (isFake(env)) return { fake: true, folder, maxBytes: MAX_UPLOAD_BYTES, maxPixels: MAX_PIXELS };
  const params = { allowed_formats: FORMATS.join(','), folder, timestamp: Math.floor(Date.now() / 1000) };
  return {
    cloudName: ex.cloudinary_cloud_name,
    apiKey: ex.cloudinary_api_key,
    ...params,
    signature: await signParams(params, await secretOf(ex, env)),
    maxBytes: MAX_UPLOAD_BYTES,
    maxPixels: MAX_PIXELS
  };
}

// The browser hands back what Cloudinary returned: { public_id, version, signature, format, bytes, width, height }.
// Cloudinary signs public_id + version with our secret, so a valid signature proves the upload is real.
export async function verifyUploadedFile(ex, env, file, kind) {
  const f = file && typeof file === 'object' ? file : {};
  const folder = folderFor(ex, kind);
  const publicId = String(f.public_id || '');
  if (!/^[A-Za-z0-9_\-/.]{3,255}$/.test(publicId) || publicId.includes('..')) throw bad('รหัสไฟล์ไม่ถูกต้อง');
  if (!publicId.startsWith(`${folder}/`)) throw bad('ไฟล์ไม่ได้อยู่ในโฟลเดอร์ของนิทรรศการนี้');
  const size = Number(f.bytes) || 0, width = Number(f.width) || 0, height = Number(f.height) || 0;
  if (isFake(env)) {
    return { fileId: publicId, url: `/api/dev/placeholder?seed=${encodeURIComponent(publicId)}`, size: size || 1200000, width: width || 1600, height: height || 1200 };
  }
  const version = String(f.version || '');
  if (!/^\d{1,12}$/.test(version)) throw bad('ข้อมูลไฟล์ไม่ครบ กรุณาอัปโหลดใหม่');
  const format = String(f.format || '').toLowerCase();
  if (!FORMATS.includes(format)) throw bad('ไฟล์ต้องเป็น JPG, PNG หรือ WebP');
  const expected = await sha1Hex(`public_id=${publicId}&version=${version}${await secretOf(ex, env)}`);
  if (!timingSafeEqual(String(f.signature || ''), expected)) throw bad('ยืนยันไฟล์ที่อัปโหลดไม่สำเร็จ กรุณาอัปโหลดใหม่');
  return {
    fileId: publicId,
    url: `https://res.cloudinary.com/${ex.cloudinary_cloud_name}/image/upload/v${version}/${publicId}.${format}`,
    size, width, height
  };
}

// Best effort: a failed delete is reported, never fatal.
export async function deleteFile(ex, env, publicId) {
  if (!publicId || isFake(env)) return { skipped: true };
  try {
    const params = { invalidate: 'true', public_id: publicId, timestamp: Math.floor(Date.now() / 1000) };
    const form = new FormData();
    for (const [k, v] of Object.entries(params)) form.append(k, String(v));
    form.append('api_key', ex.cloudinary_api_key);
    form.append('signature', await signParams(params, await secretOf(ex, env)));
    const res = await fetch(api(ex.cloudinary_cloud_name, '/image/destroy'), { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    return { ok: data.result === 'ok' || data.result === 'not found', result: data.result };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Account usage (also proves the credentials work). Uses the Admin API (500 calls/hour on free).
export async function usage(cloudName, apiKey, apiSecret, env) {
  if (isFake(env)) {
    return { plan: 'Free (dev)', credits: { usage: 1.2, limit: 25, used_percent: 4.8 }, storage: { usage: 1.2e9 }, bandwidth: { usage: 0 }, transformations: { usage: 120 } };
  }
  const res = await fetch(api(cloudName, '/usage'), { headers: { Authorization: 'Basic ' + btoa(`${apiKey}:${apiSecret}`) } });
  if (!res.ok) return null;
  return res.json();
}

export async function usageFor(ex, env) {
  if (!ex.cloudinary_api_secret_enc) return null;
  return usage(ex.cloudinary_cloud_name, ex.cloudinary_api_key, await secretOf(ex, env), env);
}
