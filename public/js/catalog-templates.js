// /catalog-templates - the shared library of catalogue templates (admins and exhibition staff).
import { api, esc, toast, thDate } from './core.js';
import { requireLogin } from './backoffice.js';
import { builtinTemplate, normalizeLayout } from './catalog-core.js';
import { miniSheet } from './catalog-render.js';
import { SAMPLE_EXHIBITION, SAMPLE_WORKS } from './catalog-sample.js';

const $ = (id) => document.getElementById(id);
const ctx = { ex: SAMPLE_EXHIBITION, settings: { fields: {}, footer: { th: 'ข้อความท้ายหน้า', en: '', zh: '' } }, langs: ['th', 'en'] };
const urlOf = (t) => `/catalog-templates/${t.builtin ? `b-${t.ref.slice(2)}` : t.id}`;
let me = null;

async function picture(t) {
  try {
    const layout = t.builtin ? normalizeLayout(builtinTemplate(t.ref).layout) : (await api(`/api/catalog-templates/${t.id}`)).template.layout;
    return miniSheet(layout, SAMPLE_WORKS[0], ctx, 0.24);
  } catch { return ''; }
}

async function card(t) {
  const mine = !t.builtin && (me.role === 'admin' || t.created_by === me.id);
  return `<div class="tpl tpl-card">${await picture(t)}
    <span class="nm">${esc(t.name)}</span>
    ${t.description ? `<span class="ds">${esc(t.description)}</span>` : ''}
    <span class="by">${t.builtin ? 'เทมเพลตหลักของระบบ' : `สร้างโดย ${esc(t.author || '—')} · แก้ไขล่าสุด ${esc(thDate(t.updated_at ? `${t.updated_at.replace(' ', 'T')}Z` : ''))}`}</span>
    <div class="row">
      <a class="btn btn-sm${mine ? '' : ' btn-ghost'}" href="${urlOf(t)}">${mine ? 'แก้ไข' : 'ดู'}</a>
      <button class="btn btn-ghost btn-sm" type="button" data-copy="${esc(t.ref)}" data-name="${esc(t.name)}">คัดลอก</button>
      ${mine ? `<button class="btn btn-danger btn-sm" type="button" data-del="${t.id}" data-name="${esc(t.name)}">ลบ</button>` : ''}
    </div></div>`;
}

async function load() {
  const d = await api('/api/catalog-templates');
  me = d.me;
  const list = d.templates;
  $('n-from').innerHTML = list.map((t) => `<option value="${esc(t.ref)}">${esc(t.name)}${t.builtin ? ' (หลัก)' : ''}</option>`).join('');
  $('builtin').innerHTML = (await Promise.all(list.filter((t) => t.builtin).map(card))).join('');
  const own = list.filter((t) => !t.builtin);
  $('own').innerHTML = own.length ? (await Promise.all(own.map(card))).join('') : '<p class="muted">ยังไม่มี กดสร้างเทมเพลตใหม่ด้านบน หรือคัดลอกจากเทมเพลตหลัก</p>';
}

async function create(name, from) {
  const d = await api('/api/catalog-templates', { method: 'POST', body: { name, from } });
  location.href = `/catalog-templates/${d.id}`;
}

$('new').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('n-err').textContent = '';
  try { await create($('n-name').value, $('n-from').value); } catch (err) { $('n-err').textContent = err.message; }
});
document.addEventListener('click', async (e) => {
  const c = e.target.closest('[data-copy]');
  if (c) {
    const name = prompt('ตั้งชื่อเทมเพลตใหม่', `${c.dataset.name} (สำเนา)`);
    if (!name) return;
    try { await create(name, c.dataset.copy); } catch (err) { toast(err.message, 'error'); }
    return;
  }
  const d = e.target.closest('[data-del]');
  if (d) {
    if (!confirm(`ลบเทมเพลต "${d.dataset.name}"? ลบแล้วกู้คืนไม่ได้`)) return;
    try {
      await api(`/api/catalog-templates/${d.dataset.del}`, { method: 'DELETE' });
      toast('ลบเทมเพลตแล้ว', 'ok');
      await load();
    } catch (err) { toast(err.message, 'error'); }
  }
});

requireLogin().then(load).catch((e) => { if (e.message !== 'redirect') toast(e.message, 'error'); });
