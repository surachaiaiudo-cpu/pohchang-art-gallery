// /manage/<slug>/captions - printed wall captions (9 x 5.5 cm, 10 per A4), browser print.
import { api, esc, img, toast, slugFromPath } from './core.js';
import { checkImageFile, uploadImage, fitForUpload } from './upload.js';
import { requireLogin } from './backoffice.js';
import { flagUrl } from './countries.js';
import {
  CAPTION_LANGS, LANG_TH, CAPTION_FIELDS, DEFAULT_FIELDS, CAPTION_ORDERS,
  normLangs, captionContent, sortWorks, paginate, PER_SHEET
} from './caption-text.js';

const slug = slugFromPath(1);
const M = `/api/manage/${encodeURIComponent(slug)}`;
const $ = (id) => document.getElementById(id);
const KEY = `captions:${slug}`;
const S = {
  ex: null, works: [], excluded: new Set(), q: '',
  o: { main: 'th', extra: ['en'], fields: { ...DEFAULT_FIELDS }, status: 'shown', cat: '', order: 'display', skip: 0 }
};

// Settings are remembered per exhibition in this browser only (a convenience).
try { Object.assign(S.o, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* storage unavailable */ }
S.o.fields = { ...DEFAULT_FIELDS, ...(S.o.fields || {}) };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S.o)); } catch { /* ignore */ } };

const pickName = (w) => w.artist_name_th || w.artist_name_en || w.artist_name_zh || '';
const pickTitle = (w) => w.title_th || w.title_en || w.title_zh || '';

function renderOptions() {
  $('o-main').innerHTML = CAPTION_LANGS.map((l) => `<option value="${l}"${l === S.o.main ? ' selected' : ''}>${LANG_TH[l]}</option>`).join('');
  $('o-extra').innerHTML = CAPTION_LANGS.filter((l) => l !== S.o.main).map((l) => `<label>
    <input type="checkbox" value="${l}"${S.o.extra.includes(l) ? ' checked' : ''}> ${LANG_TH[l]}</label>`).join('');
  $('o-fields').innerHTML = CAPTION_FIELDS.map((f) => `<label>
    <input type="checkbox" value="${f.key}"${S.o.fields[f.key] ? ' checked' : ''}> ${esc(f.label)}</label>`).join('');
  $('o-order').innerHTML = CAPTION_ORDERS.map((x) => `<option value="${x.key}"${x.key === S.o.order ? ' selected' : ''}>${esc(x.label)}</option>`).join('');
  $('o-skip').innerHTML = Array.from({ length: PER_SHEET }, (_, i) => `<option value="${i}"${i === S.o.skip ? ' selected' : ''}>ช่องที่ ${i + 1}${i ? ` (เว้น ${i} ช่องแรก)` : ''}</option>`).join('');
  $('o-status').value = S.o.status;
}

function renderCats() {
  const cats = [...new Set(S.works.map((w) => w.category).filter(Boolean))];
  if (S.o.cat && !cats.includes(S.o.cat)) S.o.cat = '';
  $('o-cat').innerHTML = `<option value="">ทุกกลุ่มงาน</option>${cats.map((c) => `<option${c === S.o.cat ? ' selected' : ''}>${esc(c)}</option>`).join('')}`;
}

// Works in the current filter, in print order.
const pool = () => sortWorks(S.works.filter((w) => !S.o.cat || w.category === S.o.cat), S.o.order, S.o.main);
const chosen = () => pool().filter((w) => !S.excluded.has(w.id));

function renderList() {
  const q = S.q.trim().toLowerCase();
  const items = pool();
  const shown = q ? items.filter((w) => [w.title_th, w.title_en, w.title_zh, w.artist_name_th, w.artist_name_en, w.artist_name_zh]
    .some((x) => String(x || '').toLowerCase().includes(q))) : items;
  $('o-list').innerHTML = shown.length ? shown.map((w) => `<li><label>
      <input type="checkbox" data-id="${w.id}"${S.excluded.has(w.id) ? '' : ' checked'}>
      <span>${esc(pickTitle(w))}<span class="muted">${esc(pickName(w))}${w.status !== 'shown' ? ` · ${w.status === 'submitted' ? 'รอคัดกรอง' : 'ไม่ผ่าน'}` : ''}</span></span>
    </label></li>`).join('') : '<li class="small muted" style="padding:8px">ไม่มีผลงาน</li>';
  $('o-count').textContent = `(${chosen().length} / ${items.length})`;
}

function captionHtml(w) {
  const c = captionContent(w, { langs: normLangs(S.o.main, S.o.extra), fields: S.o.fields, techniques: S.ex.techniques || [] });
  const [a0, ...ax] = c.artists;
  const [t0, ...tx] = c.titles;
  const flag = c.flag ? `<img src="${esc(flagUrl(c.flag))}" alt="">` : '';
  const logo = S.ex.caption_logo_url
    ? `<img src="${esc(img(S.ex.caption_logo_url, 800))}" alt="">`
    : '<span class="cap-logo-ph">โลโก้</span>';
  return `<div class="cap" data-id="${w.id}">
    <div class="cap-logo">${logo}</div>
    <div class="cap-body"><div class="cap-in">
      ${a0 ? `<div class="cap-artist">${esc(a0)}</div>` : ''}
      ${ax.map((x) => `<div class="cap-artist-x">${esc(x)}</div>`).join('')}
      ${c.place || flag ? `<div class="cap-place">${flag}${esc(c.place)}</div>` : ''}
      ${t0 ? `<div class="cap-title">${esc(t0)}</div>` : ''}
      ${tx.map((x) => `<div class="cap-title-x">${esc(x)}</div>`).join('')}
      ${c.meta.map((x) => `<div class="cap-meta">${esc(x)}</div>`).join('')}
    </div></div>
  </div>`;
}

// Shrinks the text of a caption step by step until it fits (not below 65 %); marks the rest.
function fit(cap) {
  const inner = cap.querySelector('.cap-in');
  let s = 1;
  cap.style.setProperty('--s', s);
  while (inner.scrollHeight > inner.clientHeight + 1 && s > 0.65) {
    s = Math.round((s - 0.05) * 100) / 100;
    cap.style.setProperty('--s', s);
  }
  const over = inner.scrollHeight > inner.clientHeight + 1;
  cap.classList.toggle('overflow', over);
  return { over, shrunk: s < 1 };
}

function renderSheets() {
  const works = chosen();
  const sheets = works.length ? paginate(works, S.o.skip) : [];
  $('sheets').innerHTML = sheets.map((cells, i) => `<div class="sheet">
      <div class="grid">${cells.map((x) => (x ? captionHtml(x) : '<div class="cap empty"></div>')).join('')}</div>
      <div class="sheet-no">${esc(slug)} · แผ่น ${i + 1}/${sheets.length}</div>
    </div>`).join('');
  $('print').disabled = !works.length;
  requestAnimationFrame(() => {
    let over = 0; let shrunk = 0;
    document.querySelectorAll('#sheets .cap:not(.empty)').forEach((cap) => { const r = fit(cap); over += r.over; shrunk += r.shrunk; });
    $('status').innerHTML = works.length
      ? `${works.length} ป้าย · ${sheets.length} แผ่น A4${shrunk ? ` · ย่อตัวอักษรอัตโนมัติ ${shrunk} ป้าย` : ''}${over
        ? ` · <span class="warn">ข้อความยาวเกินป้าย ${over} ป้าย (กรอบแดง) — ลองปิดภาษาหรือข้อมูลบางอย่าง</span>` : ''}`
      : 'ยังไม่ได้เลือกผลงาน';
  });
}

const LOGO_HINT = 'PNG พื้นใส หรือ JPG · พื้นที่โลโก้บนป้ายประมาณ 2.1 × 4.9 ซม. · เก็บไว้กับนิทรรศการนี้';
function renderLogo() {
  const url = S.ex.caption_logo_url;
  $('logo-img').hidden = !url;
  $('logo-none').hidden = !!url;
  $('logo-remove').hidden = !url;
  if (url) $('logo-img').src = img(url, 400);
}
async function uploadLogo(file) {
  const problem = checkImageFile(file);
  if (problem) { toast(problem, 'error'); return; }
  const state = $('logo-state');
  try {
    state.textContent = 'กำลังอัปโหลด…';
    const { upload } = await api(`${M}/upload-auth`, { method: 'POST', body: { kind: 'logo' } });
    const fitted = await fitForUpload(file, upload.maxBytes, upload.maxPixels);
    const r = await uploadImage(fitted.file, upload, (p) => { state.textContent = `กำลังอัปโหลด ${p}%`; });
    const d = await api(`${M}/caption-logo`, { method: 'PUT', body: { file: r } });
    S.ex.caption_logo_url = d.caption_logo_url;
    renderLogo(); renderSheets();
    toast('บันทึกโลโก้แล้ว', 'ok');
  } catch (err) { toast(err.message, 'error'); }
  state.textContent = LOGO_HINT;
}

const refresh = () => { save(); renderList(); renderSheets(); };

async function loadWorks() {
  const d = await api(`${M}/works?status=${S.o.status === 'all' ? 'all' : 'shown'}`);
  S.works = d.works || [];
  S.excluded = new Set();
  renderCats();
  refresh();
}

function bind() {
  $('o-main').addEventListener('change', (e) => {
    S.o.main = e.target.value;
    S.o.extra = S.o.extra.filter((l) => l !== S.o.main);
    renderOptions(); refresh();
  });
  $('o-extra').addEventListener('change', () => {
    S.o.extra = [...$('o-extra').querySelectorAll('input:checked')].map((x) => x.value);
    refresh();
  });
  $('o-fields').addEventListener('change', () => {
    $('o-fields').querySelectorAll('input').forEach((x) => { S.o.fields[x.value] = x.checked; });
    refresh();
  });
  $('o-status').addEventListener('change', (e) => { S.o.status = e.target.value; save(); loadWorks().catch((err) => toast(err.message, 'error')); });
  $('o-cat').addEventListener('change', (e) => { S.o.cat = e.target.value; refresh(); });
  $('o-order').addEventListener('change', (e) => { S.o.order = e.target.value; refresh(); });
  $('o-skip').addEventListener('change', (e) => { S.o.skip = Number(e.target.value) || 0; refresh(); });
  $('o-q').addEventListener('input', (e) => { S.q = e.target.value; renderList(); });
  $('o-list').addEventListener('change', (e) => {
    const id = Number(e.target.dataset.id);
    if (!id) return;
    if (e.target.checked) S.excluded.delete(id); else S.excluded.add(id);
    renderList(); renderSheets();
  });
  $('sel-all').addEventListener('click', () => { S.excluded.clear(); renderList(); renderSheets(); });
  $('sel-none').addEventListener('click', () => { pool().forEach((w) => S.excluded.add(w.id)); renderList(); renderSheets(); });
  $('print').addEventListener('click', () => window.print());
  $('logo-pick').addEventListener('click', () => { $('logo-file').value = ''; $('logo-file').click(); });
  $('logo-file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) uploadLogo(f); });
  $('logo-remove').addEventListener('click', async () => {
    if (!confirm('ลบโลโก้ของนิทรรศการนี้?')) return;
    try {
      await api(`${M}/caption-logo`, { method: 'PUT', body: { file: null } });
      S.ex.caption_logo_url = '';
      renderLogo(); renderSheets();
      toast('ลบโลโก้แล้ว', 'ok');
    } catch (err) { toast(err.message, 'error'); }
  });
}

(async function init() {
  await requireLogin();
  $('back').href = `/manage/${encodeURIComponent(slug)}`;
  try {
    const d = await api(M);
    S.ex = d.exhibition;
    $('ex-sub').textContent = S.ex.title_th || S.ex.title_en || slug;
    document.title = `ป้าย caption · ${$('ex-sub').textContent}`;
  } catch (err) {
    $('ex-sub').textContent = err.message;
    return;
  }
  if (!CAPTION_LANGS.includes(S.o.main)) S.o.main = 'th';
  if (!CAPTION_ORDERS.some((x) => x.key === S.o.order)) S.o.order = 'display';
  S.o.skip = Math.max(0, Math.min(PER_SHEET - 1, Number(S.o.skip) || 0));
  renderOptions();
  renderLogo();
  bind();
  // Wait for the Thai font so the fitting is measured with the real glyphs.
  try { await document.fonts.load('600 13pt "IBM Plex Sans Thai"'); } catch { /* ignore */ }
  await loadWorks().catch((err) => toast(err.message, 'error'));
  document.fonts.ready.then(() => renderSheets());
})();
