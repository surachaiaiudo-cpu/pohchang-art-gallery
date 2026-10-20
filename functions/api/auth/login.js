import { handle, json, readJson, clientIp, bad, HttpError } from '../../_lib/http.js';
import { createSession } from '../../_lib/auth.js';
import { hashPassword, verifyPassword, timingSafeEqual } from '../../_lib/crypto.js';
import { isLocked, recordFailure, clear } from '../../_lib/ratelimit.js';
import * as v from '../../_lib/validate.js';

const FAIL_MSG = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';

// POST /api/auth/login  { email, password }
export const onRequestPost = handle(async ({ request, env }) => {
  const db = env.DB;
  const body = await readJson(request);
  const email = v.email(body.email, { required: true });
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) throw bad('กรุณากรอกรหัสผ่าน');

  const emailBucket = `login:email:${email}`;
  const ipBucket = `login:ip:${clientIp(request)}`;
  const wait = Math.max(await isLocked(db, emailBucket), await isLocked(db, ipBucket));
  if (wait) throw new HttpError(429, `ใส่รหัสผิดหลายครั้ง กรุณารอ ${Math.ceil(wait / 60)} นาที`);

  let user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();

  // First run: create the admin from the bootstrap secrets while there are no users at all.
  if (!user && env.BOOTSTRAP_ADMIN_EMAIL && env.BOOTSTRAP_ADMIN_PASSWORD) {
    const count = await db.prepare('SELECT COUNT(*) AS n FROM users').first();
    if (count.n === 0 && email === env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
        && timingSafeEqual(password, env.BOOTSTRAP_ADMIN_PASSWORD)) {
      const h = await hashPassword(password);
      await db.prepare(
        `INSERT INTO users (email, name, role, password_hash, password_salt, password_iters, must_change_password)
         VALUES (?, 'ผู้ดูแลหอศิลป์', 'admin', ?, ?, ?, 1)`
      ).bind(email, h.hash, h.salt, h.iters).run();
      user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    }
  }

  // Hash even when the account does not exist, so response time does not reveal valid emails.
  const ok = user && user.active ? await verifyPassword(password, user) : (await hashPassword(password), false);
  if (!ok) {
    await recordFailure(db, emailBucket, { maxFails: 5, windowSec: 900, lockSec: 900 });
    await recordFailure(db, ipBucket, { maxFails: 20, windowSec: 900, lockSec: 900 });
    throw new HttpError(401, FAIL_MSG);
  }
  await clear(db, emailBucket);
  const cookie = await createSession(db, request, user.id);
  return json(
    { ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, mustChangePassword: !!user.must_change_password } },
    { headers: { 'Set-Cookie': cookie } }
  );
});
