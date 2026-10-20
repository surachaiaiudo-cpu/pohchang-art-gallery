// Input validation. Text is stored as typed (no look-alike replacements); every page escapes
// on output instead, so names with quotes or < > display correctly and still cannot inject HTML.
import { bad } from './http.js';

// Remove control characters except tab and newline.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function text(value, { field = 'ข้อมูล', max = 500, required = false, multiline = false } = {}) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' && typeof value !== 'number') throw bad(`${field} ไม่ถูกต้อง`);
  let v = String(value).replace(CONTROL, '');
  if (!multiline) v = v.replace(/[\r\n\t]+/g, ' ');
  v = v.trim();
  if (required && !v) throw bad(`กรุณากรอก${field}`);
  if (v.length > max) throw bad(`${field} ยาวเกิน ${max} ตัวอักษร`);
  return v;
}

export const longText = (value, opts = {}) => text(value, { max: 12000, multiline: true, ...opts });

export function email(value, { field = 'อีเมล', required = false } = {}) {
  const v = text(value, { field, max: 254, required }).toLowerCase();
  if (v && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v)) throw bad(`${field} ไม่ถูกต้อง`);
  return v;
}

export function int(value, { field = 'ตัวเลข', min = -Infinity, max = Infinity, fallback } = {}) {
  if ((value === undefined || value === null || value === '') && fallback !== undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${field} ต้องเป็นจำนวนเต็ม ${min}–${max}`);
  return n;
}

export function oneOf(value, allowed, { field = 'ค่า', fallback } = {}) {
  if ((value === undefined || value === null || value === '') && fallback !== undefined) return fallback;
  if (!allowed.includes(value)) throw bad(`${field} ไม่ถูกต้อง`);
  return value;
}

export function slug(value) {
  const v = text(value, { field: 'slug', max: 60, required: true }).toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(v)) {
    throw bad('slug ใช้ได้เฉพาะ a-z 0-9 และขีดกลาง เช่น poh-chang-20');
  }
  if (['admin', 'api', 'login', 'review', 'manage', 'e', 'assets', 'css', 'js'].includes(v)) {
    throw bad('slug นี้สงวนไว้สำหรับระบบ');
  }
  return v;
}

// ISO 8601 date-time (with offset) or date; empty allowed.
export function dateTime(value, { field = 'วันที่' } = {}) {
  const v = text(value, { field, max: 40 });
  if (!v) return null;
  if (Number.isNaN(Date.parse(v))) throw bad(`${field} ไม่ถูกต้อง`);
  return v;
}

export function dateOnly(value, { field = 'วันที่' } = {}) {
  const v = text(value, { field, max: 10 });
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw bad(`${field} ต้องอยู่ในรูปแบบ ปปปป-ดด-วว`);
  return v;
}

export function httpsUrl(value, { field = 'URL' } = {}) {
  const v = text(value, { field, max: 1000 });
  if (!v) return '';
  let u;
  try { u = new URL(v); } catch { throw bad(`${field} ไม่ถูกต้อง`); }
  if (u.protocol !== 'https:') throw bad(`${field} ต้องขึ้นต้นด้วย https://`);
  return u.toString();
}

export function color(value, { field = 'สี' } = {}) {
  const v = text(value, { field, max: 7 });
  if (!v) return '';
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) throw bad(`${field} ต้องเป็นรหัสสีแบบ #RRGGBB`);
  return v.toLowerCase();
}

export function password(value) {
  const v = typeof value === 'string' ? value : '';
  if (v.length < 10) throw bad('รหัสผ่านต้องยาวอย่างน้อย 10 ตัวอักษร');
  if (v.length > 200) throw bad('รหัสผ่านยาวเกินไป');
  return v;
}
