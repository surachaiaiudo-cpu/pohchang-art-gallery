// /manage/<slug>/captions - printed wall captions (9 x 5.5 cm, 10 per A4), browser print.
// Design (languages, fields, font sizes, logo position, template) is saved with the exhibition;
// print-run choices (status, category, order, start slot, selection) stay in this browser.
import { api, esc, img, toast, slugFromPath } from './core.js';
import { requireLogin } from './backoffice.js';
import { checkImageFile, uploadImage, fitForUpload } from './upload.js';
import { flagUrl } from './countries.js';
import {
  CAPTION_LANGS, LANG_TH, CAPTION_FIELDS, CAPTION_ORDERS, SIZE_FIELDS, PT_SIZES, EXTRA_LANG_SCALE,
  LOGO_ALIGNS, BG_AREAS, BG_ANGLES, TEXT_COLORS, UNITS, IMG_OPACITIES,
  normLangs, captionContent, sortWorks, paginate, PER_SHEET,
  normalizeCaptionSettings, captionTemplates, resolveBackground, gradientCss, textOn
} from './caption-text.js';

const slug = slugFromPath(1);
const M = `/api/manage/${encodeURIComponent(slug)}`;
const $ = (id) => document.getElementById(id);
const KEY = `captions:${slug}`;
const S = {
  ex: null, works: [], excluded: new Set(), q: '',
  d: normalizeCaptionSettings({}),
  o: { status: 'shown', cat: '', order: 'display', skip: 0 }
};

let local = {};
try { local = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { /* storage unavailable */ }
for (const k of Object.keys(S.o)) if (local[k] !== undefined) S.o[k] = local[k];
const saveLocal = () => { try { localStorage.setItem(KEY, JSON.stringify(S.o)); } catch { /* ignore */ } };

// Design changes are saved to the exhibition shortly after the last change.
let saveTimer = null;
function saveDesign() {
  clearTimeout(saveTimer);
  $('save-state').textContent = 'กำลังบันทึก…';
  saveTimer = setTimeout(async () => {
    try {
      const r = await api(`${M}/caption-settings`, { method: 'PUT', body: { settings: S.d } });
      S.d = r.settings;
      $('save-state').textContent = 'บันทึกการตั้งค่ากับนิทรรศการแล้ว (ทีมงานเห็นค่าเดียวกัน)';
    } catch (err) {
      $('save-state').textContent = `บันทึกไม่สำเร็จ: ${err.message}`;
    }
  }, 700);
}

const pickName = (w) => w.artist_name_th || w.artist_name_en || w.artist_name_zh || '';
const pickTitle = (w) => w.title_th || w.title_en || w.title_zh || '';
const opts = (list, value) => list.map((x) => `<option value="${esc(String(x.key))}"${String(x.key) === String(value) ? ' selected' : ''}>${esc(x.label)}</option>`).join('');

// ------------------------------------------------------------------ design controls
function renderDesign() {
  const d = S.d;
  $('o-main').innerHTML = CAPTION_LANGS.map((l) => `<option value="${l}"${l === d.main ? ' selected' : ''}>${LANG_TH[l]}</option>`).join('');
  $('o-extra').innerHTML = CAPTION_LANGS.filter((l) => l !== d.main).map((l) => `<label>
    <input type="checkbox" value="${l}"${d.extra.includes(l) ? ' checked' : ''}> ${LANG_TH[l]}</label>`).join('');
  $('o-fields').innerHTML = CAPTION_FIELDS.map((f) => `<label>
    <input type="checkbox" value="${f.key}"${d.fields[f.key] ? ' checked' : ''}> ${esc(f.label)}</label>`).join('');
  $('o-sizes').innerHTML = SIZE_FIELDS.map((f) => `<label><span>${esc(f.label)}</span>
    <select data-size="${f.key}">${PT_SIZES.map((n) => `<option value="${n}"${n === d.sizes[f.key] ? ' selected' : ''}>${n} pt${n === f.def ? ' (ค่าเริ่มต้น)' : ''}</option>`).join('')}</select></label>`).join('');
  $('o-unit').innerHTML = opts(UNITS, d.unit);
  document.querySelectorAll('[data-opacity]').forEach((el) => {
    el.innerHTML = IMG_OPACITIES.map((n) => `<option value="${n}"${n === d[el.dataset.opacity] ? ' selected' : ''}>${n}%</option>`).join('');
  });
  $('o-align').innerHTML = LOGO_ALIGNS.map((a) => `<button type="button" role="radio" data-align="${a.key}" aria-checked="${a.key === d.logoAlign}">${esc(a.label)}</button>`).join('');
  renderTemplates();
}

function miniPreview(bg, textChoice) {
  const ink = textOn(bg, textChoice);
  const whole = bg.area === 'whole' ? `background:${gradientCss(bg)};color:${ink}` : 'background:#fff;color:#111';
  const logo = bg.area === 'logo' ? `background:${gradientCss(bg)}` : '';
  const body = bg.area === 'details' ? `background:${gradientCss(bg)};color:${ink}` : '';
  return `<span class="tpl-mini" style="${whole}"><span class="tpl-l" style="${logo}"></span><span class="tpl-r" style="${body}"><i></i><i></i><i class="s"></i></span></span>`;
}

function renderTemplates() {
  const d = S.d;
  const tpls = captionTemplates(S.ex);
  const current = resolveBackground(d, S.ex);
  $('o-tpls').innerHTML = [...tpls.map((t) => ({ ...t, bg: t })), { id: 'custom', label: 'กำหนดเอง', bg: d.template === 'custom' ? d.bg : current }]
    .map((t) => `<button type="button" role="radio" class="tpl" data-tpl="${t.id}" aria-checked="${t.id === d.template}">
      ${miniPreview(t.bg, d.text)}<span class="tpl-name">${esc(t.label)}</span></button>`).join('');
  // The custom controls always show the colours in use, so a template can be a starting point.
  $('o-area').innerHTML = opts(BG_AREAS, current.area);
  $('o-c1').value = current.c1;
  $('o-c2').value = current.c2;
  $('o-angle').innerHTML = opts(BG_ANGLES, current.angle);
  $('o-text').innerHTML = opts(TEXT_COLORS, d.text);
}

// Any edit of the colour controls turns the choice into "custom", starting from what is shown.
function editCustom() {
  S.d.template = 'custom';
  S.d.bg = { area: $('o-area').value, c1: $('o-c1').value, c2: $('o-c2').value, angle: Number($('o-angle').value) };
  renderTemplates(); renderSheets(); saveDesign();
}

// ------------------------------------------------------------------ print options
function renderPrintOptions() {
  $('o-order').innerHTML = opts(CAPTION_ORDERS, S.o.order);
  $('o-skip').innerHTML = Array.from({ length: PER_SHEET }, (_, i) => `<option value="${i}"${i === S.o.skip ? ' selected' : ''}>ช่องที่ ${i + 1}${i ? ` (เว้น ${i} ช่องแรก)` : ''}</option>`).join('');
  $('o-status').value = S.o.status;
}

function renderCats() {
  const cats = [...new Set(S.works.map((w) => w.category).filter(Boolean))];
  if (S.o.cat && !cats.includes(S.o.cat)) S.o.cat = '';
  $('o-cat').innerHTML = `<option value="">ทุกกลุ่มงาน</option>${cats.map((c) => `<option${c === S.o.cat ? ' selected' : ''}>${esc(c)}</option>`).join('')}`;
}

// Works in the current filter, in print order.
const pool = () => sortWorks(S.works.filter((w) => !S.o.cat || w.category === S.o.cat), S.o.order, S.d.main);
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

// ------------------------------------------------------------------ captions
const bgImg = (url, opacity, width) => (url
  ? `<img class="cap-bgimg" src="${esc(img(url, width))}" alt="" style="opacity:${Number(opacity) / 100}">` : '');

// Inline styles shared by every caption of this print run (colours are validated hex values).
function captionStyles() {
  const bg = resolveBackground(S.d, S.ex);
  const ink = textOn(bg, S.d.text);
  const fill = gradientCss(bg);
  const sizes = SIZE_FIELDS.map((f) => `--fs-${f.key}:${S.d.sizes[f.key]}pt`).join(';');
  return {
    cap: `${sizes};--fs-x:${EXTRA_LANG_SCALE};${bg.area === 'whole' ? `background:${fill};color:${ink}` : 'background:#fff;color:#111'}`,
    logo: bg.area === 'logo' ? `background:${fill}` : '',
    body: bg.area === 'details' ? `background:${fill};color:${ink}` : '',
    // Background pictures are <img> (not CSS backgrounds) so they print even with "background graphics" off.
    imgLogo: bgImg(S.ex.caption_bg_logo_url, S.d.imgLogo, 600),
    imgBody: bgImg(S.ex.caption_bg_body_url, S.d.imgBody, 1200)
  };
}

function captionHtml(w, st) {
  const c = captionContent(w, { langs: normLangs(S.d.main, S.d.extra), fields: S.d.fields, techniques: S.ex.techniques || [], unit: S.d.unit });
  const [a0, ...ax] = c.artists;
  const [t0, ...tx] = c.titles;
  const flag = c.flag ? `<img src="${esc(flagUrl(c.flag))}" alt="">` : '';
  const logo = S.ex.caption_logo_url
    ? `<img class="cap-logo-img" src="${esc(img(S.ex.caption_logo_url, 800))}" alt="">`
    : '<span class="cap-logo-ph">โลโก้</span>';
  return `<div class="cap" data-id="${w.id}" style="${st.cap}">
    <div class="cap-logo" data-align="${esc(S.d.logoAlign)}" style="${st.logo}">${st.imgLogo}${logo}</div>
    <div class="cap-body" style="${st.body}">${st.imgBody}<div class="cap-in">
      ${a0 ? `<div class="cap-artist">${esc(a0)}</div>` : ''}
      ${ax.map((x) => `<div class="cap-artist-x">${esc(x)}</div>`).join('')}
      ${c.place || flag ? `<div class="cap-place">${flag}${esc(c.place)}</div>` : ''}
      ${t0 ? `<div class="cap-title">${esc(t0)}</div>` : ''}
      ${tx.map((x) => `<div class="cap-title-x">${esc(x)}</div>`).join('')}
      ${c.tech.map((x, i) => `<div class="cap-meta cap-tech${i ? ' cap-meta-x' : ''}">${esc(x)}</div>`).join('')}
      ${c.dims ? `<div class="cap-meta cap-dims">${esc(c.dims)}</div>` : ''}
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
  const st = captionStyles();
  $('sheets').innerHTML = sheets.map((cells, i) => `<div class="sheet">
      <div class="grid">${cells.map((x) => (x ? captionHtml(x, st) : '<div class="cap empty"></div>')).join('')}</div>
      <div class="sheet-no">${esc(slug)} · แผ่น ${i + 1}/${sheets.length}</div>
    </div>`).join('');
  $('print').disabled = !works.length;
  requestAnimationFrame(() => {
    let over = 0; let shrunk = 0;
    document.querySelectorAll('#sheets .cap:not(.empty)').forEach((cap) => { const r = fit(cap); over += r.over; shrunk += r.shrunk; });
    $('status').innerHTML = works.length
      ? `${works.length} ป้าย · ${sheets.length} แผ่น A4${shrunk ? ` · ย่อตัวอักษรอัตโนมัติ ${shrunk} ป้าย` : ''}${over
        ? ` · <span class="warn">ข้อความยาวเกินป้าย ${over} ป้าย (กรอบแดง) — ลองลดขนาดตัวอักษร ปิดภาษา หรือปิดข้อมูลบางอย่าง</span>` : ''}`
      : 'ยังไม่ได้เลือกผลงาน';
  });
}

// ------------------------------------------------------------------ logo
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

// ------------------------------------------------------------------ background pictures
const BG_COL = { logo: 'caption_bg_logo_url', body: 'caption_bg_body_url' };
let bgPart = null;
function renderBgImages() {
  document.querySelectorAll('.cap-bgimg-row').forEach((row) => {
    const url = S.ex[BG_COL[row.dataset.part]];
    const im = row.querySelector('.cap-bgthumb img');
    im.hidden = !url;
    row.querySelector('.cap-bgthumb span').hidden = !!url;
    row.querySelector('[data-act="remove"]').hidden = !url;
    if (url) im.src = img(url, 400);
  });
}
async function uploadBg(part, file) {
  const problem = checkImageFile(file);
  if (problem) { toast(problem, 'error'); return; }
  const state = document.querySelector(`.cap-bgimg-row[data-part="${part}"] [data-state]`);
  try {
    state.textContent = 'กำลังอัปโหลด…';
    const { upload } = await api(`${M}/upload-auth`, { method: 'POST', body: { kind: 'logo' } });
    const fitted = await fitForUpload(file, upload.maxBytes, upload.maxPixels);
    const r = await uploadImage(fitted.file, upload, (p) => { state.textContent = `กำลังอัปโหลด ${p}%`; });
    const d = await api(`${M}/caption-bg`, { method: 'PUT', body: { part, file: r } });
    S.ex[BG_COL[part]] = d.url;
    renderBgImages(); renderSheets();
    toast('บันทึกรูปพื้นหลังแล้ว', 'ok');
  } catch (err) { toast(err.message, 'error'); }
  state.textContent = '';
}

// ------------------------------------------------------------------ wiring
const refresh = () => { saveLocal(); renderList(); renderSheets(); };
const designChanged = () => { renderList(); renderSheets(); saveDesign(); };

async function loadWorks() {
  const d = await api(`${M}/works?status=${S.o.status === 'all' ? 'all' : 'shown'}`);
  S.works = d.works || [];
  S.excluded = new Set();
  renderCats();
  refresh();
}

function bind() {
  $('o-main').addEventListener('change', (e) => {
    S.d.main = e.target.value;
    S.d.extra = S.d.extra.filter((l) => l !== S.d.main);
    renderDesign(); designChanged();
  });
  $('o-extra').addEventListener('change', () => {
    S.d.extra = [...$('o-extra').querySelectorAll('input:checked')].map((x) => x.value);
    designChanged();
  });
  $('o-fields').addEventListener('change', () => {
    $('o-fields').querySelectorAll('input').forEach((x) => { S.d.fields[x.value] = x.checked; });
    designChanged();
  });
  $('o-sizes').addEventListener('change', (e) => {
    const k = e.target.dataset.size;
    if (k) { S.d.sizes[k] = Number(e.target.value); designChanged(); }
  });
  $('o-align').addEventListener('click', (e) => {
    const b = e.target.closest('[data-align]');
    if (!b) return;
    S.d.logoAlign = b.dataset.align;
    $('o-align').querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    renderSheets(); saveDesign();
  });
  $('o-tpls').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tpl]');
    if (!b) return;
    if (b.dataset.tpl === 'custom') { if (S.d.template !== 'custom') editCustom(); return; }
    S.d.template = b.dataset.tpl;
    renderTemplates(); renderSheets(); saveDesign();
  });
  ['o-area', 'o-angle', 'o-c1', 'o-c2'].forEach((id) => $(id).addEventListener('change', editCustom));
  $('o-text').addEventListener('change', (e) => { S.d.text = e.target.value; renderTemplates(); renderSheets(); saveDesign(); });

  $('o-status').addEventListener('change', (e) => { S.o.status = e.target.value; saveLocal(); loadWorks().catch((err) => toast(err.message, 'error')); });
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
  $('o-unit').addEventListener('change', (e) => { S.d.unit = e.target.value; renderSheets(); saveDesign(); });
  document.querySelectorAll('[data-opacity]').forEach((el) => el.addEventListener('change', () => {
    S.d[el.dataset.opacity] = Number(el.value); renderSheets(); saveDesign();
  }));
  document.querySelectorAll('.cap-bgimg-row').forEach((row) => {
    const part = row.dataset.part;
    row.querySelector('[data-act="pick"]').addEventListener('click', () => { bgPart = part; $('bg-file').value = ''; $('bg-file').click(); });
    row.querySelector('[data-act="remove"]').addEventListener('click', async () => {
      if (!confirm('ลบรูปพื้นหลังส่วนนี้?')) return;
      try {
        await api(`${M}/caption-bg`, { method: 'PUT', body: { part, file: null } });
        S.ex[BG_COL[part]] = '';
        renderBgImages(); renderSheets();
        toast('ลบรูปพื้นหลังแล้ว', 'ok');
      } catch (err) { toast(err.message, 'error'); }
    });
  });
  $('bg-file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f && bgPart) uploadBg(bgPart, f); });
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
  // Saved design of the exhibition; before the first save, the languages/fields this browser used earlier.
  S.d = normalizeCaptionSettings(S.ex.caption_settings || { main: local.main, extra: local.extra, fields: local.fields });
  if (!CAPTION_ORDERS.some((x) => x.key === S.o.order)) S.o.order = 'display';
  S.o.skip = Math.max(0, Math.min(PER_SHEET - 1, Number(S.o.skip) || 0));
  renderDesign();
  renderPrintOptions();
  renderLogo();
  renderBgImages();
  bind();
  // Wait for the Thai font so the fitting is measured with the real glyphs.
  try { await document.fonts.load('600 11pt "IBM Plex Sans Thai"'); } catch { /* ignore */ }
  await loadWorks().catch((err) => toast(err.message, 'error'));
  document.fonts.ready.then(() => renderSheets());
})();
