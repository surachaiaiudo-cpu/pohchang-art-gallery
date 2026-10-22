import { api, esc, loadFonts } from './core.js';

loadFonts(['IBM Plex Sans Thai']);

// Ensures someone is signed in (and has replaced a temporary password); renders the top bar.
export async function requireLogin() {
  let me;
  try { me = await api('/api/auth/me'); } catch { me = { user: null }; }
  if (!me.user || me.user.mustChangePassword) {
    location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
    throw new Error('redirect');
  }
  const bar = document.getElementById('topbar');
  if (bar) {
    bar.innerHTML = `<div class="in">
      <a href="/admin"><strong>หอศิลป์ออนไลน์</strong> · ระบบผู้จัด</a>
      <div class="who"><a href="/catalog-templates">เทมเพลตสูจิบัตร</a><span>${esc(me.user.name)} (${me.user.role === 'admin' ? 'ผู้ดูแลหอศิลป์' : 'ผู้ดูแลนิทรรศการ'})</span>
        <button class="btn btn-ghost btn-sm" id="logout" type="button">ออกจากระบบ</button></div></div>`;
    document.getElementById('logout').addEventListener('click', async () => {
      await api('/api/auth/logout', { method: 'POST' });
      location.href = '/login';
    });
  }
  return me;
}

export function tabs(container, onChange) {
  const buttons = [...container.querySelectorAll('[role="tab"]')];
  const select = (b) => {
    buttons.forEach((x) => {
      x.setAttribute('aria-selected', String(x === b));
      document.getElementById(x.getAttribute('aria-controls')).hidden = x !== b;
    });
    history.replaceState(null, '', `#${b.dataset.tab}`);
    onChange && onChange(b.dataset.tab);
  };
  buttons.forEach((b) => b.addEventListener('click', () => select(b)));
  const initial = buttons.find((b) => `#${b.dataset.tab}` === location.hash) || buttons[0];
  select(initial);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

// Listed in this order in every status picker. Stored values are older than the labels: see
// functions/_lib/exhibitions.js (closed = ซ่อน, archived = ปิด).
export const STATUS_TH = { draft: 'ร่าง', open: 'เปิด', archived: 'ปิด', closed: 'ซ่อน' };
export const STATUS_HINT = {
  draft: 'กำลังเตรียม คนทั่วไปมองไม่เห็น',
  open: 'แสดงในหน้าแรกหมวดกำลังจัดแสดง รับผลงานเฉพาะช่วงวันเปิด–ปิดรับ',
  archived: 'จบแล้ว ย้ายไปหมวดนิทรรศการที่ผ่านมา ไม่รับผลงาน',
  closed: 'ซ่อนจากคนทั่วไป ผู้ดูแลยังแก้ไขได้ ไม่รับผลงาน'
};
// Short state of the call for work, for the back office.
export function submissionText(e) {
  const s = e.submission || {};
  if (s.open) return '● กำลังรับผลงาน';
  return `● ไม่รับผลงาน${s.reason ? `: ${s.reason}` : ''}`;
}
