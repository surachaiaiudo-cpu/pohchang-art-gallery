import { api, esc, thDate, applyTheme, toast, icons, slugFromPath } from './core.js';
import { checkImageFile, uploadImage } from './upload.js';

const slug = slugFromPath(1);
const base = `/e/${encodeURIComponent(slug)}`;
let ex = null;
let ticket = '';
let maxBytes = 25 * 1024 * 1024;
const uploads = {};      // target key -> { fileId, busy }
let workSeq = 0;

const $ = (id) => document.getElementById(id);

function workBlock(n) {
  const k = `work${n}`;
  return `<fieldset class="work-block" data-key="${k}">
    <legend>ผลงานชิ้นที่ <span class="wnum"></span></legend>
    <div class="field">
      <span style="font-weight:600;font-size:.95rem" id="${k}-img-label">ภาพผลงาน <span class="req">*</span></span>
      <div class="drop" data-kind="work" data-target="${k}" tabindex="0" role="button" aria-labelledby="${k}-img-label">
        ${icons.upload}<span class="drop-text">แตะเพื่อเลือกไฟล์ภาพ (JPG, PNG, WebP ไม่เกิน 25 MB)</span>
      </div>
      <span class="hint">ใช้ไฟล์ความละเอียดสูงสำหรับพิมพ์สูจิบัตร ด้านยาวอย่างน้อย 3,000 พิกเซล</span>
    </div>
    <div class="grid-2">
      <div class="field"><label for="${k}-title_th">ชื่อผลงาน <span class="req">*</span></label><input id="${k}-title_th" type="text" maxlength="300"></div>
      <div class="field"><label for="${k}-title_en">ชื่อผลงาน (ภาษาอังกฤษ)</label><input id="${k}-title_en" type="text" maxlength="300"></div>
      <div class="field"><label for="${k}-technique_th">เทคนิค <span class="req">*</span></label><input id="${k}-technique_th" type="text" maxlength="300" placeholder="เช่น สีน้ำมันบนผ้าใบ"></div>
      <div class="field"><label for="${k}-dimensions">ขนาด</label><input id="${k}-dimensions" type="text" maxlength="120" placeholder="เช่น 80 × 120 ซม."></div>
      <div class="field"><label for="${k}-year_created">ปีที่สร้าง</label><input id="${k}-year_created" type="text" maxlength="20" placeholder="เช่น 2569"></div>
    </div>
    <div class="field"><label for="${k}-concept_th">แนวคิด</label><textarea id="${k}-concept_th" maxlength="4000"></textarea></div>
    <div class="field"><label for="${k}-concept_en">แนวคิด (ภาษาอังกฤษ)</label><textarea id="${k}-concept_en" maxlength="4000"></textarea></div>
    <p><button type="button" class="btn btn-ghost remove-work">ลบผลงานชิ้นนี้</button></p>
  </fieldset>`;
}

function renumber() {
  const blocks = [...document.querySelectorAll('.work-block')];
  blocks.forEach((b, i) => { b.querySelector('.wnum').textContent = i + 1; });
  blocks.forEach((b) => { b.querySelector('.remove-work').hidden = blocks.length === 1; });
  $('add-work').hidden = blocks.length >= ex.max_works_per_artist;
}

function addWork() {
  workSeq += 1;
  $('works').insertAdjacentHTML('beforeend', workBlock(workSeq));
  renumber();
}

async function getTicket(turnstileToken) {
  const d = await api(`/api/x/${encodeURIComponent(slug)}/ticket`, { method: 'POST', body: { turnstile: turnstileToken || '' } });
  ticket = d.ticket;
}

function setupTurnstile(siteKey) {
  return new Promise((resolve) => {
    window.onTurnstileLoad = () => {
      window.turnstile.render('#turnstile', {
        sitekey: siteKey,
        callback: async (token) => { try { await getTicket(token); resolve(); } catch (e) { toast(e.message, 'error'); } }
      });
    };
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
    s.async = true;
    document.head.appendChild(s);
  });
}

let pickTarget = null;
function openPicker(drop) {
  if (uploads[drop.dataset.target]?.busy) return;
  pickTarget = drop;
  $('picker').value = '';
  $('picker').click();
}

async function handleFile(drop, file) {
  const key = drop.dataset.target;
  const problem = checkImageFile(file, maxBytes);
  if (problem) { toast(problem, 'error'); return; }
  if (!ticket) { toast('กรุณายืนยันว่าไม่ใช่โปรแกรมอัตโนมัติก่อน', 'error'); return; }
  const preview = URL.createObjectURL(file);
  uploads[key] = { busy: true, fileId: '' };
  drop.classList.add('has-image');
  drop.innerHTML = `<img src="${preview}" alt="ภาพที่เลือก"><div class="progress" aria-label="ความคืบหน้า"><span></span></div><span class="drop-text">กำลังอัปโหลด…</span>`;
  const bar = drop.querySelector('.progress > span');
  try {
    const { upload } = await api(`/api/x/${encodeURIComponent(slug)}/upload-auth`, { method: 'POST', body: { ticket, kind: drop.dataset.kind } });
    maxBytes = upload.maxBytes || maxBytes;
    const res = await uploadImage(file, upload, (p) => { bar.style.width = `${p}%`; });
    uploads[key] = { busy: false, fileId: res.fileId };
    drop.querySelector('.drop-text').textContent = 'อัปโหลดแล้ว · แตะเพื่อเปลี่ยนรูป';
  } catch (e) {
    uploads[key] = { busy: false, fileId: '' };
    drop.classList.remove('has-image');
    drop.innerHTML = `${icons.upload}<span class="drop-text">อัปโหลดไม่สำเร็จ แตะเพื่อลองใหม่</span>`;
    toast(e.message, 'error');
    if (e.data && e.data.ticketExpired) ticket = '';
  }
}

function collect() {
  const val = (id) => ($(id) ? $(id).value.trim() : '');
  const artist = {
    name_th: val('name_th'), name_en: val('name_en'), academic_title_th: val('academic_title_th'),
    email: val('email'), phone: val('phone'), nationality: val('nationality'), affiliation: val('affiliation'),
    bio_th: val('bio_th'), avatar_file_id: uploads.avatar?.fileId || undefined
  };
  const works = [...document.querySelectorAll('.work-block')].map((b) => {
    const k = b.dataset.key;
    return {
      title_th: val(`${k}-title_th`), title_en: val(`${k}-title_en`), technique_th: val(`${k}-technique_th`),
      dimensions: val(`${k}-dimensions`), year_created: val(`${k}-year_created`),
      concept_th: val(`${k}-concept_th`), concept_en: val(`${k}-concept_en`), file_id: uploads[k]?.fileId || ''
    };
  });
  return { artist, works };
}

function validate({ artist, works }) {
  if (!artist.name_th) return ['name_th', 'กรุณากรอกชื่อ-นามสกุล'];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(artist.email)) return ['email', 'กรุณากรอกอีเมลให้ถูกต้อง'];
  const blocks = [...document.querySelectorAll('.work-block')];
  for (let i = 0; i < works.length; i++) {
    const k = blocks[i].dataset.key;
    if (uploads[k]?.busy) return [null, `ผลงานชิ้นที่ ${i + 1} ยังอัปโหลดไม่เสร็จ`];
    if (!works[i].file_id) return [null, `กรุณาอัปโหลดภาพผลงานชิ้นที่ ${i + 1}`];
    if (!works[i].title_th) return [`${k}-title_th`, `กรุณากรอกชื่อผลงานชิ้นที่ ${i + 1}`];
    if (!works[i].technique_th) return [`${k}-technique_th`, `กรุณากรอกเทคนิคของผลงานชิ้นที่ ${i + 1}`];
  }
  if (Object.values(uploads).some((u) => u.busy)) return [null, 'รอให้อัปโหลดรูปเสร็จก่อน'];
  if (!$('consent').checked) return ['consent', 'กรุณายืนยันการยินยอม'];
  return null;
}

async function onSubmit(e) {
  e.preventDefault();
  const data = collect();
  const problem = validate(data);
  $('form-error').textContent = problem ? problem[1] : '';
  if (problem) {
    if (problem[0]) $(problem[0]).focus();
    return;
  }
  $('send').disabled = true;
  $('send').textContent = 'กำลังส่ง…';
  try {
    const d = await api(`/api/x/${encodeURIComponent(slug)}/submit`, { method: 'POST', body: { ticket, consent: true, ...data } });
    $('form').hidden = true;
    $('intro').hidden = true;
    $('done').hidden = false;
    $('done-text').textContent = `ขอบคุณ ${d.name} ระบบได้รับผลงาน ${d.received} ชิ้นแล้ว ผลงานจะแสดงในนิทรรศการหลังภัณฑารักษ์ตรวจคัดเลือก`;
    $('done-back').href = base;
    window.scrollTo(0, 0);
  } catch (err) {
    $('form-error').textContent = err.message;
    if (err.data && err.data.ticketExpired) ticket = '';
  } finally {
    $('send').disabled = false;
    $('send').textContent = 'ส่งผลงาน';
  }
}

async function main() {
  try {
    const [{ exhibition }, cfg] = await Promise.all([api(`/api/x/${encodeURIComponent(slug)}`), api('/api/config')]);
    ex = exhibition;
    applyTheme(ex);
    document.title = `ส่งผลงาน — ${ex.title_th}`;
    $('back').href = base;
    $('back').textContent = `← ${ex.title_th}`;
    $('title').textContent = `ส่งผลงาน: ${ex.title_th}`;
    if (!ex.submission.open) {
      $('intro').innerHTML = `<div class="notice">${esc(ex.submission.reason)}</div><a class="btn btn-ghost" href="${base}">กลับหน้านิทรรศการ</a>`;
      return;
    }
    $('intro').innerHTML = `<div class="notice">
      <p style="margin:0">ส่งได้ไม่เกิน <strong>${ex.max_works_per_artist}</strong> ผลงานต่อคน
      ${ex.submission_closes_at ? ` · ปิดรับ <strong>${esc(thDate(ex.submission_closes_at, true))}</strong>` : ''}</p>
      <p style="margin:6px 0 0" class="muted">ภาพผลงานต้องเป็น JPG, PNG หรือ WebP ขนาดไม่เกิน 25 MB ต่อภาพ</p></div>`;
    $('form').hidden = false;
    addWork();
    if (cfg.turnstileSiteKey) setupTurnstile(cfg.turnstileSiteKey);
    else await getTicket('');
  } catch (e) {
    $('intro').innerHTML = `<p class="error-text">${esc(e.message)}</p>`;
  }
}

document.addEventListener('click', (e) => {
  const drop = e.target.closest('.drop');
  if (drop) { openPicker(drop); return; }
  if (e.target.closest('.remove-work')) {
    const b = e.target.closest('.work-block');
    delete uploads[b.dataset.key];
    b.remove();
    renumber();
  }
});
document.addEventListener('keydown', (e) => {
  const drop = e.target.closest && e.target.closest('.drop');
  if (drop && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPicker(drop); }
});
$('picker').addEventListener('change', (e) => { if (pickTarget && e.target.files[0]) handleFile(pickTarget, e.target.files[0]); });
$('add-work').addEventListener('click', addWork);
$('form').addEventListener('submit', onSubmit);
main();
