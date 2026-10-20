// Sessions for admins and exhibition staff (email + password).
import { randomToken, sha256Hex } from './crypto.js';
import { unauthorized, forbidden, HttpError } from './http.js';

export const SESSION_COOKIE = 'gsid';
const SESSION_DAYS = 7;

export function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function cookieHeader(request, value, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function createSession(db, request, userId) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')"),
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await sha256Hex(token), userId, expires),
    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(userId)
  ]);
  return cookieHeader(request, token, SESSION_DAYS * 86400);
}

export async function destroySession(db, request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return cookieHeader(request, '', 0);
}

export async function currentUser(db, request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || token.length > 100) return null;
  const row = await db.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.must_change_password, u.active, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`
  ).bind(await sha256Hex(token)).first();
  if (!row || !row.active || Date.parse(row.expires_at) < Date.now()) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role, mustChangePassword: !!row.must_change_password };
}

// State-changing requests from the browser must come from our own origin (CSRF guard on top of SameSite).
export function assertSameOrigin(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return;
  const origin = request.headers.get('Origin');
  const host = new URL(request.url).origin;
  if (!origin || origin !== host) throw new HttpError(403, 'คำขอไม่ได้มาจากหน้าเว็บของระบบ');
}

// Loads the user or throws 401. Users who still have a temporary password may only change it.
export async function requireUser(context, { allowTempPassword = false } = {}) {
  const user = await currentUser(context.env.DB, context.request);
  if (!user) throw unauthorized();
  if (user.mustChangePassword && !allowTempPassword) {
    throw new HttpError(403, 'กรุณาเปลี่ยนรหัสผ่านชั่วคราวก่อนใช้งาน', { mustChangePassword: true });
  }
  return user;
}

export async function requireAdmin(context) {
  const user = await requireUser(context);
  if (user.role !== 'admin') throw forbidden('เฉพาะผู้ดูแลหอศิลป์');
  return user;
}

export const actorOf = (user) => `user:${user.id}`;
