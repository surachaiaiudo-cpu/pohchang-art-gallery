// /manage/:slug/catalog - catalogue settings of one exhibition (staff of that exhibition and admins):
// template, languages, sections, order, which data appear, expert panel fields, extra texts, publishing.
import { api, esc, toast, thDate, slugFromPath, img } from './core.js';
import { checkImageFile, uploadImage, fitForUpload } from './upload.js';
import { requireLogin, STATUS_TH } from './backoffice.js';
import {
  DATA_FIELDS, REVIEWER_FIELDS, ORDERS, SECTIONS, LANG_CODES, LANG_NAMES,
  builtinTemplate, normalizeSettings, normalizeLayout, orderWorks
} from './catalog-core.js';
import { renderBook, miniSheet } from './catalog-render.js';
import { SAMPLE_WORKS } from './catalog-sample.js';

const $ = (id) => document.getElementById(id);
const slug = slugFromPath(1);
const M = `/api/manage/${encodeURIComponent(slug)}`;
const S = { data: null, settings: null, saved: '', layouts: new Map(), reviewers: 0, published: null };
const json = (s) => JSON.stringify(s);
const dirty = () => json(S.settings) !== S.saved;

async function layoutOf(ref) {
  if (S.layouts.has(ref)) return S.layouts.get(ref);
  const b = builtinTemplate(ref);
  let layout;
  if (b) layout = normalizeLayout(b.layout);
  else {
    const id = ref.slice(2);
    const d = await api(`/api/catalog-templates/${id}`);
    layout = d.template.layout;
  }
  S.layouts.set(ref, layout);
  return layout;
}

// ------------------------------------------------------------------ form
function checks(container, list, values, name) {
  $(container).innerHTML = list.map((f) => `<label class="check"><input type="checkbox" data-${name}="${f.key}"${values[f.key] ? ' checked' : ''}> <span>${esc(f.th)}</span><span class="missing" data-miss="${f.key}"></span></label>`).join('');
}
function langTexts(container, key, values, rows) {
  $(container).innerHTML = LANG_CODES.map((l) => `<div class="field" style="margin:0"><label class="small muted" for="${key}-${l}">${LANG_NAMES[l]}</label>${rows
    ? `<textarea id="${key}-${l}" rows="${rows}" lang="${l === 'zh' ? 'zh-Hans' : l}" data-${key}="${l}">${esc(values[l])}</textarea>`
    : `<input id="${key}-${l}" type="text" maxlength="200" lang="${l === 'zh' ? 'zh-Hans' : l}" data-${key}="${l}" value="${esc(values[l])}">`}</div>`).join('');
}

function fillForm() {
  const s = S.settings;
  $('lang-main').innerHTML = LANG_CODES.map((l) => `<option value="${l}"${s.langs[0] === l ? ' selected' : ''}>${LANG_NAMES[l]}</option>`).join('');
  fillMoreLangs();
  checks('sections', SECTIONS, s.sections, 'sec');
  $('order').innerHTML = ORDERS.map((o) => `<option value="${o.key}"${o.key === s.order ? ' selected' : ''}>${esc(o.th)}</option>`).join('');
  $('include').value = s.include;
  checks('fields', DATA_FIELDS, s.fields, 'fld');
  checks('rfields', REVIEWER_FIELDS, s.reviewerFields, 'rf');
  langTexts('note', 'note', s.coverNote, 3);
  langTexts('footer', 'foot', s.footer, 0);
}
function fillMoreLangs() {
  const s = S.settings;
  $('lang-more').innerHTML = LANG_CODES.filter((l) => l !== s.langs[0]).map((l) => `<label class="check"><input type="checkbox" data-more="${l}"${s.langs.includes(l) ? ' checked' : ''}> ${LANG_NAMES[l]}</label>`).join('');
}

function readForm() {
  const main = $('lang-main').value;
  const more = [...document.querySelectorAll('[data-more]')].filter((x) => x.checked).map((x) => x.dataset.more);
  const pickBools = (attr) => Object.fromEntries([...document.querySelectorAll(`[data-${attr}]`)].map((x) => [x.dataset[attr], x.checked]));
  const pickTexts = (attr) => Object.fromEntries([...document.querySelectorAll(`[data-${attr}]`)].map((x) => [x.dataset[attr], x.value.trim()]));
  S.settings = normalizeSettings({
    template: S.settings.template,
    langs: [main, ...LANG_CODES.filter((l) => more.includes(l))],
    sections: pickBools('sec'),
    order: $('order').value,
    include: $('include').value,
    fields: pickBools('fld'),
    reviewerFields: pickBools('rf'),
    coverNote: pickTexts('note'),
    footer: pickTexts('foot')
  });
}

// ------------------------------------------------------------------ templates
async function renderTemplates() {
  const works = S.data.works.length ? S.data.works : SAMPLE_WORKS;
  const ctx = { ex: S.data.exhibition, settings: S.settings, langs: S.settings.langs };
  const cards = await Promise.all(S.data.templates.map(async (t) => {
    let pic = '';
    try { pic = miniSheet(await layoutOf(t.ref), works[0], ctx, 0.2); } catch { pic = ''; }
    return `<button type="button" class="tpl" data-ref="${esc(t.ref)}" aria-pressed="${t.ref === S.settings.template}">
      ${pic}<span class="nm">${esc(t.name)}</span>
      <span class="by">${t.builtin ? 'เทมเพลตหลักของระบบ' : `สร้างโดย ${esc(t.author || '—')}`}</span></button>`;
  }));
  $('tpls').innerHTML = cards.join('');
}

async function markMissing() {
  const layout = await layoutOf(S.settings.template);
  const present = new Set(layout.blocks.map((b) => b.field));
  document.querySelectorAll('[data-miss]').forEach((el) => {
    const k = el.dataset.miss;
    el.textContent = DATA_FIELDS.some((f) => f.key === k) && !present.has(k) ? '(เทมเพลตนี้ไม่มีช่อง)' : '';
  });
}

// ------------------------------------------------------------------ preview (first works, unsaved settings)
let previewTimer;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 250);
}
async function renderPreview() {
  const s = S.settings;
  const layout = await layoutOf(s.template);
  const listed = orderWorks(S.data.works, s, S.data.exhibition);
  const works = (listed.length ? listed : SAMPLE_WORKS).slice(0, 2);
  const book = $('mini');
  book.style.setProperty('--s', '0.3');
  await renderBook(book, {
    exhibition: S.data.exhibition,
    settings: { ...s, order: 'display', include: 'all', sections: { cover: s.sections.cover, statement: false, committee: false, works: true, index: false } },
    template: { layout },
    cover: S.data.cover,
    works,
    reviewers: []
  });
  book.style.setProperty('--s', '0.3');
  const n = orderWorks(S.data.works, s, S.data.exhibition).length;
  $('count-hint').textContent = `ผลงานในเล่ม ${n} ชิ้น${S.data.works.length ? '' : ' (ยังไม่มีผลงานที่จัดแสดง ตัวอย่างใช้ข้อมูลสมมติ)'}`;
}

// ------------------------------------------------------------------ cover image
function showCover() {
  const c = S.data.cover || {};
  $('cv-img').hidden = !c.url;
  $('cv-remove').hidden = !c.url;
  if (c.url) $('cv-img').src = img(c.url, 400);
  const ratio = c.width && c.height ? c.height / c.width : 0;
  const a4 = 297 / 210;
  $('cv-state').textContent = !c.url ? 'ยังไม่มีรูปหน้าปก'
    : ratio && Math.abs(ratio - a4) / a4 > 0.03 ? `รูปขนาด ${c.width} × ${c.height} px สัดส่วนไม่ตรง A4 จะมีขอบว่างรอบรูป (สีกระดาษของเทมเพลต)`
      : `รูปขนาด ${c.width || '?'} × ${c.height || '?'} px${c.width && c.width < 1700 ? ' · ความละเอียดค่อนข้างต่ำสำหรับงานพิมพ์ แนะนำกว้าง 2480 px' : ''}`;
}
$('cv-pick').addEventListener('click', () => { $('cv-file').value = ''; $('cv-file').click(); });
$('cv-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const problem = checkImageFile(file);
    if (problem) throw new Error(problem);
    $('cv-pick').disabled = true;
    $('cv-state').textContent = 'กำลังเตรียมไฟล์…';
    const { upload } = await api(`${M}/upload-auth`, { method: 'POST', body: { kind: 'catalog' } });
    const fitted = await fitForUpload(file, upload.maxBytes, upload.maxPixels);
    const r = await uploadImage(fitted.file, upload, (p) => { $('cv-state').textContent = `กำลังอัปโหลด ${p}%`; });
    const d = await api(`${M}/catalog-cover`, { method: 'PUT', body: { file: r } });
    S.data.cover = d.cover;
    showCover();
    schedulePreview();
    toast('อัปโหลดรูปหน้าปกแล้ว', 'ok');
  } catch (err) {
    showCover();
    toast(err.message, 'error');
  } finally { $('cv-pick').disabled = false; }
});
$('cv-remove').addEventListener('click', async () => {
  if (!confirm('ลบรูปหน้าปก? เล่มจะใช้หน้าปกแบบตัวอักษรชั่วคราวแทน')) return;
  try {
    await api(`${M}/catalog-cover`, { method: 'PUT', body: { file: null } });
    S.data.cover = { url: '', width: 0, height: 0 };
    showCover();
    schedulePreview();
  } catch (err) { toast(err.message, 'error'); }
});

function showPublish() {
  const on = !!S.published;
  const ex = S.data.exhibition;
  $('pub-state').textContent = on ? `● เผยแพร่แล้ว เมื่อ ${thDate(S.published, true)}` : '● ยังไม่เผยแพร่ (ผู้ชมยังไม่เห็น)';
  $('pub-state').className = `state ${on ? 'on' : 'off'}`;
  const hidden = !S.data.exhibition_public;
  $('pub-hint').innerHTML = `${on ? 'ผู้ชมเปิดสูจิบัตรได้จากเมนู "สูจิบัตร" ในหน้านิทรรศการ และสั่งพิมพ์หรือบันทึก PDF ได้ทั้งเล่มหรือเฉพาะหน้า การแก้ไขที่บันทึกแล้วมีผลทันที'
    : 'กดเผยแพร่เมื่อพร้อม ผู้ชมจะเห็นเมนู "สูจิบัตร" ในหน้านิทรรศการ'}${hidden ? `<br><span class="notice" style="display:inline-block;margin-top:6px">สถานะนิทรรศการตอนนี้คือ "${esc(STATUS_TH[ex.status] || ex.status)}" ผู้ชมจะเห็นสูจิบัตรได้เมื่อนิทรรศการเป็น "เปิด" หรือ "ปิด" เท่านั้น</span>` : ''}`;
  $('publish').textContent = on ? 'ยกเลิกการเผยแพร่' : 'เผยแพร่สูจิบัตร';
  $('publish').className = on ? 'btn btn-danger' : 'btn';
  $('public').hidden = !on || hidden;
}

// ------------------------------------------------------------------ events
async function save(extra = {}) {
  readForm();
  $('err').textContent = '';
  $('save').disabled = true;
  try {
    const d = await api(`${M}/catalog`, { method: 'PUT', body: { settings: S.settings, ...extra } });
    S.saved = json(S.settings);
    if (extra.publish !== undefined) S.published = d.published_at;
    showPublish();
    return true;
  } catch (e) {
    $('err').textContent = e.message;
    toast(e.message, 'error');
    return false;
  } finally {
    $('save').disabled = false;
  }
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (await save()) toast('บันทึกการตั้งค่าสูจิบัตรแล้ว', 'ok');
});
$('form').addEventListener('change', (e) => {
  if (e.target.id === 'lang-main') {
    readForm();
    S.settings.langs = [e.target.value, ...S.settings.langs.filter((l) => l !== e.target.value)];
    fillMoreLangs();
  }
  readForm();
  schedulePreview();
});
$('form').addEventListener('input', (e) => { if (e.target.matches('input[type="text"], textarea')) { readForm(); schedulePreview(); } });
$('tpls').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-ref]');
  if (!b) return;
  S.settings.template = b.dataset.ref;
  document.querySelectorAll('#tpls [data-ref]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  await markMissing();
  schedulePreview();
});
$('publish').addEventListener('click', async () => {
  const on = !!S.published;
  if (on && !confirm('ยกเลิกการเผยแพร่สูจิบัตร? ผู้ชมจะเปิดสูจิบัตรไม่ได้จนกว่าจะเผยแพร่อีกครั้ง')) return;
  if (!on && !confirm(`เผยแพร่สูจิบัตรนี้ให้ผู้ชม${dirty() ? ' (จะบันทึกการตั้งค่าที่แก้ไว้ด้วย)' : ''}?`)) return;
  if (await save({ publish: !on })) toast(on ? 'ยกเลิกการเผยแพร่แล้ว' : 'เผยแพร่สูจิบัตรแล้ว', 'ok');
});
$('preview').addEventListener('click', (e) => {
  if (dirty()) {
    e.preventDefault();
    if (confirm('ตัวอย่างทั้งเล่มใช้การตั้งค่าที่บันทึกแล้ว บันทึกการแก้ไขตอนนี้เลยไหม?')) {
      save().then((ok) => { if (ok) window.open($('preview').href, '_blank', 'noopener'); });
    } else window.open($('preview').href, '_blank', 'noopener');
  }
});
window.addEventListener('beforeunload', (e) => { if (S.data && dirty()) { e.preventDefault(); e.returnValue = ''; } });

async function main() {
  await requireLogin();
  try {
    const [d, rv] = await Promise.all([api(`${M}/catalog?full=1`), api(`${M}/reviewers`)]);
    S.data = d;
    S.settings = normalizeSettings(d.settings);
    S.saved = json(S.settings);
    S.published = d.published_at;
    S.reviewers = (rv.reviewers || []).filter((r) => r.active).length;
    const ex = d.exhibition;
    document.title = `สูจิบัตร: ${ex.title_th}`;
    $('title').textContent = `สูจิบัตร: ${ex.title_th}`;
    $('sub').textContent = `/e/${ex.slug} · สถานะนิทรรศการ ${STATUS_TH[ex.status] || ex.status} · ผลงานจัดแสดง ${d.works.length} ชิ้น`;
    $('back').href = `/manage/${encodeURIComponent(ex.slug)}`;
    $('settings-link').href = `/manage/${encodeURIComponent(ex.slug)}#settings`;
    $('preview').href = `/e/${encodeURIComponent(ex.slug)}/catalog?preview=1`;
    $('public').href = `/e/${encodeURIComponent(ex.slug)}/catalog`;
    $('rv-hint').textContent = S.reviewers
      ? `แสดงผู้ทรงคุณวุฒิทุกท่านที่ใช้งานอยู่ของนิทรรศการนี้ (${S.reviewers} ท่าน) เลือกข้อมูลที่จะแสดง อีเมลและลิงก์พิจารณาไม่ถูกนำไปใส่`
      : 'นิทรรศการนี้ยังไม่มีผู้ทรงคุณวุฒิ หน้านี้จะไม่ปรากฏในเล่มจนกว่าจะเพิ่มในแท็บ "ผู้ทรงคุณวุฒิ"';
    if (d.template && d.template.missing) toast('เทมเพลตที่เคยเลือกถูกลบไปแล้ว ระบบใช้เทมเพลตหลักแทน', 'error');
    fillForm();
    showCover();
    showPublish();
    await renderTemplates();
    await markMissing();
    await renderPreview();
  } catch (e) {
    $('title').textContent = 'เปิดหน้าสูจิบัตรไม่ได้';
    $('sub').textContent = e.message;
    $('form').hidden = true;
  }
}
main();
