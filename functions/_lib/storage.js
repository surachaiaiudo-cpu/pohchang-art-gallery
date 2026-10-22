// Image storage on Cloudinary. Each exhibition keeps its own cloud name + upload preset (unsigned)
// or API key + encrypted API secret in D1 (several exhibitions may share one Cloudinary account).
import { decryptSecret, sha1Hex, timingSafeEqual } from './crypto.js';
import { HttpError, bad } from './http.js';

export const DEFAULT_CLOUD_NAME = 'uukpgvmz';
export const DEFAULT_UPLOAD_PRESET = '20workshop';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // Cloudinary free plan: 10 MB per image
export const MAX_PIXELS = 25e6;                   // and 25 megapixels
const FORMATS = ['jpg', 'jpeg', 'png', 'webp'];

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
  const sub = { work: 'works', artist: 'artists', hero: 'site', catalog: 'catalog' }[kind];
  if (!sub) throw bad('ประเภทไฟล์ไม่ถูกต้อง');
  return `${ex.slug}/${sub}`;
}

// Everything the browser needs for one direct upload straight to Cloudinary.
// Uses signed upload when API secret is configured, or unsigned upload_preset otherwise.
export async function uploadAuth(ex, env, kind) {
  const folder = folderFor(ex, kind);
  if (isFake(env)) return { fake: true, folder, maxBytes: MAX_UPLOAD_BYTES, maxPixels: MAX_PIXELS };
  const cloudName = ex.cloudinary_cloud_name || DEFAULT_CLOUD_NAME;
  if (ex.cloudinary_api_secret_enc && ex.cloudinary_api_key) {
    const params = { allowed_formats: 'jpg,png,webp', folder, timestamp: Math.floor(Date.now() / 1000) };
    return {
      cloudName,
      apiKey: ex.cloudinary_api_key,
      ...params,
      signature: await signParams(params, await secretOf(ex, env)),
      maxBytes: MAX_UPLOAD_BYTES,
      maxPixels: MAX_PIXELS
    };
  }
  const uploadPreset = ex.cloudinary_upload_preset || DEFAULT_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new HttpError(409, 'นิทรรศการนี้ยังไม่ได้ตั้งค่า Cloudinary');
  return {
    cloudName,
    uploadPreset,
    folder,
    maxBytes: MAX_UPLOAD_BYTES,
    maxPixels: MAX_PIXELS
  };
}

// The browser hands back what Cloudinary returned: { public_id, version, signature, format, bytes, width, height }.
export async function verifyUploadedFile(ex, env, file, kind) {
  const f = file && typeof file === 'object' ? file : {};
  const folder = folderFor(ex, kind);
  const publicId = String(f.public_id || '');
  if (!/^[A-Za-z0-9_\-/.]{1,255}$/.test(publicId) || publicId.includes('..')) throw bad('รหัสไฟล์ไม่ถูกต้อง');
  const size = Number(f.bytes) || 0, width = Number(f.width) || 0, height = Number(f.height) || 0;
  if (isFake(env)) {
    if (!publicId.startsWith(`${folder}/`)) throw bad('ไฟล์ไม่ได้อยู่ในโฟลเดอร์ของนิทรรศการนี้');
    return { fileId: publicId, url: `/api/dev/placeholder?seed=${encodeURIComponent(publicId)}`, size: size || 1200000, width: width || 1600, height: height || 1200 };
  }
  const version = String(f.version || '');
  if (!/^\d{1,12}$/.test(version)) throw bad('ข้อมูลไฟล์ไม่ครบ กรุณาอัปโหลดใหม่');
  const rawFormat = String(f.format || '').toLowerCase();
  if (!FORMATS.includes(rawFormat)) throw bad('ไฟล์ต้องเป็น JPG, PNG หรือ WebP');
  const format = rawFormat === 'jpeg' ? 'jpg' : rawFormat;
  const cloudName = ex.cloudinary_cloud_name || DEFAULT_CLOUD_NAME;

  const url = `https://res.cloudinary.com/${cloudName}/image/upload/v${version}/${publicId}.${format}`;
  if (ex.cloudinary_api_secret_enc) {
    if (!publicId.startsWith(`${folder}/`)) throw bad('ไฟล์ไม่ได้อยู่ในโฟลเดอร์ของนิทรรศการนี้');
    const expected = await sha1Hex(`public_id=${publicId}&version=${version}${await secretOf(ex, env)}`);
    if (!timingSafeEqual(String(f.signature || ''), expected)) throw bad('ยืนยันไฟล์ที่อัปโหลดไม่สำเร็จ กรุณาอัปโหลดใหม่');
    return { fileId: publicId, url, size, width, height };
  }
  // Unsigned preset: there is no signature we can check, so at least make sure the file really
  // exists in this Cloudinary account and record its real size. With fixed folders the public_id
  // carries the folder, which must then be this exhibition's; with dynamic folders it has none.
  if (publicId.includes('/') && !publicId.startsWith(`${folder}/`)) throw bad('ไฟล์ไม่ได้อยู่ในโฟลเดอร์ของนิทรรศการนี้');
  let res;
  try { res = await fetch(url, { method: 'HEAD' }); } catch { res = null; }
  if (!res || !res.ok) throw bad('ไม่พบไฟล์ที่อัปโหลดใน Cloudinary กรุณาอัปโหลดใหม่');
  const real = Number(res.headers.get('content-length')) || 0;
  return { fileId: publicId, url, size: real || size, width, height };
}

// Best effort: a failed delete is reported, never fatal.
export async function deleteFile(ex, env, publicId) {
  if (!publicId || isFake(env) || !ex.cloudinary_api_secret_enc || !ex.cloudinary_api_key) return { skipped: true };
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

// Probe Cloudinary with cloud_name + upload_preset (no file) to verify both exist and check unsigned status.
export async function checkUploadPreset(cloudName, uploadPreset, env) {
  if (isFake(env)) return { unsignedReady: true, warning: '' };
  try {
    const form = new FormData();
    form.append('upload_preset', uploadPreset);
    const res = await fetch(api(cloudName, '/image/upload'), { method: 'POST', body: form });
    const cldErr = (res.headers.get('x-cld-error') || '').toLowerCase();
    if (cldErr.includes('unknown api key') || cldErr.includes('invalid cloud_name')) {
      throw bad(`ไม่พบ Cloud name "${cloudName}" ใน Cloudinary`);
    }
    if (cldErr.includes('upload preset not found')) {
      throw bad(`ไม่พบ Upload preset "${uploadPreset}" ในบัญชี ${cloudName}`);
    }
    if (cldErr.includes('whitelisted for unsigned')) {
      return {
        unsignedReady: false,
        warning: `พบ Upload preset "${uploadPreset}" แล้ว แต่ใน Cloudinary ยังตั้งเป็น Signed — กรุณาไปที่ Cloudinary Console → Settings → Upload → Upload presets → "${uploadPreset}" แล้วเปลี่ยน Signing Mode เป็น Unsigned เพื่อให้ผู้ส่งผลงานอัปโหลดได้โดยไม่ต้องใช้ API Secret`
      };
    }
    return { unsignedReady: true, warning: '' };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    return { unsignedReady: true, warning: '' };
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
  if (!ex.cloudinary_api_secret_enc || !ex.cloudinary_api_key) return null;
  return usage(ex.cloudinary_cloud_name, ex.cloudinary_api_key, await secretOf(ex, env), env);
}
