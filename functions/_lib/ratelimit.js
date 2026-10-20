// Fixed-window rate limiting stored in D1 (no KV needed on the free plan).
import { HttpError } from './http.js';

const now = () => Math.floor(Date.now() / 1000);

// Returns { allowed, retryAfter }. Counts the hit when allowed.
export async function hit(db, bucket, { limit, windowSec }) {
  const t = now();
  const row = await db.prepare('SELECT window_start, hits, locked_until FROM rate_limits WHERE bucket = ?').bind(bucket).first();
  if (row && row.locked_until > t) return { allowed: false, retryAfter: row.locked_until - t };
  if (!row || t - row.window_start >= windowSec) {
    await db.prepare(
      `INSERT INTO rate_limits (bucket, window_start, hits, locked_until) VALUES (?, ?, 1, 0)
       ON CONFLICT(bucket) DO UPDATE SET window_start = excluded.window_start, hits = 1, locked_until = 0`
    ).bind(bucket, t).run();
    return { allowed: true, retryAfter: 0 };
  }
  if (row.hits >= limit) return { allowed: false, retryAfter: windowSec - (t - row.window_start) };
  await db.prepare('UPDATE rate_limits SET hits = hits + 1 WHERE bucket = ?').bind(bucket).run();
  return { allowed: true, retryAfter: 0 };
}

export async function enforce(db, bucket, opts, message = 'มีการใช้งานถี่เกินไป กรุณาลองใหม่ภายหลัง') {
  const r = await hit(db, bucket, opts);
  if (!r.allowed) {
    throw new HttpError(429, message, { retryAfter: r.retryAfter });
  }
}

// Login failures: lock the bucket for lockSec after maxFails failures inside windowSec.
export async function isLocked(db, bucket) {
  const row = await db.prepare('SELECT locked_until FROM rate_limits WHERE bucket = ?').bind(bucket).first();
  const t = now();
  return row && row.locked_until > t ? row.locked_until - t : 0;
}

export async function recordFailure(db, bucket, { maxFails = 5, windowSec = 900, lockSec = 900 } = {}) {
  const t = now();
  const row = await db.prepare('SELECT window_start, hits FROM rate_limits WHERE bucket = ?').bind(bucket).first();
  if (!row || t - row.window_start >= windowSec) {
    await db.prepare(
      `INSERT INTO rate_limits (bucket, window_start, hits, locked_until) VALUES (?, ?, 1, 0)
       ON CONFLICT(bucket) DO UPDATE SET window_start = excluded.window_start, hits = 1, locked_until = 0`
    ).bind(bucket, t).run();
    return;
  }
  const hits = row.hits + 1;
  const locked = hits >= maxFails ? t + lockSec : 0;
  await db.prepare('UPDATE rate_limits SET hits = ?, locked_until = ? WHERE bucket = ?').bind(hits, locked, bucket).run();
}

export async function clear(db, bucket) {
  await db.prepare('DELETE FROM rate_limits WHERE bucket = ?').bind(bucket).run();
}
