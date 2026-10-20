// Loads the reviewer behind a personal link token.
import { sha256Hex } from './crypto.js';
import { HttpError, clientIp } from './http.js';
import { isLocked, recordFailure } from './ratelimit.js';

export async function loadReviewer(env, request, token) {
  const db = env.DB;
  const bucket = `review-token:${clientIp(request)}`;
  if (await isLocked(db, bucket)) throw new HttpError(429, 'ลองลิงก์ไม่ถูกต้องหลายครั้ง กรุณารอสักครู่');
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
    await recordFailure(db, bucket, { maxFails: 10, windowSec: 600, lockSec: 900 });
    throw new HttpError(404, 'ลิงก์ไม่ถูกต้อง');
  }
  const row = await db.prepare(
    `SELECT r.id AS reviewer_id, r.name AS reviewer_name, r.title AS reviewer_title, r.active, e.*
       FROM reviewers r JOIN exhibitions e ON e.id = r.exhibition_id
      WHERE r.token_hash = ?`
  ).bind(await sha256Hex(token)).first();
  if (!row) {
    await recordFailure(db, bucket, { maxFails: 10, windowSec: 600, lockSec: 900 });
    throw new HttpError(404, 'ลิงก์ไม่ถูกต้องหรือถูกยกเลิกแล้ว');
  }
  if (!row.active) throw new HttpError(403, 'ลิงก์นี้ถูกปิดใช้งานแล้ว กรุณาติดต่อภัณฑารักษ์');
  const { reviewer_id, reviewer_name, reviewer_title, active, ...ex } = row;
  return { reviewer: { id: reviewer_id, name: reviewer_name, title: reviewer_title }, ex };
}
