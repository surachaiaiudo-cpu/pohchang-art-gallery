// /coord/<slug> - "ศิลปินที่ฉันดูแล" for coordinators (owner, 2026-11-19): one coordinator per artist, set by the
// exhibition's managers; the coordinator marks "แจ้งแล้ว" after sending the invitation and sees who has signed.
// Notices are on this page only: artists who signed since the last visit (remembered in this browser).
import { api, esc, toast, slugFromPath } from './core.js';
import { requireLogin } from './backoffice.js';
import { flagImg, countryName } from './countries.js';
import { formatNo } from './roster-logic.js';

const slug = slugFromPath(1);
const A = `/api/coord/${encodeURIComponent(slug)}`;
const $ = (id) => document.getElementById(id);
const S = { me: null, ex: null, artists: [], coords: [] };
const SEEN_KEY = `coord:seen:${slug}`;

// D1 datetime('now') is UTC "YYYY-MM-DD HH:MM:SS".
const when = (s) => (s ? new Date(`${s.replace(' ', 'T')}Z`) : null);
const fmt = (d) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
const daysAgo = (d) => Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
const ACCEPTED_BY = { self: 'ศิลปินกรอกเอง', coordinator: 'ผู้ประสานงานกรอกให้', friend: 'ผู้อื่นกรอกให้' };

function stateOf(a) {
  if (a.accepted_at) return 'signed';
  return a.notified_at ? 'waiting' : 'todo';
}
const coordName = (id) => (S.coords.find((c) => c.id === id) || {}).name || '';

function news() {
  let seen = null;
  try { seen = localStorage.getItem(SEEN_KEY); } catch { /* no storage */ }
  const mine = S.artists.filter((a) => a.coordinator_id === S.me.id || S.me.role !== 'coordinator');
  const fresh = seen ? mine.filter((a) => a.accepted_at && when(a.accepted_at).getTime() > Number(seen)) : [];
  $('news').hidden = !fresh.length;
  if (fresh.length) {
    $('news').innerHTML = `<b>ลงนามตอบรับใหม่ ${fresh.length} ท่าน ตั้งแต่เข้ามาครั้งก่อน</b><div class="small">${fresh
      .map((a) => `${esc(a.name_th)} (${fmt(when(a.accepted_at))})`).join(' · ')}</div>`;
  }
  try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* no storage */ }
}

function stats() {
  const who = $('f-who').value;
  const list = S.artists.filter((a) => !a.withdrawn && (who === 'all' || (who === 'none' ? !a.coordinator_id : String(a.coordinator_id) === who)));
  const n = (st) => list.filter((a) => stateOf(a) === st).length;
  const box = (v, t) => `<div class="stat"><b>${v}</b><span>${esc(t)}</span></div>`;
  $('stats').innerHTML = box(list.length, who === String(S.me.id) ? 'ศิลปินที่ฉันดูแล' : 'ศิลปินในมุมมองนี้')
    + box(n('todo'), 'ยังไม่แจ้ง') + box(n('waiting'), 'แจ้งแล้ว รอลงนาม') + box(n('signed'), 'ลงนามตอบรับแล้ว');
}

function rows() {
  const who = $('f-who').value;
  const st = $('f-state').value;
  const q = $('f-q').value.trim().toLowerCase();
  const list = S.artists.filter((a) => {
    if (who !== 'all' && (who === 'none' ? a.coordinator_id : String(a.coordinator_id) !== who)) return false;
    if (st && stateOf(a) !== st) return false;
    if (!q) return true;
    return [a.name_th, a.name_en, a.affiliation, countryName(a.nationality, 'th'), countryName(a.nationality, 'en'), formatNo(a.artist_no)]
      .join(' ').toLowerCase().includes(q);
  });
  stats();
  if (!list.length) { $('rows').innerHTML = '<tr><td colspan="6" class="muted">ไม่มีศิลปินตามเงื่อนไขนี้</td></tr>'; return; }
  $('rows').innerHTML = list.map((a) => {
    const s = stateOf(a);
    const n = when(a.notified_at);
    const acc = when(a.accepted_at);
    const state = s === 'signed'
      ? `<span class="co-state co-signed">✓ ลงนามแล้ว</span><div class="small muted">${fmt(acc)}${a.accepted_by ? ` · ${esc(ACCEPTED_BY[a.accepted_by] || a.accepted_by)}` : ''}</div>`
      : s === 'waiting'
        ? `<span class="co-state co-wait">แจ้งแล้ว รอลงนาม</span><div class="small muted">แจ้งเมื่อ ${fmt(n)} (${daysAgo(n)} วันก่อน)${a.notified_by_name ? ` · ${esc(a.notified_by_name)}` : ''}</div>`
        : '<span class="co-state co-todo">ยังไม่แจ้ง</span>';
    const btn = s === 'signed' ? ''
      : s === 'waiting'
        ? `<button class="btn btn-ghost btn-sm" type="button" data-notify="0">ยกเลิก “แจ้งแล้ว”</button>`
        : `<button class="btn btn-sm" type="button" data-notify="1">แจ้งแล้ว</button>`;
    return `<tr data-id="${a.id}" class="${a.withdrawn ? 'ro-out' : ''}${a.coordinator_id === S.me.id ? ' co-mine' : ''}">
      <td>${esc(formatNo(a.artist_no)) || '<span class="muted">—</span>'}</td>
      <td class="ro-name"><b>${esc(a.name_th)}</b>${a.name_en && a.name_en !== a.name_th ? `<span class="small">${esc(a.name_en)}</span>` : ''}<span class="small muted">${flagImg(a.nationality, {}, esc)}${esc(countryName(a.nationality, 'th') || 'ไม่ระบุประเทศ')}${a.affiliation ? ` · ${esc(a.affiliation)}` : ''}</span>${a.withdrawn ? `<span class="small">ถอนตัว${a.roster_note ? `: ${esc(a.roster_note)}` : ''}</span>` : ''}</td>
      <td class="small ro-contact">${a.email ? `<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>` : ''}${a.phone ? `<div><a href="tel:${esc(a.phone.replace(/[^\d+]/g, ''))}">${esc(a.phone)}</a></div>` : ''}${!a.email && !a.phone ? '<span class="muted">—</span>' : ''}</td>
      <td class="small">${a.coordinator_id ? esc(coordName(a.coordinator_id) || '—') + (a.coordinator_id === S.me.id ? ' <span class="tag">ฉัน</span>' : '') : '<span class="muted">ยังไม่กำหนด</span>'}</td>
      <td>${state}</td>
      <td>${a.withdrawn ? '' : btn}</td>
    </tr>`;
  }).join('');
}

async function load() {
  const d = await api(A);
  S.ex = d.exhibition;
  S.me = d.me;
  S.coords = d.coordinators;
  S.artists = d.artists;
}

function wire() {
  const mine = S.coords.some((c) => c.id === S.me.id);
  $('f-who').innerHTML = (mine ? `<option value="${S.me.id}">ศิลปินที่ฉันดูแล</option>` : '')
    + '<option value="all">ศิลปินทั้งหมด</option>'
    + S.coords.filter((c) => c.id !== S.me.id).map((c) => `<option value="${c.id}">ศิลปินของ ${esc(c.name)}</option>`).join('')
    + '<option value="none">ยังไม่กำหนดผู้ประสานงาน</option>';
  $('f-who').value = mine ? String(S.me.id) : 'all';
  for (const id of ['f-who', 'f-state']) $(id).addEventListener('change', rows);
  $('f-q').addEventListener('input', rows);
  $('rows').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-notify]');
    if (!b) return;
    const a = S.artists.find((x) => x.id === Number(b.closest('tr').dataset.id));
    const notified = b.dataset.notify === '1';
    if (!notified && !confirm(`ยกเลิก “แจ้งแล้ว” ของ ${a.name_th}?`)) return;
    b.disabled = true;
    try {
      await api(A, { method: 'POST', body: { artist_id: a.id, notified } });
      toast(notified ? `บันทึกว่าแจ้ง ${a.name_th} แล้ว` : 'ยกเลิกแล้ว');
      await load();
      rows();
    } catch (err) { toast(err.message, 'error'); b.disabled = false; }
  });
}

(async () => {
  try {
    await requireLogin();
    await load();
    document.title = `ศิลปินที่ฉันดูแล · ${S.ex.title_th}`;
    $('ex-sub').textContent = `${S.ex.title_th} · ${S.me.name}${S.me.role === 'coordinator' ? ' (ผู้ประสานงาน)' : ''}`;
    if (S.me.role !== 'coordinator') {
      $('back').hidden = false;
      $('back').href = `/manage/${encodeURIComponent(S.ex.slug)}/roster`;
    }
    wire();
    news();
    rows();
  } catch (err) {
    if (err.message !== 'redirect') $('ex-sub').textContent = err.message;
  }
})();
