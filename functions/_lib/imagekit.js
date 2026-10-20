// ImageKit: one free account per exhibition. The private key is stored encrypted in D1 and
// only ever used here, on the server: to sign short-lived browser uploads, to confirm that an
// uploaded file really exists in this exhibition's account, and to delete files.
import { decryptSecret, hmacSha1Hex, randomToken } from './crypto.js';
import { HttpError, bad } from './http.js';

const API = 'https://api.imagekit.io/v1/files';
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // ImageKit free plan limit per image

const isFake = (env) => env.DEV_FAKE_IMAGEKIT === '1';

async function privateKey(ex, env) {
  if (!ex.imagekit_private_enc) throw new HttpError(409, 'นิทรรศการนี้ยังไม่ได้ตั้งค่า ImageKit');
  try {
    return await decryptSecret(ex.imagekit_private_enc, env.APP_ENCRYPTION_KEY);
  } catch {
    throw new HttpError(500, 'ถอดรหัสกุญแจ ImageKit ไม่ได้ (ตรวจ APP_ENCRYPTION_KEY)');
  }
}

export function folderFor(ex, kind) {
  const sub = { work: 'works', artist: 'artists', hero: 'site' }[kind];
  if (!sub) throw bad('ประเภทไฟล์ไม่ถูกต้อง');
  return `/${ex.slug}/${sub}`;
}

// Parameters the browser needs to upload one file straight to ImageKit.
export async function uploadAuth(ex, env, kind) {
  const folder = folderFor(ex, kind);
  if (isFake(env)) {
    return { fake: true, folder, publicKey: 'fake', urlEndpoint: '/api/dev', maxBytes: MAX_UPLOAD_BYTES };
  }
  const token = randomToken(24);
  const expire = Math.floor(Date.now() / 1000) + 30 * 60; // ImageKit requires < 1 hour ahead
  const signature = await hmacSha1Hex(await privateKey(ex, env), token + expire);
  return {
    token, expire, signature, folder,
    publicKey: ex.imagekit_public_key,
    urlEndpoint: ex.imagekit_url_endpoint,
    maxBytes: MAX_UPLOAD_BYTES
  };
}

async function api(ex, env, path, init = {}) {
  const key = await privateKey(ex, env);
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: 'Basic ' + btoa(key + ':'), ...(init.headers || {}) }
  });
  return res;
}

// Confirms the file belongs to this exhibition's account and folder; returns its details.
export async function verifyUploadedFile(ex, env, fileId, kind) {
  if (typeof fileId !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(fileId)) throw bad('รหัสไฟล์ไม่ถูกต้อง');
  const folder = folderFor(ex, kind);
  if (isFake(env)) {
    return {
      fileId, url: `/api/dev/placeholder?seed=${encodeURIComponent(fileId)}`,
      size: 1200000, width: 1600, height: 1200, filePath: `${folder}/${fileId}.jpg`
    };
  }
  const res = await api(ex, env, `/${encodeURIComponent(fileId)}/details`);
  if (res.status === 404) throw bad('ไม่พบไฟล์ที่อัปโหลด กรุณาอัปโหลดใหม่');
  if (!res.ok) throw new HttpError(502, 'ตรวจสอบไฟล์กับ ImageKit ไม่สำเร็จ');
  const d = await res.json();
  if (!String(d.filePath || '').startsWith(folder + '/')) throw bad('ไฟล์ไม่ได้อยู่ในโฟลเดอร์ของนิทรรศการนี้');
  if (d.fileType && d.fileType !== 'image') throw bad('ไฟล์ต้องเป็นรูปภาพ');
  return { fileId: d.fileId, url: d.url, size: d.size || 0, width: d.width || 0, height: d.height || 0, filePath: d.filePath };
}

// Best effort: a failed delete is reported, never fatal.
export async function deleteFile(ex, env, fileId) {
  if (!fileId || isFake(env)) return { skipped: true };
  try {
    const res = await api(ex, env, `/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
    return { ok: res.ok || res.status === 404, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Checks a public/private key pair by listing one file.
export async function testCredentials(urlEndpoint, publicKey, privateKeyPlain, env) {
  if (isFake(env)) return true;
  const res = await fetch(`${API}?limit=1`, { headers: { Authorization: 'Basic ' + btoa(privateKeyPlain + ':') } });
  return res.ok;
}
