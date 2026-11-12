// /manage/<slug>/report - artists and works grouped by category, for the expert panel.
// Printed with the browser (Save as PDF). Read-only: uses GET /api/manage/:slug and /works;
// choices are kept in this browser only. Emails and phones are never put in the report.
import { api, esc, img, toast, slugFromPath, thDate, loadFonts } from './core.js';
import { requireLogin } from './backoffice.js';
import { flagUrl } from './countries.js';
import { CAPTION_LANGS, LANG_TH, normLangs, captionContent, themePalette } from './caption-text.js';
import {
  REPORT_STATUSES, STATUS_LABEL, ARTIST_ORDERS, REPORT_COLS, CONCEPT_MODES,
  buildReport, categoryOrder, categoryLabel, pickLang, paragraphs
} from './report-data.js';

loadFonts(['Noto Serif Thai']);

const slug = slugFromPath(1);
const M = `/api/manage/${encodeURIComponent(slug)}`;
const $ = (id) => document.getElementById(id);
const KEY = `report:${slug}`;

const FIELDS = [
  { key: 'bio', label: 'ประวัติศิลปิน' },
  { key: 'academic', label: 'ตำแหน่งทางวิชาการ (หน้าชื่อ)' },
  { key: 'country', label: 'ประเทศ' },
  { key: 'flag', label: 'ธงชาติ' },
  { key: 'affiliation', label: 'สังกัด' },
  { key: 'technique', label: 'เทคนิค' },
  { key: 'size', label: 'ขนาด' },
  { key: 'year', label: 'ปีที่สร้าง' },
  { key: 'sub', label: 'ประเภทย่อย' },
  { key: 'status', label: 'สถานะการคัดกรอง' }
];
const LAYOUT = [
  { key: 'cover', label: 'หน้าปกและตารางสรุป' },
  { key: 'newPage', label: 'ขึ้นหน้าใหม่ทุกกลุ่มงาน' }
];

const S = {
  ex: null, works: [],
  o: {
    status: 'all', cat: '*', order: 'name', lang: 'th', extra: ['en'], cols: 3, concept: 'short',
    fields: Object.fromEntries(FIELDS.map((f) => [f.key, true])),
    layout: { cover: true, newPage: true }
  }
};
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  for (const k of Object.keys(S.o)) {
    if (saved[k] === undefined) continue;
    S.o[k] = typeof S.o[k] === 'object' && !Array.isArray(S.o[k]) ? { ...S.o[k], ...saved[k] } : saved[k];
  }
} catch { /* storage unavailable */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S.o)); } catch { /* ignore */ } };

const opts = (list, value) => list.map((x) => `<option value="${esc(String(x.key))}"${String(x.key) === String(value) ? ' selected' : ''}>${esc(x.label)}</option>`).join('');
const checks = (list, state) => list.map((f) => `<label><input type="checkbox" value="${f.key}"${state[f.key] ? ' checked' : ''}> ${esc(f.label)}</label>`).join('');

// ------------------------------------------------------------------ controls
function renderControls() {
  const o = S.o;
  if (!REPORT_STATUSES.some((x) => x.key === o.status)) o.status = 'all';
  if (!ARTIST_ORDERS.some((x) => x.key === o.order)) o.order = 'name';
  if (!REPORT_COLS.includes(Number(o.cols))) o.cols = 3;
  if (!CONCEPT_MODES.some((x) => x.key === o.concept)) o.concept = 'short';
  if (!CAPTION_LANGS.includes(o.lang)) o.lang = 'th';
  $('o-status').innerHTML = opts(REPORT_STATUSES, o.status);
  $('o-order').innerHTML = opts(ARTIST_ORDERS, o.order);
  $('o-lang').innerHTML = CAPTION_LANGS.map((l) => `<option value="${l}"${l === o.lang ? ' selected' : ''}>${LANG_TH[l]}</option>`).join('');
  $('o-extra').innerHTML = CAPTION_LANGS.filter((l) => l !== o.lang).map((l) => `<label>
    <input type="checkbox" value="${l}"${o.extra.includes(l) ? ' checked' : ''}> ${LANG_TH[l]}</label>`).join('');
  $('o-cols').innerHTML = REPORT_COLS.map((n) => `<option value="${n}"${n === Number(o.cols) ? ' selected' : ''}>${n} ชิ้น${n === 3 ? ' (ค่าเริ่มต้น)' : ''}</option>`).join('');
  $('o-concept').innerHTML = opts(CONCEPT_MODES, o.concept);
  $('o-fields').innerHTML = checks(FIELDS, o.fields);
  $('o-layout').innerHTML = checks(LAYOUT, o.layout);
}

function renderCats() {
  const cats = categoryOrder(S.ex.categories, S.works).filter((c) => S.works.some((w) => String(w.category || '').trim() === c.key));
  if (S.o.cat !== '*' && !cats.some((c) => c.key === S.o.cat)) S.o.cat = '*';
  $('o-cat').innerHTML = `<option value="*">ทุกกลุ่มงาน</option>${cats.map((c) => `<option value="${esc(c.key)}"${c.key === S.o.cat ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}`;
}

// ------------------------------------------------------------------ report
const langs = () => normLangs(S.o.lang, S.o.extra);

function coverHtml(rep) {
  const ex = S.ex;
  const L = S.o.lang;
  const titles = [...new Set([pickLang(ex, 'title', L), ...langs().slice(1).map((l) => String(ex[`title_${l}`] || '').trim())])].filter(Boolean);
  const status = REPORT_STATUSES.find((x) => x.key === S.o.status).label;
  const logo = ex.caption_logo_url ? `<img class="rep-cover-logo" src="${esc(img(ex.caption_logo_url, 400))}" alt="">` : '';
  const rows = rep.sections.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(categoryLabel(s.cat, L))}${L === 'th' && s.cat.en && s.cat.en !== s.cat.name ? `<span class="x">${esc(s.cat.en)}</span>` : ''}</td>
    <td class="n">${s.nArtists}</td><td class="n">${s.nWorks}</td></tr>`).join('');
  return `<section class="rep-cover">
    ${logo}
    <div class="rep-kicker">เอกสารประกอบการพิจารณาของคณะผู้ทรงคุณวุฒิ</div>
    <h1 class="rep-cover-title">${esc(titles[0] || slug)}</h1>
    ${titles.slice(1).map((t) => `<div class="rep-cover-sub">${esc(t)}</div>`).join('')}
    <div class="rep-rule"></div>
    <h2 class="rep-cover-h">รายงานศิลปินและผลงาน แยกตามกลุ่มงาน</h2>
    <dl class="rep-facts">
      <div><dt>ผลงานในรายงาน</dt><dd>${esc(status)}</dd></div>
      <div><dt>จำนวน</dt><dd>${rep.total.artists} ศิลปิน · ${rep.total.works} ผลงาน · ${rep.sections.length} กลุ่มงาน</dd></div>
      ${ex.submission_closes_at ? `<div><dt>ปิดรับผลงาน</dt><dd>${esc(thDate(ex.submission_closes_at, true))}</dd></div>` : ''}
      <div><dt>จัดทำเมื่อ</dt><dd>${esc(thDate(new Date().toISOString(), true))}</dd></div>
    </dl>
    <table class="rep-sum">
      <thead><tr><th>#</th><th>กลุ่มงาน</th><th class="n">ศิลปิน</th><th class="n">ผลงาน</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td></td><td>รวม</td><td class="n">${rep.total.artists}</td><td class="n">${rep.total.works}</td></tr></tfoot>
    </table>
    <p class="rep-cover-note">ศิลปินที่ส่งผลงานมากกว่าหนึ่งกลุ่มงาน จะปรากฏในทุกกลุ่มที่ส่ง (จำนวนรวมนับศิลปินครั้งเดียว) · เลข No. คือลำดับผลงานในรายงานนี้</p>
  </section>`;
}

function artistHtml(a) {
  const f = S.o.fields;
  const w0 = a.works[0];
  const c = captionContent(w0, { langs: langs(), fields: { artist: true, country: f.country, affiliation: f.affiliation, title: false, technique: false, size: false, year: false } });
  const [n0, ...nx] = c.artists;
  const academic = f.academic && S.o.lang === 'th' ? String(w0.academic_title_th || '').trim() : '';
  const flag = f.flag && f.country && flagUrl(w0.nationality) ? `<img class="rep-flag" src="${esc(flagUrl(w0.nationality))}" alt="">` : '';
  const bio = f.bio ? paragraphs(pickLang(w0, 'bio', S.o.lang)) : [];
  return `<article class="rep-artist">
    <header class="rep-artist-head">
      <div class="rep-artist-name">${academic ? `<span class="acad">${esc(academic)}</span> ` : ''}${esc(n0 || '—')}</div>
      ${nx.map((x) => `<div class="rep-artist-x">${esc(x)}</div>`).join('')}
      ${c.place || flag ? `<div class="rep-artist-place">${flag}${esc(c.place)}</div>` : ''}
    </header>
    ${bio.length ? `<div class="rep-bio">${bio.map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}</div>` : ''}
    <div class="rep-works cols-${Number(S.o.cols)}">${a.works.map(workHtml).join('')}</div>
  </article>`;
}

function workHtml(w) {
  const f = S.o.fields;
  const c = captionContent(w, { langs: langs(), fields: { artist: false, country: false, title: true, technique: f.technique, size: f.size, year: f.year }, techniques: S.ex.techniques || [] });
  const [t0, ...tx] = c.titles;
  const concept = S.o.concept !== 'none' ? pickLang(w, 'concept', S.o.lang) : '';
  const width = Number(S.o.cols) >= 4 ? 400 : 800;
  const sub = f.sub && w.subcategory ? `<div class="rep-meta">${esc(w.subcategory)}</div>` : '';
  const st = f.status ? `<span class="rep-st st-${esc(w.status)}">${esc(STATUS_LABEL[w.status] || w.status)}</span>` : '';
  const video = w.video_url ? `<div class="rep-meta rep-video">วิดีโอ: ${esc(w.video_url)}</div>` : '';
  return `<figure class="rep-work">
    <div class="rep-img">${w.image_url ? `<img src="${esc(img(w.image_url, width))}" alt="${esc(t0 || '')}" decoding="async">` : '<span>ไม่มีรูป</span>'}</div>
    <figcaption>
      <div class="rep-no"><span>No. ${esc(w.no)}</span>${st}</div>
      ${t0 ? `<div class="rep-title">${esc(t0)}</div>` : ''}
      ${tx.map((x) => `<div class="rep-title-x">${esc(x)}</div>`).join('')}
      ${c.tech.map((x) => `<div class="rep-meta">${esc(x)}</div>`).join('')}
      ${c.dims ? `<div class="rep-meta">${esc(c.dims)}</div>` : ''}
      ${sub}${video}
      ${concept ? `<div class="rep-concept${S.o.concept === 'short' ? ' short' : ''}">${esc(concept).replace(/\n+/g, ' ')}</div>` : ''}
    </figcaption>
  </figure>`;
}

// Page numbers and the exhibition name in the page margins (Chrome 131+ draws @page margin boxes).
function pageStyle() {
  const name = (pickLang(S.ex, 'title', S.o.lang) || slug).replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ').slice(0, 120);
  let el = $('page-style');
  if (!el) { el = document.createElement('style'); el.id = 'page-style'; document.head.appendChild(el); }
  el.textContent = `@page { @bottom-left { content: "${name} · รายงานสำหรับผู้ทรงคุณวุฒิ"; } }
    @page :first { @bottom-left { content: none; } @bottom-right { content: none; } }`;
}

function render() {
  const rep = buildReport(S.works, { categories: S.ex.categories, status: S.o.status, cat: S.o.cat, artistOrder: S.o.order, lang: S.o.lang });
  const L = S.o.lang;
  const p = themePalette(S.ex);
  const paper = $('paper');
  paper.style.setProperty('--rep-accent', p.accent === '#d4af37' ? '#8a6d12' : p.accent);
  paper.classList.toggle('new-page', !!S.o.layout.newPage);
  paper.innerHTML = rep.total.works ? [
    S.o.layout.cover ? coverHtml(rep) : '',
    ...rep.sections.map((s, i) => `<section class="rep-sec">
      <header class="rep-sec-head">
        <div class="rep-sec-no">กลุ่มงานที่ ${i + 1}</div>
        <h2>${esc(categoryLabel(s.cat, L))}${L === 'th' && s.cat.en && s.cat.en !== s.cat.name ? ` <span class="x">${esc(s.cat.en)}</span>` : ''}</h2>
        <div class="rep-sec-count">${s.nArtists} ศิลปิน · ${s.nWorks} ผลงาน</div>
      </header>
      ${s.artists.map(artistHtml).join('')}
    </section>`)
  ].join('') : '<p class="rep-empty">ไม่มีผลงานตามที่เลือก</p>';
  pageStyle();
  $('print').disabled = !rep.total.works;
  $('status').textContent = rep.total.works
    ? `${rep.sections.length} กลุ่มงาน · ${rep.total.artists} ศิลปิน · ${rep.total.works} ผลงาน — ตัวอย่างนี้ไม่แบ่งหน้า เลขหน้าและการตัดหน้าจะเห็นในหน้าพิมพ์`
    : 'ยังไม่มีผลงานตามที่เลือก';
}

// Waits for every picture (they are not lazy) so none is blank in the PDF.
async function printWhenReady() {
  const imgs = [...$('paper').querySelectorAll('img')];
  const pending = imgs.filter((x) => !x.complete);
  const btn = $('print');
  btn.disabled = true;
  let done = imgs.length - pending.length;
  const tick = () => { btn.textContent = `กำลังโหลดรูป ${done}/${imgs.length}…`; };
  tick();
  await Promise.race([
    Promise.all(pending.map((x) => new Promise((r) => {
      const fin = () => { done += 1; tick(); r(); };
      x.addEventListener('load', fin, { once: true });
      x.addEventListener('error', fin, { once: true });
    }))),
    new Promise((r) => setTimeout(r, 60000))
  ]);
  try { await document.fonts.ready; } catch { /* ignore */ }
  btn.textContent = 'พิมพ์ / บันทึกเป็น PDF';
  btn.disabled = false;
  window.print();
}

// ------------------------------------------------------------------ wiring
const changed = () => { save(); render(); };
function bind() {
  $('o-status').addEventListener('change', (e) => { S.o.status = e.target.value; changed(); });
  $('o-cat').addEventListener('change', (e) => { S.o.cat = e.target.value; changed(); });
  $('o-order').addEventListener('change', (e) => { S.o.order = e.target.value; changed(); });
  $('o-lang').addEventListener('change', (e) => {
    S.o.lang = e.target.value;
    S.o.extra = S.o.extra.filter((l) => l !== S.o.lang);
    renderControls(); changed();
  });
  $('o-extra').addEventListener('change', () => { S.o.extra = [...$('o-extra').querySelectorAll('input:checked')].map((x) => x.value); changed(); });
  $('o-cols').addEventListener('change', (e) => { S.o.cols = Number(e.target.value); changed(); });
  $('o-concept').addEventListener('change', (e) => { S.o.concept = e.target.value; changed(); });
  $('o-fields').addEventListener('change', () => { $('o-fields').querySelectorAll('input').forEach((x) => { S.o.fields[x.value] = x.checked; }); changed(); });
  $('o-layout').addEventListener('change', () => { $('o-layout').querySelectorAll('input').forEach((x) => { S.o.layout[x.value] = x.checked; }); changed(); });
  $('print').addEventListener('click', () => { printWhenReady(); });
}

(async function init() {
  await requireLogin();
  $('back').href = `/manage/${encodeURIComponent(slug)}`;
  try {
    const d = await api(M);
    S.ex = d.exhibition;
    $('ex-sub').textContent = S.ex.title_th || S.ex.title_en || slug;
    document.title = `รายงานผู้ทรงคุณวุฒิ · ${$('ex-sub').textContent}`;
    const w = await api(`${M}/works?status=all`);
    S.works = w.works || [];
  } catch (err) {
    $('ex-sub').textContent = err.message;
    toast(err.message, 'error');
    return;
  }
  renderControls();
  renderCats();
  bind();
  render();
})();
