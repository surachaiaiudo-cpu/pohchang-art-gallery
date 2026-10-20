// Password hashing, random tokens and secret encryption using Web Crypto (Workers runtime).

const enc = new TextEncoder();

export function toB64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function randomToken(bytes = 32) {
  return toB64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(value) {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(value)));
}

// Cloudflare Workers caps PBKDF2 at 100,000 iterations.
export const PBKDF2_ITERS = 100000;

export async function hashPassword(password, saltB64 = null, iters = PBKDF2_ITERS) {
  const salt = saltB64 ? fromB64url(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iters }, key, 256);
  return { hash: toB64url(bits), salt: toB64url(salt), iters };
}

export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password, user) {
  const { hash } = await hashPassword(password, user.password_salt, user.password_iters);
  return timingSafeEqual(hash, user.password_hash);
}

// AES-GCM with a key derived from the APP_ENCRYPTION_KEY secret.
async function aesKey(secret) {
  if (!secret || secret.length < 16) throw new Error('APP_ENCRYPTION_KEY is not set (min 16 chars)');
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(plain, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(secret), enc.encode(plain));
  return `v1.${toB64url(iv)}.${toB64url(ct)}`;
}

export async function decryptSecret(blob, secret) {
  const [v, ivB, ctB] = String(blob || '').split('.');
  if (v !== 'v1' || !ivB || !ctB) throw new Error('bad encrypted value');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(ivB) }, await aesKey(secret), fromB64url(ctB));
  return new TextDecoder().decode(pt);
}

export async function hmacSha1Hex(keyStr, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(keyStr), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}
