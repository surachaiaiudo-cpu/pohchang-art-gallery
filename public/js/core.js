// Shared browser helpers. Every page builds HTML with esc() around any stored text.

export function esc(value) {
  return String(value ?? '').replace(/[&<>"'`]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;'
  }[c]));
}

// Multi-line text -> paragraphs.
export const paras = (text) => esc(text).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || `เกิดข้อผิดพลาด (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ImageKit transforms through the URL; other URLs (local dev placeholders) pass through.
export function img(url, width) {
  if (!url) return '';
  if (!/^https:\/\/ik\.imagekit\.io\//.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}tr=w-${width}`;
}

export function srcset(url) {
  if (!/^https:\/\/ik\.imagekit\.io\//.test(url || '')) return '';
  return [400, 800, 1600].map((w) => `${img(url, w)} ${w}w`).join(', ');
}

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// Thai short date in Bangkok time with Buddhist year, e.g. "9 พ.ย. 2569".
export function thDate(value, withTime = false) {
  if (!value) return '';
  const d = new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value);
  if (Number.isNaN(d.getTime())) return '';
  const bkk = new Date(d.getTime() + 7 * 3600000);
  let s = `${bkk.getUTCDate()} ${TH_MONTHS[bkk.getUTCMonth()]} ${bkk.getUTCFullYear() + 543}`;
  if (withTime) s += ` ${String(bkk.getUTCHours()).padStart(2, '0')}:${String(bkk.getUTCMinutes()).padStart(2, '0')} น.`;
  return s;
}

// <input type="datetime-local"> value (Bangkok) <-> ISO with +07:00 offset.
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 16);
}
export const fromLocalInput = (v) => (v ? `${v}:00+07:00` : '');

export function bytes(n) {
  if (!n) return '0 MB';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  return `${(n / 1e6).toFixed(1)} MB`;
}

let toastTimer;
export function toast(message, kind = 'info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.className = `toast toast-${kind} show`;
  el.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
}

// Font stacks used by the presets (loaded from Google Fonts on demand).
const FONT_QUERY = {
  'Noto Serif Thai': 'Noto+Serif+Thai:wght@400;600;700',
  'Sarabun': 'Sarabun:wght@400;500;600',
  'Chonburi': 'Chonburi',
  'IBM Plex Sans Thai': 'IBM+Plex+Sans+Thai:wght@400;500;600',
  'Taviraj': 'Taviraj:wght@400;600',
  'Anuphan': 'Anuphan:wght@400;500;600',
  'Kanit': 'Kanit:wght@400;600;800',
  'Mitr': 'Mitr:wght@400;500;600',
  'Mali': 'Mali:wght@400;500;600',
  'Charm': 'Charm:wght@400;700',
  'Srisakdi': 'Srisakdi:wght@400;700'
};
const PRESET_FONTS = {
  'thai-classic': ['Noto Serif Thai', 'Sarabun'],
  'thai-contemporary': ['Chonburi', 'Sarabun'],
  'white-cube': ['IBM Plex Sans Thai'],
  'monochrome': ['Taviraj', 'Anuphan'],
  'pop': ['Kanit'],
  'craft': ['Mitr', 'Mali'],
  'heritage': ['Noto Serif Thai', 'Sarabun']
};

export function loadFonts(names) {
  const fams = [...new Set(names.filter((n) => FONT_QUERY[n]))].map((n) => `family=${FONT_QUERY[n]}`);
  if (!fams.length) return;
  const href = `https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap`;
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

// Applies an exhibition's preset plus its own accent colour, heading font and ornament level.
export function applyTheme(ex) {
  const root = document.documentElement;
  root.dataset.theme = ex.theme_preset || 'white-cube';
  const o = ex.theme_overrides || {};
  root.dataset.ornament = o.ornament || 'light';
  root.dataset.layout = ex.layout || 'grid';
  const fonts = [...(PRESET_FONTS[root.dataset.theme] || [])];
  if (o.headingFont) {
    fonts.push(o.headingFont);
    root.style.setProperty('--font-head', `'${o.headingFont}', var(--font-body)`);
  }
  if (o.accent) {
    root.style.setProperty('--accent', o.accent);
    root.style.setProperty('--accent-ink', readableOn(o.accent));
  }
  loadFonts(fonts);
}

// Black or white text, whichever reads better on the given colour.
export function readableOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.4 ? '#111111' : '#ffffff';
}

export const icons = {
  badge: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1.2 3 1.2 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1-2.8-1.6 1.2-3-1.2-3 2.8-1.6.9-3.1 3.2.3z"/><path d="M8.5 12.5l2.3 2.3 4.7-5"/></svg>',
  arrowLeft: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>',
  arrowRight: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>',
  upload: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 011-1h10"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  cross: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  minus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 12h12"/></svg>'
};

export const slugFromPath = (index = 1) => decodeURIComponent(location.pathname.split('/').filter(Boolean)[index] || '');

export function badgeHtml(label) {
  return `<span class="badge-endorsed" title="${esc(label)}">${icons.badge}<span>${esc(label)}</span></span>`;
}
