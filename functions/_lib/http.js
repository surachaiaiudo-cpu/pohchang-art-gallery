// Small HTTP helpers shared by every Pages Function.

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const bad = (msg, extra) => new HttpError(400, msg, extra);
export const unauthorized = (msg = 'กรุณาเข้าสู่ระบบ') => new HttpError(401, msg);
export const forbidden = (msg = 'ไม่มีสิทธิ์ทำรายการนี้') => new HttpError(403, msg);
export const notFound = (msg = 'ไม่พบข้อมูล') => new HttpError(404, msg);

export function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { status: init.status || 200, headers });
}

export const publicJson = (data, seconds = 60) =>
  json(data, { headers: { 'Cache-Control': `public, max-age=${seconds}, s-maxage=${seconds}` } });

export function errorResponse(err) {
  if (err instanceof HttpError) {
    return json({ ok: false, error: err.message, ...(err.extra || {}) }, { status: err.status });
  }
  console.error(err && err.stack ? err.stack : err);
  return json({ ok: false, error: 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
}

const MAX_BODY = 256 * 1024;

export async function readJson(request) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > MAX_BODY) throw bad('ข้อมูลมีขนาดใหญ่เกินไป');
  const text = await request.text();
  if (text.length > MAX_BODY) throw bad('ข้อมูลมีขนาดใหญ่เกินไป');
  if (!text) return {};
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw bad('รูปแบบข้อมูลไม่ถูกต้อง');
  }
}

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
}

// Wraps a handler so thrown HttpErrors become JSON responses.
export const handle = (fn) => async (context) => {
  try {
    return await fn(context);
  } catch (err) {
    return errorResponse(err);
  }
};
