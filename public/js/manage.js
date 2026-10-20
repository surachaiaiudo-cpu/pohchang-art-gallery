import { api, esc, img, bytes, thDate, toast, toLocalInput, fromLocalInput, slugFromPath } from './core.js';
import { requireLogin, tabs, copyText, STATUS_TH } from './backoffice.js';
import { PRESETS } from './presets.js';
import { checkImageFile, uploadImage } from './upload.js';

const slug = slugFromPath(1);
const M = `/api/manage/${encodeURIComponent(slug)}`;
const $ = (id) => document.getElementById(id);
const S = { ex: null, counts: {}, works: [], status: 'submitted', q: '', selected: new Set(), reviewers: [], shownWorks: 0, headingFonts: [] };

const RESULT_TH = { pending: 'รอผล', endorsed: 'ได้ badge', not_endorsed: 'ไม่ได้ badge', needs_curator: 'ให้ภัณฑารักษ์ตัดสิน' };
const DECISION = { approve: '✓', reject: '✕', abstain: '–' };

// ------------------------------------------------------------------ helpers
function openDrawer(title, html) {
  $('d-title').textContent = title;
  $('d-body').innerHTML = html;
  $('drawer').classList.add('open');
  $('dback').classList.add('open');
}
function closeDrawer() { $('drawer').classList.remove('open'); $('dback').classList.remove('open'); }
$('d-close').addEventListener('click', closeDrawer);
$('dback').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

let pickHandler = null;
function pickImage(handler) { pickHandler = handler; $('picker').value = ''; $('picker').click(); }
$('picker').addEventListener('change', (e) => { const f = e.target.files[0]; if (f && pickHandler) pickHandler(f); });

async function uploadFor(kind, file, onProgress) {
  const problem = checkImageFile(file);
  if (problem) throw new Error(problem);
  const { upload } = await api(`${M}/upload-auth`, { method: 'POST', body: { kind } });
  return uploadImage(file, upload, onProgress);
}

function statusTag(w) {
  const t = { submitted: 'รอคัดกรอง', shown: 'จัดแสดง', rejected: 'ไม่ผ่าน' }[w.status];
  return `<span class="tag tag-${w.status}">${t}</span>`;
}
function reviewTag(w) {
  if (w.status !== 'shown') return '';
  if (w.endorsed) return `<span class="tag tag-endorsed">badge${w.badge_override ? ' (ภัณฑารักษ์)' : ''}</span>`;
  if (w.review_result === 'needs_curator') return '<span class="tag tag-needs">ให้ภัณฑารักษ์ตัดสิน</span>';
  return `<span class="tag">${esc(RESULT_TH[w.review_result] || '')}</span>`;
}

// ------------------------------------------------------------------ overview
async function loadOverview() {
  const d = await api(M);
  S.ex = d.exhibition;
  S.counts = d.counts;
  S.headingFonts = d.headingFonts;
  document.title = `จัดการ: ${S.ex.title_th}`;
  $('ex-title').textContent = S.ex.title_th;
  $('ex-sub').textContent = `/e/${S.ex.slug} · ${STATUS_TH[S.ex.status]} · ${S.ex.submission.open ? 'กำลังเปิดรับผลงาน' : S.ex.submission.reason}`;
  $('view-public').href = `/e/${encodeURIComponent(S.ex.slug)}`;
  const quota = S.ex.storage_quota_bytes || 1;
  $('stats').innerHTML = `
    <div class="stat"><b>${d.counts.submitted}</b><span>รอคัดกรอง</span></div>
    <div class="stat"><b>${d.counts.shown}</b><span>จัดแสดง</span></div>
    <div class="stat"><b>${d.counts.rejected}</b><span>ไม่ผ่าน</span></div>
    <div class="stat"><b>${d.counts.endorsed}</b><span>ได้ badge ผู้ทรงคุณวุฒิ</span></div>
    <div class="stat"><b>${d.reviewers}/${S.ex.review_panel_size}</b><span>ผู้ทรงคุณวุฒิ${S.ex.review_is_open ? ' · เปิดพิจารณา' : ''}</span></div>
    <div class="stat"><b>${Math.round((S.ex.storage_bytes / quota) * 100)}%</b><span>พื้นที่รูป ${bytes(S.ex.storage_bytes)}</span></div>`;
}

// ------------------------------------------------------------------ works (phase 1)
async function loadWorks() {
  const d = await api(`${M}/works?status=all`);
  S.works = d.works;
  renderWorks();
}

function visibleWorks() {
  const q = S.q.trim().toLowerCase();
  return S.works.filter((w) => (S.status === 'all' || w.status === S.status) &&
    (!q || [w.title_th, w.title_en, w.artist_name_th, w.artist_email].some((t) => (t || '').toLowerCase().includes(q))));
}

function renderWorks() {
  const list = visibleWorks();
  S.selected = new Set([...S.selected].filter((id) => list.some((w) => w.id === id)));
  $('sel-count').textContent = S.selected.size ? `(เลือก ${S.selected.size})` : '';
  $('sel-all').checked = list.length > 0 && S.selected.size === list.length;
  $('w-grid').innerHTML = list.map((w) => `
    <article class="wcard ${S.selected.has(w.id) ? 'selected' : ''}">
      <button class="thumb" data-open="${w.id}" aria-label="เปิดรายละเอียด ${esc(w.title_th)}"><img src="${esc(img(w.image_url, 400))}" alt="" loading="lazy"></button>
      <div class="body">
        <div class="t">${esc(w.title_th)}</div>
        <div class="small muted">${esc([w.academic_title_th, w.artist_name_th].filter(Boolean).join(' '))}</div>
        <div class="small muted">${esc(w.technique_th)}${w.dimensions ? ` · ${esc(w.dimensions)}` : ''}</div>
        <div class="row">${statusTag(w)} ${reviewTag(w)}
          ${w.status === 'shown' ? `<span class="small muted">✓${w.approvals} ✕${w.rejections} –${w.abstentions}</span>` : ''}</div>
      </div>
      <div class="foot">
        <label class="sel"><input type="checkbox" data-sel="${w.id}" ${S.selected.has(w.id) ? 'checked' : ''}> เลือก</label>
        ${w.status !== 'shown' ? `<button class="btn btn-sm" data-quick="shown" data-id="${w.id}">จัดแสดง</button>` : ''}
        ${w.status !== 'rejected' ? `<button class="btn btn-danger btn-sm" data-quick="rejected" data-id="${w.id}">ไม่ผ่าน</button>` : ''}
      </div>
    </article>`).join('') || '<p class="muted">ไม่มีผลงานในหมวดนี้</p>';
}

async function setStatus(ids, status) {
  await api(`${M}/works`, { method: 'POST', body: { ids, status } });
  toast(`อัปเดต ${ids.length} ผลงานแล้ว`, 'ok');
  S.selected.clear();
  await Promise.all([loadWorks(), loadOverview()]);
}

function workEditor(w) {
  const f = (k, label, v = w[k], type = 'text') => `<div class="field"><label for="we-${k}">${label}</label><input id="we-${k}" type="${type}" value="${esc(v)}"></div>`;
  openDrawer(w.title_th, `
    <img src="${esc(img(w.image_url, 1200))}" alt="" style="max-height:52vh;margin:0 auto 12px;display:block">
    <div class="row" style="margin-bottom:16px"><button class="btn btn-ghost btn-sm" type="button" id="we-replace">เปลี่ยนภาพ</button>
      <span class="small muted">${w.image_width ? `${w.image_width}×${w.image_height} px · ` : ''}${bytes(w.image_bytes)}</span></div>
    <form id="we-form">
      <div class="grid-2">
        <div class="field"><label for="we-status">ผลคัดกรอง (ระยะที่ 1)</label><select id="we-status">
          <option value="submitted">รอคัดกรอง</option><option value="shown">ผ่าน → จัดแสดง</option><option value="rejected">ไม่ผ่าน</option></select></div>
        <div class="field"><label for="we-override">badge ผู้ทรงคุณวุฒิ</label><select id="we-override">
          <option value="">ตามผลโหวต (${esc(RESULT_TH[w.review_result])})</option>
          <option value="endorsed">ภัณฑารักษ์ให้ badge</option><option value="not_endorsed">ภัณฑารักษ์ไม่ให้ badge</option></select>
          <span class="hint">ใช้เมื่อผลเป็น "ให้ภัณฑารักษ์ตัดสิน"</span></div>
      </div>
      <h3>ผลงาน</h3>
      <div class="grid-2">${f('title_th', 'ชื่อผลงาน')}${f('title_en', 'ชื่อภาษาอังกฤษ')}${f('technique_th', 'เทคนิค')}${f('technique_en', 'เทคนิคภาษาอังกฤษ')}
        ${f('dimensions', 'ขนาด')}${f('year_created', 'ปีที่สร้าง')}${f('zone', 'โซน')}${f('display_order', 'ลำดับการแสดง', w.display_order, 'number')}</div>
      <div class="field"><label for="we-concept_th">แนวคิด</label><textarea id="we-concept_th">${esc(w.concept_th)}</textarea></div>
      <div class="field"><label for="we-concept_en">แนวคิดภาษาอังกฤษ</label><textarea id="we-concept_en">${esc(w.concept_en)}</textarea></div>
      <h3>ศิลปิน</h3>
      <div class="grid-2">
        ${f('a-name_th', 'ชื่อ', w.artist_name_th)}${f('a-name_en', 'ชื่อภาษาอังกฤษ', w.artist_name_en)}
        ${f('a-academic_title_th', 'ตำแหน่งทางวิชาการ', w.academic_title_th)}${f('a-affiliation', 'สังกัด', w.affiliation)}
        ${f('a-email', 'อีเมล', w.artist_email, 'email')}${f('a-phone', 'โทรศัพท์', w.artist_phone)}</div>
      <p class="small muted">ส่งเมื่อ ${esc(thDate(w.created_at.replace(' ', 'T') + 'Z', true))}</p>
      <div class="row"><button class="btn" type="submit">บันทึก</button>
        <button class="btn btn-danger" type="button" id="we-delete">ลบผลงาน</button> <span class="error-text" id="we-err"></span></div>
    </form>`);
  $('we-status').value = w.status;
  $('we-override').value = w.badge_override || '';
  const val = (k) => $(`we-${k}`).value;
  $('we-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api(`${M}/works/${w.id}`, {
        method: 'PUT',
        body: {
          status: val('status'), badge_override: val('override') || null,
          title_th: val('title_th'), title_en: val('title_en'), technique_th: val('technique_th'), technique_en: val('technique_en'),
          dimensions: val('dimensions'), year_created: val('year_created'), zone: val('zone'), display_order: Number(val('display_order') || 0),
          concept_th: val('concept_th'), concept_en: val('concept_en'),
          artist: { name_th: val('a-name_th'), name_en: val('a-name_en'), academic_title_th: val('a-academic_title_th'),
            affiliation: val('a-affiliation'), email: val('a-email'), phone: val('a-phone') }
        }
      });
      toast('บันทึกแล้ว', 'ok');
      closeDrawer();
      await Promise.all([loadWorks(), loadOverview()]);
    } catch (err) { $('we-err').textContent = err.message; }
  });
  $('we-delete').addEventListener('click', async () => {
    if (!confirm(`ลบ "${w.title_th}" และไฟล์ภาพ? กู้คืนไม่ได้`)) return;
    try {
      await api(`${M}/works/${w.id}`, { method: 'DELETE' });
      toast('ลบแล้ว', 'ok');
      closeDrawer();
      await Promise.all([loadWorks(), loadOverview()]);
    } catch (err) { $('we-err').textContent = err.message; }
  });
  $('we-replace').addEventListener('click', () => pickImage(async (file) => {
    try {
      toast('กำลังอัปโหลด…');
      const r = await uploadFor('work', file, () => {});
      await api(`${M}/works/${w.id}`, { method: 'PUT', body: { file_id: r.fileId } });
      toast('เปลี่ยนภาพแล้ว', 'ok');
      closeDrawer();
      await loadWorks();
    } catch (err) { toast(err.message, 'error'); }
  }));
}

// ------------------------------------------------------------------ panel (phase 2)
async function loadPanel() {
  const d = await api(`${M}/reviewers`);
  S.reviewers = d.reviewers;
  S.shownWorks = d.shownWorks;
  const ex = S.ex;
  $('rs-panel').value = ex.review_panel_size;
  $('rs-threshold').value = ex.review_threshold;
  $('rs-deadline').value = toLocalInput(ex.review_deadline);
  $('rs-open').checked = !!ex.review_open;
  $('rs-blind').checked = !!ex.review_blind;
  $('rs-badge').value = ex.badge_label_th;
  $('rs-badge-en').value = ex.badge_label_en;
  $('rv-rows').innerHTML = S.reviewers.map((r) => `
    <tr>
      <td><strong>${esc(r.name)}</strong>${r.active ? '' : ' <span class="tag">ปิดใช้งาน</span>'}<div class="small muted">${esc(r.title)}${r.email ? ` · ${esc(r.email)}` : ''}</div></td>
      <td>${r.voted} / ${S.shownWorks}<div class="meter" style="width:140px"><span style="width:${S.shownWorks ? Math.round((r.voted / S.shownWorks) * 100) : 0}%"></span></div></td>
      <td class="small">${r.last_seen_at ? esc(thDate(r.last_seen_at.replace(' ', 'T') + 'Z', true)) : '<span class="muted">ยังไม่เปิด</span>'}</td>
      <td><div class="row">
        <button class="btn btn-ghost btn-sm" data-rv-link="${r.id}">ออกลิงก์ใหม่</button>
        <button class="btn ${r.active ? 'btn-danger' : 'btn-ghost'} btn-sm" data-rv-active="${r.id}" data-on="${r.active ? 0 : 1}">${r.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}</button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="4" class="muted">ยังไม่มีผู้ทรงคุณวุฒิ</td></tr>';
}

function showLink(name, link) {
  $('ra-link').hidden = false;
  $('ra-link').innerHTML = `<div class="card" style="background:#fffbe8;border-color:#ecd98d;margin:16px 0 0">
    <p style="margin-top:0"><strong>ลิงก์สำหรับ ${esc(name)}</strong> — แสดงครั้งเดียว คัดลอกไปส่งทาง LINE หรืออีเมล</p>
    <div class="linkbox"><span>${esc(link)}</span><button class="btn btn-ghost btn-sm" type="button" data-copy="${esc(link)}">คัดลอก</button></div>
    <p class="hint">ถ้าลิงก์หลุดหรือส่งผิดคน กด "ออกลิงก์ใหม่" ลิงก์เดิมจะใช้ไม่ได้ทันที</p></div>`;
  $('ra-link').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ------------------------------------------------------------------ results
let resultRows = [];
async function loadResults() {
  const d = await api(`${M}/results`);
  const rv = d.reviewers;
  const vote = new Map(d.votes.map((v) => [`${v.work_id}:${v.reviewer_id}`, v]));
  const endorsed = d.works.filter((w) => w.endorsed).length;
  $('res-summary').innerHTML = `เกณฑ์ <strong>${d.threshold} ใน ${d.panelSize}</strong> · ได้ badge <strong>${endorsed}</strong> จาก ${d.works.length} ผลงานที่จัดแสดง`;
  resultRows = d.works.map((w) => [w.id, w.title_th, w.artist_name_th, ...rv.map((r) => (vote.get(`${w.id}:${r.id}`) || {}).decision || ''), RESULT_TH[w.review_result], w.endorsed ? 'ได้ badge' : '']);
  resultRows.unshift(['id', 'ผลงาน', 'ศิลปิน', ...rv.map((r) => r.name), 'ผลโหวต', 'badge']);
  $('res-table').innerHTML = `<thead><tr><th>ผลงาน</th>${rv.map((r) => `<th title="${esc(r.name)}">${esc(r.name)}${r.active ? '' : ' (ปิด)'}</th>`).join('')}<th>ผล</th></tr></thead>
    <tbody>${d.works.map((w) => `<tr>
      <td><div class="row" style="flex-wrap:nowrap"><img src="${esc(img(w.image_url, 120))}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:4px">
        <div><strong>${esc(w.title_th)}</strong><div class="small muted">${esc(w.artist_name_th)}</div></div></div></td>
      ${rv.map((r) => { const v = vote.get(`${w.id}:${r.id}`); return `<td title="${esc(v && v.comment ? v.comment : '')}" style="text-align:center">${v ? DECISION[v.decision] : '<span class="muted">·</span>'}${v && v.comment ? '<sup class="muted">*</sup>' : ''}</td>`; }).join('')}
      <td>${reviewTag({ ...w, status: 'shown' })}</td></tr>`).join('') || `<tr><td colspan="${rv.length + 2}" class="muted">ยังไม่มีผลงานที่จัดแสดง</td></tr>`}</tbody>`;
}

function downloadCsv() {
  const csv = resultRows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${slug}-results.csv`;
  a.click();
}

// ------------------------------------------------------------------ settings
function fillSettings() {
  const ex = S.ex;
  for (const k of ['title_th', 'title_en', 'subtitle_th', 'subtitle_en', 'venue', 'statement_th', 'statement_en']) $(`s-${k}`).value = ex[k] || '';
  $('s-status').innerHTML = ['draft', 'open', 'closed'].concat(ex.status === 'archived' ? ['archived'] : [])
    .map((k) => `<option value="${k}" ${k === ex.status ? 'selected' : ''}>${STATUS_TH[k]}</option>`).join('');
  $('s-starts_on').value = ex.starts_on || '';
  $('s-ends_on').value = ex.ends_on || '';
  $('s-opens').value = toLocalInput(ex.submission_opens_at);
  $('s-closes').value = toLocalInput(ex.submission_closes_at);
  $('s-max').value = ex.max_works_per_artist;
  $('sub-state').textContent = ex.submission.open ? 'ขณะนี้เปิดรับผลงานอยู่' : `ขณะนี้ไม่รับผลงาน: ${ex.submission.reason}`;
  $('s-layout').value = ex.layout;
  const o = ex.theme_overrides || {};
  $('s-font').innerHTML = S.headingFonts.map((f) => `<option value="${esc(f)}">${f ? esc(f) : 'ตามธีม'}</option>`).join('');
  $('s-font').value = o.headingFont || '';
  $('s-ornament').value = o.ornament || 'light';
  $('s-accent').value = o.accent || '';
  if (o.accent) $('s-accent-pick').value = o.accent;
  renderPresets(ex.theme_preset);
  $('hero-img').hidden = !ex.hero_url;
  $('hero-remove').hidden = !ex.hero_url;
  if (ex.hero_url) $('hero-img').src = img(ex.hero_url, 400);
  const pct = Math.min(100, Math.round((ex.storage_bytes / (ex.storage_quota_bytes || 1)) * 100));
  $('storage-meter').innerHTML = `<p class="small">${ex.has_private_key ? `เชื่อมต่อแล้ว: <strong>${esc(ex.imagekit_url_endpoint)}</strong>` : '<strong>ยังไม่ได้เชื่อมต่อ</strong> — ต้องตั้งค่าก่อนเปิดรับผลงาน'}</p>
    <div class="meter ${pct > 90 ? 'bad' : pct > 75 ? 'warn' : ''}"><span style="width:${pct}%"></span></div>
    <p class="small muted">ใช้ไป ${bytes(ex.storage_bytes)} จากโควตา ${bytes(ex.storage_quota_bytes)} (แผนฟรี ImageKit เก็บได้ 5 GB)</p>`;
  $('ik-url').value = ex.imagekit_url_endpoint || '';
  $('ik-pub').value = ex.imagekit_public_key || '';
}

let chosenPreset = '';
function renderPresets(current) {
  chosenPreset = current;
  $('presets').innerHTML = PRESETS.map((p) => `
    <button type="button" class="preset" data-preset="${p.key}" aria-pressed="${p.key === current}">
      <div class="sw">${p.sw.map((c) => `<span style="background:${c}"></span>`).join('')}</div>${esc(p.th)}</button>`).join('');
}

async function saveSettings(e) {
  e.preventDefault();
  $('set-err').textContent = '';
  const v = (id) => $(id).value;
  try {
    await api(M, {
      method: 'PUT',
      body: {
        title_th: v('s-title_th'), title_en: v('s-title_en'), subtitle_th: v('s-subtitle_th'), subtitle_en: v('s-subtitle_en'),
        venue: v('s-venue'), statement_th: v('s-statement_th'), statement_en: v('s-statement_en'), status: v('s-status'),
        starts_on: v('s-starts_on'), ends_on: v('s-ends_on'),
        submission_opens_at: fromLocalInput(v('s-opens')), submission_closes_at: fromLocalInput(v('s-closes')),
        max_works_per_artist: Number(v('s-max') || 3),
        theme_preset: chosenPreset, layout: v('s-layout'),
        theme_overrides: { accent: v('s-accent').trim(), headingFont: v('s-font'), ornament: v('s-ornament') }
      }
    });
    toast('บันทึกการตั้งค่าแล้ว', 'ok');
    await loadOverview();
    fillSettings();
  } catch (err) { $('set-err').textContent = err.message; }
}

// ------------------------------------------------------------------ wiring
async function onTab(tab) {
  try {
    if (tab === 'works') await loadWorks();
    if (tab === 'panel') await loadPanel();
    if (tab === 'results') await loadResults();
    if (tab === 'settings') fillSettings();
  } catch (e) { toast(e.message, 'error'); }
}

document.addEventListener('click', async (e) => {
  const t = e.target;
  const copy = t.closest('[data-copy]');
  if (copy) { toast((await copyText(copy.dataset.copy)) ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกไม่ได้ กรุณาเลือกข้อความเอง'); return; }
  const filt = t.closest('#w-filter [data-status]');
  if (filt) {
    S.status = filt.dataset.status;
    document.querySelectorAll('#w-filter [data-status]').forEach((b) => b.setAttribute('aria-pressed', String(b === filt)));
    document.querySelectorAll('#w-filter [data-status]').forEach((b) => b.classList.toggle('btn-ghost', b !== filt));
    renderWorks();
    return;
  }
  const open = t.closest('[data-open]');
  if (open) { workEditor(S.works.find((w) => w.id === Number(open.dataset.open))); return; }
  const quick = t.closest('[data-quick]');
  if (quick) { try { await setStatus([Number(quick.dataset.id)], quick.dataset.quick); } catch (err) { toast(err.message, 'error'); } return; }
  const bulk = t.closest('[data-bulk]');
  if (bulk) {
    if (!S.selected.size) { toast('ยังไม่ได้เลือกผลงาน'); return; }
    try { await setStatus([...S.selected], bulk.dataset.bulk); } catch (err) { toast(err.message, 'error'); }
    return;
  }
  const preset = t.closest('[data-preset]');
  if (preset) { renderPresets(preset.dataset.preset); return; }
  const rl = t.closest('[data-rv-link]');
  if (rl) {
    const r = S.reviewers.find((x) => x.id === Number(rl.dataset.rvLink));
    if (!confirm(`ออกลิงก์ใหม่ให้ ${r.name}? ลิงก์เดิมจะใช้ไม่ได้ทันที`)) return;
    try { const d = await api(`${M}/reviewers/${r.id}`, { method: 'PUT', body: { new_link: true } }); showLink(r.name, d.link); }
    catch (err) { toast(err.message, 'error'); }
    return;
  }
  const ra = t.closest('[data-rv-active]');
  if (ra) {
    try { await api(`${M}/reviewers/${ra.dataset.rvActive}`, { method: 'PUT', body: { active: ra.dataset.on === '1' } }); await loadPanel(); await loadOverview(); }
    catch (err) { toast(err.message, 'error'); }
  }
});
document.addEventListener('change', (e) => {
  const sel = e.target.closest('[data-sel]');
  if (sel) {
    const id = Number(sel.dataset.sel);
    if (sel.checked) S.selected.add(id); else S.selected.delete(id);
    renderWorks();
  }
});
$('sel-all').addEventListener('change', (e) => {
  S.selected = e.target.checked ? new Set(visibleWorks().map((w) => w.id)) : new Set();
  renderWorks();
});
$('w-q').addEventListener('input', (e) => { S.q = e.target.value; renderWorks(); });
$('res-csv').addEventListener('click', downloadCsv);
$('set-form').addEventListener('submit', saveSettings);
$('s-accent-pick').addEventListener('input', (e) => { $('s-accent').value = e.target.value; });
$('s-accent-clear').addEventListener('click', () => { $('s-accent').value = ''; });
$('rv-settings').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api(M, {
      method: 'PUT',
      body: {
        review_panel_size: Number($('rs-panel').value), review_threshold: Number($('rs-threshold').value),
        review_deadline: fromLocalInput($('rs-deadline').value), review_open: $('rs-open').checked, review_blind: $('rs-blind').checked,
        badge_label_th: $('rs-badge').value, badge_label_en: $('rs-badge-en').value
      }
    });
    toast('บันทึกกติกาแล้ว', 'ok');
    await loadOverview();
    await loadPanel();
  } catch (err) { toast(err.message, 'error'); }
});
$('rv-add').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('ra-err').textContent = '';
  try {
    const d = await api(`${M}/reviewers`, { method: 'POST', body: { name: $('ra-name').value, title: $('ra-title').value, email: $('ra-email').value } });
    showLink(d.reviewer.name, d.link);
    e.target.reset();
    await loadPanel();
    await loadOverview();
  } catch (err) { $('ra-err').textContent = err.message; }
});
$('ik-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('ik-err').textContent = '';
  try {
    await api(`${M}/imagekit`, { method: 'PUT', body: { url_endpoint: $('ik-url').value.trim(), public_key: $('ik-pub').value.trim(), private_key: $('ik-priv').value.trim() } });
    $('ik-priv').value = '';
    toast('เชื่อมต่อ ImageKit แล้ว', 'ok');
    await loadOverview();
    fillSettings();
  } catch (err) { $('ik-err').textContent = err.message; }
});
$('hero-pick').addEventListener('click', () => pickImage(async (file) => {
  try {
    $('hero-state').textContent = 'กำลังอัปโหลด…';
    const r = await uploadFor('hero', file, (p) => { $('hero-state').textContent = `กำลังอัปโหลด ${p}%`; });
    await api(`${M}/hero`, { method: 'PUT', body: { file_id: r.fileId } });
    $('hero-state').textContent = '';
    toast('เปลี่ยนภาพปกแล้ว', 'ok');
    await loadOverview();
    fillSettings();
  } catch (err) { $('hero-state').textContent = ''; toast(err.message, 'error'); }
}));
$('hero-remove').addEventListener('click', async () => {
  await api(`${M}/hero`, { method: 'PUT', body: { file_id: '' } });
  await loadOverview();
  fillSettings();
});

async function main() {
  await requireLogin();
  try {
    await loadOverview();
  } catch (e) {
    $('ex-title').textContent = 'เปิดนิทรรศการนี้ไม่ได้';
    $('ex-sub').textContent = e.message;
    document.querySelector('.tabs').hidden = true;
    return;
  }
  tabs($('tabs'), onTab);
}
main().catch(() => {});
