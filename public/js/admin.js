import { api, esc, bytes, thDate, toast } from './core.js';
import { requireLogin, tabs, copyText, STATUS_TH } from './backoffice.js';
import { PRESETS, presetName } from './presets.js';

const $ = (id) => document.getElementById(id);
let exhibitions = [];
let users = [];

function openDrawer(title, html) {
  $('d-title').textContent = title;
  $('d-body').innerHTML = html;
  $('drawer').classList.add('open');
  $('dback').classList.add('open');
  $('d-close').focus();
}
function closeDrawer() { $('drawer').classList.remove('open'); $('dback').classList.remove('open'); }
$('d-close').addEventListener('click', closeDrawer);
$('dback').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

function tempPasswordHtml(user, pw) {
  return `<div class="card" style="background:#fffbe8;border-color:#ecd98d">
    <p style="margin-top:0"><strong>รหัสผ่านชั่วคราวของ ${esc(user)}</strong> (แสดงครั้งเดียว)</p>
    <div class="linkbox"><span id="pw-text">${esc(pw)}</span>
      <button class="btn btn-ghost btn-sm" type="button" data-copy="${esc(pw)}">คัดลอก</button></div>
    <p class="hint">ส่งให้ผู้ใช้ทางช่องทางที่ปลอดภัย ระบบจะบังคับให้ตั้งรหัสผ่านใหม่เมื่อเข้าสู่ระบบครั้งแรก</p></div>`;
}

// ---------------------------------------------------------------- exhibitions
// Open/close submissions straight from the table (curators can still do it in their own settings).
function submissionCell(e) {
  if (e.status !== 'open' && e.status !== 'closed') return '';
  const s = e.submission || {};
  const state = s.open ? '<span class="small" style="color:var(--ok)">● กำลังรับผลงาน</span>'
    : `<span class="small muted">● ไม่รับผลงาน${e.status === 'open' && s.reason ? `: ${esc(s.reason)}` : ''}</span>`;
  const btn = e.status === 'open'
    ? `<button class="btn btn-danger btn-sm" data-sub-toggle="${e.id}" data-to="closed">ปิดรับผลงาน</button>`
    : `<button class="btn btn-ghost btn-sm" data-sub-toggle="${e.id}" data-to="open">เปิดรับผลงานอีกครั้ง</button>`;
  return `<div style="margin-top:6px;display:grid;gap:4px;justify-items:start">${state}${btn}</div>`;
}

function renderExRows() {
  $('ex-rows').innerHTML = exhibitions.map((e) => `
    <tr>
      <td><a href="/manage/${encodeURIComponent(e.slug)}"><strong>${esc(e.title_th)}</strong></a><div class="small muted">/e/${esc(e.slug)} · ${esc(presetName(e.theme_preset))}</div></td>
      <td><span class="tag">${esc(STATUS_TH[e.status] || e.status)}</span>${submissionCell(e)}</td>
      <td>${e.shown} / ${e.works}</td>
      <td>${e.has_storage ? `Cloudinary · ${bytes(e.storage_bytes)}` : '<span class="muted">ยังไม่ตั้งค่า</span>'}</td>
      <td class="small">${e.staff.map((s) => esc(s.name)).join(', ') || '<span class="muted">—</span>'}</td>
      <td><div class="row">
        <a class="btn btn-sm" href="/manage/${encodeURIComponent(e.slug)}">จัดการ</a>
        <button class="btn btn-ghost btn-sm" data-ex-edit="${e.id}">สถานะ/ผู้ดูแล</button>
        <a class="btn btn-ghost btn-sm" href="/e/${encodeURIComponent(e.slug)}" target="_blank" rel="noopener">ดูหน้าเว็บ</a></div></td>
    </tr>`).join('') || '<tr><td colspan="6" class="muted">ยังไม่มีนิทรรศการ</td></tr>';
}

function exEditor(e) {
  const staffIds = new Set(e.staff.map((s) => s.id));
  const staffUsers = users.filter((u) => u.active);
  openDrawer(e.title_th, `
    <form id="ex-form">
      <div class="field"><label for="ee-slug">slug</label><input id="ee-slug" type="text" value="${esc(e.slug)}">
        <span class="hint">เปลี่ยนได้ ระบบจะพาลิงก์เดิมไปยัง slug ใหม่ให้อัตโนมัติ</span></div>
      <div class="field"><label for="ee-status">สถานะ</label><select id="ee-status">
        ${Object.entries(STATUS_TH).map(([k, v]) => `<option value="${k}" ${k === e.status ? 'selected' : ''}>${esc(v)}</option>`).join('')}
      </select></div>
      <div class="field"><span class="label">ผู้ดูแลนิทรรศการนี้</span>
        ${staffUsers.map((u) => `<label class="check"><input type="checkbox" name="staff" value="${u.id}" ${staffIds.has(u.id) ? 'checked' : ''}> ${esc(u.name)} <span class="muted small">${esc(u.email)}</span></label>`).join('') || '<p class="muted">ยังไม่มีผู้ใช้ เพิ่มได้ที่แท็บผู้ใช้</p>'}
      </div>
      <button class="btn" type="submit">บันทึก</button> <span class="error-text" id="ee-err"></span>
    </form>`);
  $('ex-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      await api(`/api/admin/exhibitions/${e.id}`, {
        method: 'PUT',
        body: {
          slug: $('ee-slug').value.trim(),
          status: $('ee-status').value,
          staff_user_ids: [...document.querySelectorAll('input[name="staff"]:checked')].map((x) => Number(x.value))
        }
      });
      toast('บันทึกแล้ว', 'ok');
      closeDrawer();
      await load();
    } catch (err) { $('ee-err').textContent = err.message; }
  });
}

// ---------------------------------------------------------------- users
function renderUserRows() {
  $('user-rows').innerHTML = users.map((u) => `
    <tr>
      <td>${esc(u.name)}${u.active ? '' : ' <span class="tag">ปิดใช้งาน</span>'}${u.must_change_password ? ' <span class="tag">รอตั้งรหัส</span>' : ''}</td>
      <td>${esc(u.email)}</td>
      <td>${u.role === 'admin' ? 'ผู้ดูแลหอศิลป์' : 'ผู้ดูแลนิทรรศการ'}</td>
      <td class="small">${u.role === 'admin' ? '<span class="muted">ทุกนิทรรศการ</span>' : u.exhibitions.map((x) => esc(x.title_th)).join(', ') || '<span class="muted">—</span>'}</td>
      <td class="small">${u.last_login_at ? esc(thDate(u.last_login_at.replace(' ', 'T') + 'Z', true)) : '<span class="muted">ยังไม่เคย</span>'}</td>
      <td><button class="btn btn-ghost btn-sm" data-user-edit="${u.id}">แก้ไข</button></td>
    </tr>`).join('');
}

function exCheckboxes(name, selected = new Set()) {
  return exhibitions.map((e) => `<label class="check"><input type="checkbox" name="${name}" value="${esc(e.slug)}" ${selected.has(e.slug) ? 'checked' : ''}> ${esc(e.title_th)}</label>`).join('')
    || '<span class="muted small">ยังไม่มีนิทรรศการ</span>';
}

function userEditor(u) {
  const sel = new Set(u.exhibitions.map((x) => x.slug));
  openDrawer(u.name, `
    <form id="u-form">
      <div class="field"><label for="ue-name">ชื่อ</label><input id="ue-name" type="text" value="${esc(u.name)}"></div>
      <div class="field"><label for="ue-role">บทบาท</label><select id="ue-role">
        <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>ผู้ดูแลนิทรรศการ</option>
        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>ผู้ดูแลหอศิลป์</option></select></div>
      <div class="field"><span class="label">ดูแลนิทรรศการ</span>${exCheckboxes('ue-ex', sel)}</div>
      <label class="check"><input type="checkbox" id="ue-active" ${u.active ? 'checked' : ''}> เปิดใช้งานบัญชี</label>
      <label class="check"><input type="checkbox" id="ue-reset"> ออกรหัสผ่านชั่วคราวใหม่ (ลืมรหัสผ่าน)</label>
      <p><button class="btn" type="submit">บันทึก</button> <span class="error-text" id="ue-err"></span></p>
      <div id="ue-result"></div>
    </form>`);
  $('u-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      const d = await api(`/api/admin/users/${u.id}`, {
        method: 'PUT',
        body: {
          name: $('ue-name').value, role: $('ue-role').value, active: $('ue-active').checked,
          reset_password: $('ue-reset').checked,
          exhibition_slugs: [...document.querySelectorAll('input[name="ue-ex"]:checked')].map((x) => x.value)
        }
      });
      toast('บันทึกแล้ว', 'ok');
      if (d.temporaryPassword) $('ue-result').innerHTML = tempPasswordHtml(u.name, d.temporaryPassword);
      else closeDrawer();
      await load();
    } catch (err) { $('ue-err').textContent = err.message; }
  });
}

// ---------------------------------------------------------------- load
async function load() {
  const [ex, us] = await Promise.all([api('/api/admin/exhibitions'), api('/api/admin/users')]);
  exhibitions = ex.exhibitions;
  users = us.users;
  renderExRows();
  renderUserRows();
  $('nu-ex').innerHTML = exCheckboxes('nu-ex');
}

async function main() {
  const me = await requireLogin();
  if (me.user.role !== 'admin') {
    $('staff-home').hidden = false;
    $('my-list').innerHTML = me.exhibitions.length
      ? me.exhibitions.map((e) => `<div class="card row" style="justify-content:space-between"><div><strong>${esc(e.title_th)}</strong> <span class="tag">${esc(STATUS_TH[e.status] || e.status)}</span></div><a class="btn" href="/manage/${encodeURIComponent(e.slug)}">จัดการ</a></div>`).join('')
      : '<p class="muted">ยังไม่ได้รับมอบหมายให้ดูแลนิทรรศการ กรุณาติดต่อผู้ดูแลหอศิลป์</p>';
    return;
  }
  $('admin-home').hidden = false;
  $('ne-theme').innerHTML = PRESETS.map((p) => `<option value="${p.key}">${esc(p.th)}</option>`).join('');
  tabs($('tabs'), (tab) => { if (tab === 'site') loadSite().catch((e) => toast(e.message, 'error')); });
  await load();
}

// ---------------------------------------------------------------- gallery settings (home hero + footer)
const SITE_FIELDS = ['hero_title', 'hero_lead', 'org_name', 'address'].flatMap((k) => ['th', 'en', 'zh'].map((l) => `${k}_${l}`))
  .concat(['email', 'phone', 'website', 'facebook', 'instagram', 'youtube', 'tiktok', 'line']);
async function loadSite() {
  const { site } = await api('/api/admin/site');
  for (const k of SITE_FIELDS) $(`st-${k}`).value = site[k] || '';
}
$('site-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('site-err').textContent = '';
  try {
    await api('/api/admin/site', { method: 'PUT', body: Object.fromEntries(SITE_FIELDS.map((k) => [k, $(`st-${k}`).value.trim()])) });
    toast('บันทึกการตั้งค่าหอศิลป์แล้ว (หน้าแรกอัปเดตภายใน 1 นาที)', 'ok');
  } catch (err) { $('site-err').textContent = err.message; }
});

// ---------------------------------------------------------------- import from the old system
let imp = null;
function previewHtml(d) {
  const s = d.summary;
  const unknown = Object.entries(s.unknownNationalities);
  const clouds = Object.entries(s.clouds).map(([c, n]) => `${esc(c)} (${n})`).join(', ');
  return `<div class="card" style="margin:16px 0 0">
    <p style="margin-top:0"><strong>${esc(d.title || d.source)}</strong></p>
    <p>พบผลงานที่จัดแสดง <strong>${s.works}</strong> ชิ้น จากศิลปิน <strong>${s.artists}</strong> คน · มีอีเมล ${s.withEmail} คน · รูปอยู่ที่ Cloudinary: ${clouds || '-'}</p>
    <div class="row" style="gap:8px;margin:8px 0">${s.sample.map((w) => `<img src="${esc(w.image.replace('/image/upload/', '/image/upload/f_auto,q_auto,c_limit,w_400/'))}" alt="${esc(w.title)}" title="${esc(w.title)} — ${esc(w.artist)}" style="width:72px;height:72px;object-fit:cover;border-radius:6px">`).join('')}</div>
    ${s.skipped.length ? `<p class="error-text">ข้ามได้ ${s.skipped.length} ชิ้น: ${s.skipped.map(esc).join(' · ')}</p>` : ''}
    ${unknown.length ? `<p class="small">สัญชาติที่แปลงเป็นประเทศไม่ได้ (จะเก็บข้อความเดิมไว้ ให้ภัณฑารักษ์แก้ภายหลัง): ${unknown.map(([t, n]) => `<span class="tag">${esc(t)} ×${n}</span>`).join(' ')}</p>` : ''}
    ${s.nationalityWasEmail.length ? `<p class="small">ช่องสัญชาติที่กรอกเป็นอีเมล (จะเว้นว่าง ไม่เผยแพร่): ${s.nationalityWasEmail.map(esc).join(', ')}</p>` : ''}
    <form id="imp-run" novalidate>
      <div class="grid-3">
        <div class="field"><label for="imp-title">ชื่อนิทรรศการ</label><input id="imp-title" type="text" value="${esc(d.title)}"></div>
        <div class="field"><label for="imp-title-en">ชื่อภาษาอังกฤษ</label><input id="imp-title-en" type="text"></div>
        <div class="field"><label for="imp-slug">slug</label><input id="imp-slug" type="text" placeholder="เช่น sirikit"><span class="hint">ส่วนท้าย URL: /e/&lt;slug&gt;</span></div>
        <div class="field"><label for="imp-theme">ธีม</label><select id="imp-theme">${$('ne-theme').innerHTML}</select></div>
      </div>
      <button class="btn" type="submit">นำเข้าเป็นฉบับร่าง</button> <span class="error-text" id="imp-run-err"></span>
      <div class="meter" id="imp-meter" hidden style="margin-top:12px"><span style="width:0"></span></div>
      <p class="small" id="imp-state"></p>
    </form></div>`;
}
$('imp-check').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('imp-err').textContent = '';
  $('imp-preview').hidden = true;
  try {
    const d = await api('/api/admin/import', { method: 'POST', body: { step: 'preview', source: $('imp-src').value.trim() } });
    imp = d;
    $('imp-preview').innerHTML = previewHtml(d);
    $('imp-preview').hidden = false;
    $('imp-theme').value = 'heritage';
  } catch (err) { $('imp-err').textContent = err.message; }
});
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'imp-run') return;
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  $('imp-run-err').textContent = '';
  if (!confirm(`นำเข้า ${imp.summary.works} ผลงานเป็นนิทรรศการฉบับร่าง?`)) return;
  btn.disabled = true;
  try {
    const c = await api('/api/admin/import', {
      method: 'POST',
      body: { step: 'create', source: imp.source, slug: $('imp-slug').value.trim(), title_th: $('imp-title').value, title_en: $('imp-title-en').value, theme_preset: $('imp-theme').value }
    });
    $('imp-meter').hidden = false;
    let offset = 0, imported = 0, skipped = [];
    for (;;) {
      const r = await api('/api/admin/import', { method: 'POST', body: { step: 'chunk', source: imp.source, exhibition_id: c.exhibition.id, offset, imported } });
      offset = r.next; imported = r.imported; skipped = skipped.concat(r.skipped);
      $('imp-meter').firstElementChild.style.width = `${Math.min(100, Math.round((offset / Math.max(1, c.total)) * 100))}%`;
      $('imp-state').textContent = `นำเข้าแล้ว ${imported} / ${c.total} ชิ้น`;
      if (r.done) break;
    }
    $('imp-state').innerHTML = `นำเข้าเสร็จ ${imported} ชิ้น${skipped.length ? ` (ข้าม ${skipped.length})` : ''} ·
      <a href="/manage/${encodeURIComponent(c.exhibition.slug)}">ตรวจในหน้าจัดการ</a> เมื่อพร้อมเผยแพร่ ให้กด "สถานะ/ผู้ดูแล" ของงานนี้แล้วเลือก "คลังนิทรรศการ"`;
    toast('นำเข้าเสร็จแล้ว', 'ok');
    await load();
  } catch (err) {
    $('imp-run-err').textContent = err.message;
  } finally { btn.disabled = false; }
});

$('ne-slug').addEventListener('input', (e) => { $('ne-url').textContent = e.target.value ? `${location.origin}/e/${e.target.value}` : ''; });
$('new-ex').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('ne-err').textContent = '';
  try {
    const d = await api('/api/admin/exhibitions', { method: 'POST', body: { title_th: $('ne-title').value, slug: $('ne-slug').value.trim(), theme_preset: $('ne-theme').value } });
    toast('สร้างนิทรรศการแล้ว', 'ok');
    location.href = `/manage/${encodeURIComponent(d.exhibition.slug)}#settings`;
  } catch (err) { $('ne-err').textContent = err.message; }
});
$('new-user').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('nu-err').textContent = '';
  try {
    const d = await api('/api/admin/users', {
      method: 'POST',
      body: {
        name: $('nu-name').value, email: $('nu-email').value, role: $('nu-role').value,
        exhibition_slugs: [...document.querySelectorAll('input[name="nu-ex"]:checked')].map((x) => x.value)
      }
    });
    $('nu-result').hidden = false;
    $('nu-result').innerHTML = tempPasswordHtml(d.user.name, d.temporaryPassword);
    e.target.reset();
    await load();
  } catch (err) { $('nu-err').textContent = err.message; }
});
document.addEventListener('click', async (e) => {
  const c = e.target.closest('[data-copy]');
  if (c) { toast((await copyText(c.dataset.copy)) ? 'คัดลอกแล้ว' : 'คัดลอกไม่ได้ กรุณาเลือกข้อความเอง'); return; }
  const ee = e.target.closest('[data-ex-edit]');
  if (ee) { exEditor(exhibitions.find((x) => x.id === Number(ee.dataset.exEdit))); return; }
  const st = e.target.closest('[data-sub-toggle]');
  if (st) {
    const ex = exhibitions.find((x) => x.id === Number(st.dataset.subToggle));
    const closing = st.dataset.to === 'closed';
    const msg = closing
      ? `ปิดรับผลงาน "${ex.title_th}"?\n\nฟอร์มส่งผลงานจะปิดทันที นิทรรศการและผลงานยังแสดงตามปกติ เปิดกลับได้ภายหลัง`
      : `เปิดรับผลงาน "${ex.title_th}" อีกครั้ง?${ex.submission_closes_at && Date.parse(ex.submission_closes_at) < Date.now() ? '\n\nหมายเหตุ: วันปิดรับที่ตั้งไว้ผ่านไปแล้ว ฟอร์มจะยังไม่รับผลงานจนกว่าจะแก้วันปิดรับในหน้าจัดการ' : ''}`;
    if (!confirm(msg)) return;
    st.disabled = true;
    try {
      await api(`/api/admin/exhibitions/${ex.id}`, { method: 'PUT', body: { status: st.dataset.to } });
      toast(closing ? 'ปิดรับผลงานแล้ว' : 'เปิดรับผลงานแล้ว', 'ok');
      await load();
    } catch (err) { st.disabled = false; toast(err.message, 'error'); }
    return;
  }
  const ue = e.target.closest('[data-user-edit]');
  if (ue) userEditor(users.find((x) => x.id === Number(ue.dataset.userEdit)));
});
main().catch(() => {});
