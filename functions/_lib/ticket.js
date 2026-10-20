// A submission "ticket": proof that this browser passed the anti-spam check for one exhibition.
// It lets the artist upload images and submit within 2 hours without solving Turnstile again.
import { hmacSha1Hex, timingSafeEqual } from './crypto.js';
import { HttpError, clientIp } from './http.js';

const TTL = 2 * 60 * 60;

async function sign(env, slug, ip, exp) {
  return hmacSha1Hex(`ticket:${env.APP_ENCRYPTION_KEY}`, `${slug}|${ip}|${exp}`);
}

export async function issueTicket(env, request, slug) {
  const exp = Math.floor(Date.now() / 1000) + TTL;
  return `${exp}.${await sign(env, slug, clientIp(request), exp)}`;
}

export async function checkTicket(env, request, slug, ticket) {
  const [expStr, sig] = String(ticket || '').split('.');
  const exp = Number(expStr);
  if (!exp || !sig || exp < Date.now() / 1000) {
    throw new HttpError(401, 'หน้าส่งผลงานหมดเวลา กรุณาโหลดหน้าใหม่', { ticketExpired: true });
  }
  const expected = await sign(env, slug, clientIp(request), exp);
  if (!timingSafeEqual(sig, expected)) throw new HttpError(401, 'การยืนยันไม่ถูกต้อง กรุณาโหลดหน้าใหม่', { ticketExpired: true });
}

// Cloudflare Turnstile server-side check (skipped when no secret is configured).
export async function verifyTurnstile(env, request, token) {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET_KEY);
  form.append('response', token);
  form.append('remoteip', clientIp(request));
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  return !!data.success;
}
