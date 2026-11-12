// /manage/<slug>/report - report for the expert panel: A4 landscape, one artist per page
// (owner, 2026-11-12), works grouped by category; also used on screen for presenting.
// Printed with the browser (Save as PDF). Read-only: uses GET /api/manage/:slug and /works;
// choices are kept in this browser only. Emails and phones are never put in the report.
import { api, esc, img, toast, slugFromPath, thDate, loadFonts } from './core.js';
import { requireLogin } from './backoffice.js';
import { flagUrl } from './countries.js';
import { CAPTION_LANGS, LANG_TH, normLangs, captionContent, themePalette } from './caption-text.js';
import {
  REPORT_STATUSES, STATUS_LABEL, ARTIST_ORDERS, CONCEPT_MODES,
  buildReport, categoryOrder, categoryLabel, pickLang, paragraphs, workGrid, artistPages, checklistPages
} from './report-data.js';

loadFonts(['Noto Serif Thai']);

const slug = slugFromPath(1);
const M = `/api/manage/${encodeURIComponent(slug)}`;
const $ = (id) => document.getElementById(id);
const KEY = `report:${slug}`;
const SHEET_W_MM = 297;
const MIN_SCALE = 0.7;

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
  { key: 'divider', label: 'ใบคั่นก่อนแต่ละกลุ่มงาน' },
  { key: 'checklist', label: 'ตารางติ๊ก ผ่าน / ไม่ผ่าน (ต้นแต่ละกลุ่มงาน)' },
  { key: 'titles', label: '— แสดงรายชื่อผลงานในตารางติ๊ก (ติ๊กทีละผลงาน; ไม่แสดง = ติ๊กทีละศิลปิน)' }
];

const S = {
  ex: null, works: [],
  o: {
    status: 'all', cat: '*', order: 'name', lang: 'th', extra: ['en'], concept: 'short',
    fields: Object.fromEntries(FIELDS.map((f) => [f.key, true])),
    layout: { cover: true, divider: true, checklist: true, titles: true }
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
  if (!CONCEPT_MODES.some((x) => x.key === o.concept)) o.concept = 'short';
  if (!CAPTION_LANGS.includes(o.lang)) o.lang = 'th';
  $('o-status').innerHTML = opts(REPORT_STATUSES, o.status);
  $('o-order').innerHTML = opts(ARTIST_ORDERS, o.order);
  $('o-lang').innerHTML = CAPTION_LANGS.map((l) => `<option value="${l}"${l === o.lang ? ' selected' : ''}>${LANG_TH[l]}</option>`).join('');
  $('o-extra').innerHTML = CAPTION_LANGS.filter((l) => l !== o.lang).map((l) => `<label>
    <input type="checkbox" value="${l}"${o.extra.includes(l) ? ' checked' : ''}> ${LANG_TH[l]}</label>`).join('');
  $('o-concept').innerHTML = opts(CONCEPT_MODES, o.concept);
  $('o-fields').innerHTML = checks(FIELDS, o.fields);
  $('o-layout').innerHTML = checks(LAYOUT, o.layout);
  const t = $('o-layout').querySelector('input[value="titles"]');
  if (t) t.disabled = !o.layout.checklist;
}

function renderCats() {
  const cats = categoryOrder(S.ex.categories, S.works).filter((c) => S.works.some((w) => String(w.category || '').trim() === c.key));
  if (S.o.cat !== '*' && !cats.some((c) => c.key === S.o.cat)) S.o.cat = '*';
  $('o-cat').innerHTML = `<option value="*">ทุกกลุ่มงาน</option>${cats.map((c) => `<option value="${esc(c.key)}"${c.key === S.o.cat ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}`;
}

// ------------------------------------------------------------------ sheets
const langs = () => normLangs(S.o.lang, S.o.extra);
const exTitle = () => pickLang(S.ex, 'title', S.o.lang) || slug;
const catName = (cat) => {
  const L = S.o.lang;
  const second = L === 'th' && cat.en && cat.en !== cat.name ? ` <span class="x">${esc(cat.en)}</span>` : '';
  return `${esc(categoryLabel(cat, L))}${second}`;
};
const foot = (page, total) => `<footer class="sh-foot"><span>${esc(exTitle())} · รายงานสำหรับผู้ทรงคุณวุฒิ</span><span>${page} / ${total}</span></footer>`;

function coverSheet(rep, total) {
  const ex = S.ex;
  const titles = [...new Set([exTitle(), ...langs().slice(1).map((l) => String(ex[`title_${l}`] || '').trim())])].filter(Boolean);
  const status = REPORT_STATUSES.find((x) => x.key === S.o.status).label;
  const logo = ex.caption_logo_url ? `<img class="cv-logo" src="${esc(img(ex.caption_logo_url, 400))}" alt="">` : '';
  const rows = rep.sections.map((s, i) => `<tr><td>${i + 1}</td><td>${catName(s.cat)}</td>
    <td class="n">${s.nArtists}</td><td class="n">${s.nWorks}</td></tr>`).join('');
  return `<section class="sheet sh-cover">
    <div class="cv-main">
      ${logo}
      <div class="kicker">เอกสารประกอบการพิจารณาของคณะผู้ทรงคุณวุฒิ</div>
      <h1 class="cv-title">${esc(titles[0])}</h1>
      ${titles.slice(1).map((t) => `<div class="cv-sub">${esc(t)}</div>`).join('')}
      <div class="rule"></div>
      <h2 class="cv-h">รายงานศิลปินและผลงาน แยกตามกลุ่มงาน</h2>
      <dl class="cv-facts">
        <div><dt>ผลงานในรายงาน</dt><dd>${esc(status)}</dd></div>
        <div><dt>จำนวน</dt><dd>${rep.total.artists} ศิลปิน · ${rep.total.works} ผลงาน · ${rep.sections.length} กลุ่มงาน</dd></div>
        ${ex.submission_closes_at ? `<div><dt>ปิดรับผลงาน</dt><dd>${esc(thDate(ex.submission_closes_at, true))}</dd></div>` : ''}
        <div><dt>จัดทำเมื่อ</dt><dd>${esc(thDate(new Date().toISOString(), true))}</dd></div>
      </dl>
    </div>
    <div class="cv-side" data-fit>
      <table class="cv-sum">
        <thead><tr><th>#</th><th>กลุ่มงาน</th><th class="n">ศิลปิน</th><th class="n">ผลงาน</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td></td><td>รวม</td><td class="n">${rep.total.artists}</td><td class="n">${rep.total.works}</td></tr></tfoot>
      </table>
      <p class="cv-note">แต่ละกลุ่มงานขึ้นหน้าใหม่ (ใบคั่น ตารางติ๊ก แล้วหน้าละหนึ่งศิลปิน) · ศิลปินที่ส่งหลายกลุ่มงานจะมีหน้าในทุกกลุ่มที่ส่ง (จำนวนรวมนับครั้งเดียว) · เลข No. คือลำดับผลงานในรายงานนี้</p>
    </div>
    ${foot(1, total)}
  </section>`;
}

// Divider sheet before each category (ใบคั่น, owner 2026-11-12).
function dividerSheet(section, si, page, total) {
  const c = section.cat;
  const names = [...new Set([categoryLabel(c, S.o.lang), c.name, c.en, c.zh])].filter(Boolean);
  return `<section class="sheet sh-divider">
    <div class="dv-in">
      <div class="dv-no">กลุ่มงานที่ ${si + 1}</div>
      <h2 class="dv-name">${esc(names[0])}</h2>
      ${names.slice(1).map((n) => `<div class="dv-x">${esc(n)}</div>`).join('')}
      <div class="dv-rule"></div>
      <div class="dv-count">${section.nArtists} ศิลปิน · ${section.nWorks} ผลงาน</div>
    </div>
    ${foot(page, total)}
  </section>`;
}

// Checklist sheets for ticking ผ่าน / ไม่ผ่าน by hand (owner, 2026-11-12), one set per category: by artist (name,
// country, number of works); with titles each work has its own row and boxes, without them each artist has one.
// Signature line on every sheet.
function checklistSheet(section, si, items, i, count, page, total) {
  const L = S.o.lang;
  const titles = !!S.o.layout.titles;
  const box = '<span class="ck-box" aria-hidden="true"></span>';
  const ticks = `<td class="ck-b">${box}</td><td class="ck-b">${box}</td><td></td>`;
  const body = items.map((it) => {
    const a = captionContent(it.artist.works[0], { langs: [L], fields: { artist: true, country: true, title: false, technique: false, size: false, year: false } });
    const span = titles ? it.works.length : 1;
    const head = `<td class="ck-i" rowspan="${span}">${it.ai + 1}</td>
      <td class="ck-a${span === 1 ? ' one' : ''}" rowspan="${span}"><div class="ck-an">${esc(a.artists[0] || '')}${it.cont ? ' <span class="x">(ต่อ)</span>' : ''}</div>${a.place ? `<div class="ck-ac">${esc(a.place)}</div>` : ''}</td>
      <td class="ck-n" rowspan="${span}">${it.artist.works.length} ชิ้น</td>`;
    if (!titles) {
      return `<tr class="ck-first">${head}<td class="ck-nos">${esc(it.works.map((w) => w.no).join(', '))}</td>${ticks}</tr>`;
    }
    return it.works.map((w, k) => {
      const t = captionContent(w, { langs: [L], fields: { artist: false, country: false, title: true, technique: false, size: false, year: false } });
      return `<tr class="${k === 0 ? 'ck-first' : ''}">${k === 0 ? head : ''}<td class="ck-no">${esc(w.no)}</td><td class="ck-t">${esc(t.titles[0] || '')}</td>${ticks}</tr>`;
    }).join('');
  }).join('');
  const cols = titles
    ? '<col class="c-i"><col class="c-a"><col class="c-n"><col class="c-no"><col><col class="c-b"><col class="c-b"><col class="c-r">'
    : '<col class="c-i"><col class="c-a2"><col class="c-n"><col><col class="c-b"><col class="c-b"><col class="c-r">';
  const th = titles
    ? '<th>#</th><th>ชื่อศิลปิน</th><th class="ck-n">จำนวน (ชิ้น)</th><th>No.</th><th>ชื่อผลงาน</th>'
    : '<th>#</th><th>ชื่อศิลปิน</th><th class="ck-n">จำนวน (ชิ้น)</th><th>No. ผลงาน</th>';
  return `<section class="sheet sh-check">
    <header class="sh-head">
      <span class="sh-cat"><b>แบบบันทึกผลการพิจารณา · กลุ่มงานที่ ${si + 1}</b> · ${catName(section.cat)}</span>
      <span>แผ่นที่ ${i + 1} / ${count}</span>
    </header>
    <div class="ck-hint">ติ๊ก ✓ ในช่อง ผ่าน หรือ ไม่ผ่าน ${titles ? 'ของผลงานแต่ละชิ้น' : 'ของศิลปินแต่ละท่าน'} · ${section.nArtists} ศิลปิน · ${section.nWorks} ผลงาน</div>
    <div class="ck-body" data-fit>
      <table class="ck">
        <colgroup>${cols}</colgroup>
        <thead><tr>${th}<th class="ck-b">ผ่าน</th><th class="ck-b">ไม่ผ่าน</th><th>หมายเหตุ</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <div class="ck-sign"><span>ลงชื่อ ........................................................ ผู้ทรงคุณวุฒิ</span><span>(........................................................)</span><span>วันที่ ..........................</span></div>
    ${foot(page, total)}
  </section>`;
}

function artistSheet({ section, si, ai, artist }, page, total) {
  const f = S.o.fields;
  const w0 = artist.works[0];
  const c = captionContent(w0, { langs: langs(), fields: { artist: true, country: f.country, affiliation: f.affiliation, title: false, technique: false, size: false, year: false } });
  const [n0, ...nx] = c.artists;
  const academic = f.academic && S.o.lang === 'th' ? String(w0.academic_title_th || '').trim() : '';
  const flag = f.flag && f.country && flagUrl(w0.nationality) ? `<img class="flag" src="${esc(flagUrl(w0.nationality))}" alt="">` : '';
  const bio = f.bio ? paragraphs(pickLang(w0, 'bio', S.o.lang)) : [];
  const g = workGrid(artist.works.length);
  return `<section class="sheet sh-artist">
    <header class="sh-head">
      <span class="sh-cat"><b>กลุ่มงานที่ ${si + 1}</b> · ${catName(section.cat)}</span>
      <span>ศิลปิน ${ai + 1} / ${section.nArtists} ในกลุ่มนี้</span>
    </header>
    <div class="sh-body">
      <aside class="ar-side" data-fit>
        ${academic ? `<div class="ar-acad">${esc(academic)}</div>` : ''}
        <h2 class="ar-name">${esc(n0 || '—')}</h2>
        ${nx.map((x) => `<div class="ar-name-x">${esc(x)}</div>`).join('')}
        ${c.place || flag ? `<div class="ar-place">${flag}${esc(c.place)}</div>` : ''}
        <div class="ar-count">${artist.works.length} ผลงานในกลุ่มนี้</div>
        ${bio.length ? `<div class="ar-bio-h">ประวัติ</div><div class="ar-bio">${bio.map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}</div>` : ''}
      </aside>
      <div class="ar-works" data-fit data-n="${artist.works.length}" style="grid-template-columns:repeat(${g.cols},minmax(0,1fr));grid-template-rows:repeat(${g.rows},minmax(0,1fr))">
        ${artist.works.map((w) => workHtml(w, g)).join('')}
      </div>
    </div>
    ${foot(page, total)}
  </section>`;
}

function workHtml(w, g) {
  const f = S.o.fields;
  const c = captionContent(w, { langs: langs(), fields: { artist: false, country: false, title: true, technique: f.technique, size: f.size, year: f.year }, techniques: S.ex.techniques || [] });
  const [t0, ...tx] = c.titles;
  const concept = S.o.concept !== 'none' ? pickLang(w, 'concept', S.o.lang) : '';
  const width = g.cols >= 3 && g.rows > 1 ? 800 : 1600;
  const meta = [...c.tech, c.dims, f.sub ? w.subcategory : ''].filter(Boolean);
  const st = f.status ? `<span class="st st-${esc(w.status)}">${esc(STATUS_LABEL[w.status] || w.status)}</span>` : '';
  // Short concept: fewer lines when the page holds more works.
  const lines = g.rows > 1 ? 2 : g.cols >= 3 ? 4 : 6;
  return `<figure class="wk">
    <div class="wk-img">${w.image_url ? `<img src="${esc(img(w.image_url, width))}" alt="${esc(t0 || '')}" decoding="async">` : '<span>ไม่มีรูป</span>'}</div>
    <figcaption>
      <div class="wk-no"><span>No. ${esc(w.no)}</span>${st}</div>
      ${t0 ? `<div class="wk-title">${esc(t0)}</div>` : ''}
      ${tx.map((x) => `<div class="wk-title-x">${esc(x)}</div>`).join('')}
      ${meta.length ? `<div class="wk-meta">${meta.map(esc).join(' · ')}</div>` : ''}
      ${w.video_url ? `<div class="wk-meta muted">วิดีโอ: ${esc(w.video_url)}</div>` : ''}
      ${concept ? `<div class="wk-concept${S.o.concept === 'short' ? ' short' : ''}" style="--lines:${lines}">${esc(concept).replace(/\n+/g, ' ')}</div>` : ''}
    </figcaption>
  </figure>`;
}

// Shrinks the text of each part step by step until it fits its box (not below 70 %); marks the rest.
function fitAll() {
  let shrunk = 0; let over = 0;
  $('paper').querySelectorAll('.sheet').forEach((sheet) => {
    let bad = false; let small = false;
    sheet.querySelectorAll('[data-fit]').forEach((part) => {
      let s = 1;
      part.style.setProperty('--s', s);
      while (part.scrollHeight > part.clientHeight + 1 && s > MIN_SCALE) {
        s = Math.round((s - 0.05) * 100) / 100;
        part.style.setProperty('--s', s);
      }
      if (s < 1) small = true;
      if (part.scrollHeight > part.clientHeight + 1) bad = true;
    });
    sheet.classList.toggle('overflow', bad);
    shrunk += small; over += bad;
  });
  return { shrunk, over };
}

// Shows the 297 mm sheets at the width of the preview column (print is always real size).
function zoomPreview() {
  const paper = $('paper');
  const avail = paper.parentElement.clientWidth;
  const full = SHEET_W_MM * 96 / 25.4;
  paper.style.zoom = String(Math.min(1, avail / full));
}

let last = { pages: 0, works: 0, artists: 0, sections: 0 };
// Order (owner, 2026-11-12): cover, then for each category: divider, checklist, one page per artist.
function render() {
  const rep = buildReport(S.works, { categories: S.ex.categories, status: S.o.status, cat: S.o.cat, artistOrder: S.o.order, lang: S.o.lang });
  const lay = S.o.layout;
  const plan = [];
  if (lay.cover) plan.push((pg, total) => coverSheet(rep, total));
  const byArtist = artistPages(rep);
  rep.sections.forEach((section, si) => {
    if (lay.divider) plan.push((pg, total) => dividerSheet(section, si, pg, total));
    if (lay.checklist) {
      const ck = checklistPages(section, { titles: !!lay.titles });
      ck.forEach((items, i) => plan.push((pg, total) => checklistSheet(section, si, items, i, ck.length, pg, total)));
    }
    byArtist.filter((x) => x.si === si).forEach((x) => plan.push((pg, total) => artistSheet(x, pg, total)));
  });
  const total = plan.length;
  const p = themePalette(S.ex);
  const paper = $('paper');
  paper.style.setProperty('--rep-accent', p.accent === '#d4af37' ? '#8a6d12' : p.accent);
  paper.style.zoom = '1';
  paper.innerHTML = rep.total.works ? plan.map((f, i) => f(i + 1, total)).join('') : '<p class="rep-empty">ไม่มีผลงานตามที่เลือก</p>';
  $('print').disabled = !rep.total.works;
  last = { pages: total, works: rep.total.works, artists: rep.total.artists, sections: rep.sections.length };
  refit();
}

function refit() {
  const paper = $('paper');
  paper.style.zoom = '1';
  const r = fitAll();
  zoomPreview();
  $('status').innerHTML = last.works
    ? `${last.pages} หน้า A4 แนวนอน · ${last.sections} กลุ่มงาน · ${last.artists} ศิลปิน · ${last.works} ผลงาน${r.shrunk ? ` · ย่อตัวอักษรอัตโนมัติ ${r.shrunk} หน้า` : ''}${r.over
      ? ` · <span class="warn">ข้อความยาวเกินหน้า ${r.over} หน้า (กรอบแดง) — ลองเลือกแนวคิด “ย่อ” หรือปิดภาษาเพิ่มเติม</span>` : ''}`
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
  $('o-concept').addEventListener('change', (e) => { S.o.concept = e.target.value; changed(); });
  $('o-fields').addEventListener('change', () => { $('o-fields').querySelectorAll('input').forEach((x) => { S.o.fields[x.value] = x.checked; }); changed(); });
  $('o-layout').addEventListener('change', () => { $('o-layout').querySelectorAll('input').forEach((x) => { S.o.layout[x.value] = x.checked; }); renderControls(); changed(); });
  $('print').addEventListener('click', () => { printWhenReady(); });
  let t = null;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(zoomPreview, 150); });
  // Print is real size; the preview zoom comes back afterwards.
  window.addEventListener('beforeprint', () => { $('paper').style.zoom = '1'; });
  window.addEventListener('afterprint', zoomPreview);
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
  // Fonts change line breaks: fit again once they are in.
  document.fonts.ready.then(refit);
})();
