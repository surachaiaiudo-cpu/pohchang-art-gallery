// /catalog-templates/:id - catalogue template designer. Boxes are placed on a real A4 page in millimetres;
// the page is drawn with the same renderer as the catalogue, using made-up data or a real exhibition's works.
// :id is a number (shared template) or "b-<key>" for a built-in template (read only: save as a new one).
import { api, esc, toast } from './core.js';
import { requireLogin } from './backoffice.js';
import {
  ALL_FIELDS, CATALOG_FONTS, LANG_CODES, LANG_NAMES, PAGE, normalizeLayout, normalizeSettings,
  isImageField, MAX_BLOCKS, DATA_FIELDS, PAGE_SIZES, PT_SIZES, NAMED_COLORS, PRINT_PALETTE, cmykToHex, cmykText, cmykOf
} from './catalog-core.js';
import { blocksHtml, fitText, themeVars, loadBookFonts } from './catalog-render.js';
import { SAMPLE_EXHIBITION, SAMPLE_WORKS } from './catalog-sample.js';

const $ = (id) => document.getElementById(id);
const rawId = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
const S = {
  t: null, layout: null, sel: null, canEdit: false, saved: '',
  ex: SAMPLE_EXHIBITION, works: SAMPLE_WORKS, wi: 0, langs: ['th', 'en'], scale: 1,
  undo: [], redo: []
};
const fieldName = (k) => (ALL_FIELDS.find((f) => f.key === k) || { th: k }).th;
const snapshot = () => JSON.stringify({ layout: S.layout, name: $('name').value, desc: $('desc').value });
const dirty = () => S.t && snapshot() !== S.saved;
const block = (id) => S.layout.blocks.find((b) => b.id === id);

// ------------------------------------------------------------------ history
function remember() {
  S.undo.push(JSON.stringify(S.layout));
  if (S.undo.length > 60) S.undo.shift();
  S.redo = [];
}
function restore(from, to) {
  if (!from.length) return;
  to.push(JSON.stringify(S.layout));
  S.layout = JSON.parse(from.pop());
  if (S.sel && !block(S.sel)) S.sel = null;
  drawAll();
}

// ------------------------------------------------------------------ drawing
function ctx() {
  const settings = normalizeSettings({ langs: S.langs, fields: Object.fromEntries(DATA_FIELDS.map((f) => [f.key, true])),
    footer: { th: 'ข้อความท้ายหน้า (ตั้งในหน้าสูจิบัตรของแต่ละนิทรรศการ)', en: 'Footer text', zh: '' } });
  return { ex: S.ex, settings, langs: settings.langs, layout: S.layout, origin: location.origin, no: S.wi + 1 };
}

function fitScale() {
  const z = $('zoom').value;
  if (z !== 'fit') return Number(z);
  const pageW = PAGE.w * 96 / 25.4;
  const pageH = PAGE.h * 96 / 25.4;
  const w = $('canvas').clientWidth - 40;
  const h = window.innerHeight - 180;
  return Math.max(0.3, Math.min(1.2, w / pageW, Math.max(h, 500) / pageH));
}

function drawPage() {
  const sheet = $('sheet');
  sheet.setAttribute('style', themeVars(S.layout));
  const w = S.works[S.wi] || SAMPLE_WORKS[0];
  sheet.innerHTML = blocksHtml(S.layout.blocks, w, ctx(), { designer: true });
  sheet.querySelectorAll('.pno').forEach((x) => { x.textContent = String(S.wi + 3); });
  fitText(sheet);
  $('stage').style.setProperty('--s', S.scale.toFixed(4));
  $('wpos').textContent = `ผลงาน ${S.wi + 1}/${S.works.length}`;
  drawLayer();
}

function drawLayer() {
  const sheet = $('sheet');
  $('layer').innerHTML = S.layout.blocks.map((b) => {
    const el = sheet.querySelector(`.blk[data-id="${CSS.escape(b.id)}"]`);
    const empty = el && !el.innerHTML.trim() && !['line', 'box'].includes(b.field);
    const over = el && el.classList.contains('overflow');
    return `<div class="dz-box${b.id === S.sel ? ' sel' : ''}${empty || over ? ' off' : ''}" data-id="${esc(b.id)}" style="${boxStyle(b)}" title="${esc(fieldName(b.field))}${empty ? ' (ผลงานนี้ไม่มีข้อมูล)' : ''}${over ? ' (ข้อความล้นกล่อง)' : ''}">
      <span class="tag-f">${esc(fieldName(b.field))}</span><span class="hd" data-h="1"></span></div>`;
  }).join('');
}
const mm = (v) => `calc(${v}mm * var(--s))`;
const boxStyle = (b) => `left:${mm(b.x)};top:${mm(b.y)};width:${mm(Math.max(b.w, 1))};height:${mm(Math.max(b.h, 1))}`;

function drawList() {
  $('blist').innerHTML = S.layout.blocks.map((b, i) => `<li role="option" data-id="${esc(b.id)}" aria-selected="${b.id === S.sel}">
    <span class="k">${i + 1}. ${esc(fieldName(b.field))}</span><span class="xy">${b.x},${b.y} · ${b.w}×${b.h}</span>
    <button type="button" class="icon-btn" data-del-id="${esc(b.id)}" aria-label="ลบ ${esc(fieldName(b.field))}" title="ลบ" style="min-width:32px;min-height:32px;padding:4px;color:var(--bad)">✕</button></li>`).join('')
    || '<li class="muted">ยังไม่มีส่วนประกอบ เลือกแล้วกด "+ เพิ่ม"</li>';
  $('bcount').textContent = `${S.layout.blocks.length} ส่วนประกอบ`;
  $('del-sel').disabled = !S.sel;
  const used = new Set(S.layout.blocks.map((b) => b.field));
  const cur = $('add-f').value;
  $('add-f').innerHTML = ALL_FIELDS.map((f) => `<option value="${f.key}">${used.has(f.key) ? '✓ ' : ''}${esc(f.th)}</option>`).join('');
  if (cur) $('add-f').value = cur;
}

function drawPanel() {
  const L = S.layout;
  $('page-colors').innerHTML = PAGE_COLORS.map(([k, label]) => cmykField(`page:${k}`, label, L.colors[k])).join('');
  drawSizes();
  $('f-head').value = L.fonts.head;
  $('f-body').value = L.fonts.body;
  drawProps();
}

const ptOptions = (cur, none = false) => `${none ? '' : '<option value="">มาตรฐาน…</option>'}${PT_SIZES.map((v) => `<option value="${v}"${Number(cur) === v ? ' selected' : ''}>${v} pt</option>`).join('')}`;
function drawSizes() {
  $('page-sizes').innerHTML = PAGE_SIZES.map((x) => `<div class="field" style="margin:0"><label class="small" for="ps-${x.key}">${x.th}</label>
    <div class="row"><input id="ps-${x.key}" type="number" step="0.5" min="4" max="72" data-size="${x.key}" value="${S.layout.sizes[x.key]}" list="pt-list" style="width:90px"><span class="small muted">pt</span></div></div>`).join('')
    + `<datalist id="pt-list">${PT_SIZES.map((v) => `<option value="${v}">`).join('')}</datalist>`;
}
const PAGE_COLORS = [['paper', 'สีกระดาษ'], ['ink', 'สีตัวอักษร'], ['muted', 'สีรอง'], ['accent', 'สีเน้น']];
const NAMED_TH = { ink: 'สีตัวอักษร', muted: 'สีรอง', accent: 'สีเน้น', paper: 'สีกระดาษ' };

// CMYK input: swatch, C M Y K boxes (0-100) and the print palette. `target` = "page:<name>" or "blk:<prop>".
function cmykField(target, label, v) {
  const box = (ch) => `<input type="number" min="0" max="100" step="1" data-cmyk="${target}" data-ch="${ch}" value="${v[ch]}" aria-label="${label} ${ch.toUpperCase()}" style="padding:4px 6px;min-height:34px">`;
  return `<div class="field"><span class="label">${label} <span class="muted small" style="font-weight:400">${cmykText(v)}</span></span>
    <div class="cmyk-row"><span class="sw" style="background:${cmykToHex(v)}"></span>
      <label class="small">C${box('c')}</label><label class="small">M${box('m')}</label><label class="small">Y${box('y')}</label><label class="small">K${box('k')}</label></div>
    <select data-pal="${target}" aria-label="ชุดสีงานพิมพ์ ${label}" style="min-height:32px;padding:2px 6px;font-size:.84rem"><option value="">ชุดสีงานพิมพ์…</option>
      ${PRINT_PALETTE.map((p, i) => `<option value="${i}">${p.th} (${cmykText(p.v)})</option>`).join('')}</select></div>`;
}

function colorField(prop, label, value) {
  const named = NAMED_COLORS.includes(value);
  const own = named ? S.layout.colors[value] : value;
  return `<div class="field"><label for="p-${prop}">${label}</label>
    <select id="p-${prop}" data-named="${prop}">${NAMED_COLORS.map((n) => `<option value="${n}"${value === n ? ' selected' : ''}>${NAMED_TH[n]} ของหน้า (${cmykText(S.layout.colors[n])})</option>`).join('')}
      <option value="custom"${named ? '' : ' selected'}>กำหนดเอง (CMYK)</option></select></div>
    ${named ? '' : cmykField(`blk:${prop}`, `${label} กำหนดเอง`, own)}`;
}

function drawProps() {
  const b = S.sel && block(S.sel);
  if (!b) {
    $('props-title').textContent = 'คุณสมบัติ';
    $('props').innerHTML = '<p class="small muted">เลือกกล่องในหน้า หรือในรายการด้านบน</p>';
    return;
  }
  $('props-title').textContent = `คุณสมบัติ: ${fieldName(b.field)}`;
  const n = (k, label, step = 0.5, min = -10, max = 320) => `<div><label class="small" for="p-${k}">${label}</label><input id="p-${k}" type="number" step="${step}" min="${min}" max="${max}" data-p="${k}" value="${b[k]}"></div>`;
  const sel = (k, label, opts) => `<div class="field"><label for="p-${k}">${label}</label><select id="p-${k}" data-p="${k}">${opts.map(([v, t]) => `<option value="${v}"${String(b[k]) === String(v) ? ' selected' : ''}>${t}</option>`).join('')}</select></div>`;
  const chk = (k, label) => `<label class="check small"><input type="checkbox" data-p="${k}"${b[k] ? ' checked' : ''}> ${label}</label>`;
  let h = `<div class="field"><span class="label">ตำแหน่งและขนาด (มม.)</span><div class="num4">${n('x', 'ซ้าย')}${n('y', 'บน')}${n('w', 'กว้าง', 0.5, 0.2)}${n('h', 'สูง', 0.5, 0.2)}</div></div>`;
  if (isImageField(b.field)) {
    if (b.field !== 'qr') h += sel('fit', 'การแสดงภาพ', [['contain', 'เต็มภาพ ไม่ตัดขอบ'], ['cover', 'เต็มกล่อง (ตัดขอบ)']]);
    if (b.field === 'image') h += sel('align', 'ชิดภาพ', [['left', 'ซ้าย'], ['center', 'กลาง'], ['right', 'ขวา']]);
    if (b.field === 'avatar') h += `<div class="field">${n('radius', 'ความมนของมุม (มม.)', 0.5, 0, 100)}</div>`;
    if (b.field === 'image') h += '<p class="small muted">หน้าผลงานแสดงภาพเต็มทั้งภาพตามหลักของเว็บ แนะนำ "เต็มภาพ ไม่ตัดขอบ"</p>';
  } else if (b.field === 'line' || b.field === 'box') {
    h += b.field === 'box' ? colorField('bg', 'สีกล่อง', b.bg) + `<div class="field">${n('radius', 'ความมนของมุม (มม.)', 0.5, 0, 100)}</div>` : colorField('color', 'สีเส้น', b.color);
  } else {
    h += `<div class="field"><label for="p-size">ขนาดตัวอักษร (pt)</label><div class="row">
      <select data-ptpick="size" aria-label="เลือกขนาดมาตรฐาน" style="width:auto">${ptOptions(b.size)}</select>
      <input id="p-size" type="number" step="0.5" min="4" max="96" data-p="size" value="${b.size}" style="width:90px"><span class="small muted">pt</span></div></div>
      <div class="field"><label for="p-altSize">ขนาดบรรทัดภาษารอง (pt)</label><div class="row">
      <select data-ptpick="altSize" style="width:auto"><option value="0"${b.altSize ? '' : ' selected'}>อัตโนมัติ (78%)</option>${ptOptions(b.altSize, true)}</select>
      <input id="p-altSize" type="number" step="0.5" min="0" max="96" data-p="altSize" value="${b.altSize}" style="width:90px"><span class="small muted">pt (0 = อัตโนมัติ)</span></div></div>
      <label class="check small"><input type="checkbox" data-p="shrink"${b.shrink ? ' checked' : ''}> ย่อขนาดอัตโนมัติเมื่อข้อความยาวเกินกล่อง (ไม่ติ๊ก = ใช้ขนาดตามที่ตั้งเสมอ)</label>
      <div class="num3">
      <div><label class="small" for="p-weight">น้ำหนัก</label><select id="p-weight" data-p="weight">${[[300, 'บาง'], [400, 'ปกติ'], [500, 'กลาง'], [600, 'หนา'], [700, 'หนามาก']].map(([v, t]) => `<option value="${v}"${b.weight === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
      <div>${n('lineHeight', 'ระยะบรรทัด', 0.05, 0.9, 3).replace('<div>', '').replace(/<\/div>$/, '')}</div></div>`;
    h += `<div class="grid-2">${sel('align', 'จัดแนว', [['left', 'ชิดซ้าย'], ['center', 'กึ่งกลาง'], ['right', 'ชิดขวา'], ['justify', 'เต็มบรรทัด']])}
      ${sel('vertical', 'แนวตั้ง', [['top', 'บน'], ['middle', 'กลาง'], ['bottom', 'ล่าง']])}
      ${sel('font', 'ฟอนต์', [['body', 'เนื้อความ'], ['head', 'หัวเรื่อง']])}</div>`;
    h += colorField('color', 'สี', b.color);
    h += `<div class="row">${chk('italic', 'ตัวเอียง')}${chk('upper', 'ตัวพิมพ์ใหญ่ (อังกฤษ)')}${['technique', 'dimensions', 'year', 'price', 'category', 'country', 'concept', 'bio', 'affiliation'].includes(b.field) ? chk('label', 'แสดงหัวข้อ เช่น "ขนาด / Size"') : ''}</div>`;
    if (b.field === 'text') {
      h += LANG_CODES.map((l) => `<div class="field"><label for="p-t-${l}">ข้อความ (${LANG_NAMES[l]})</label><textarea id="p-t-${l}" rows="2" style="min-height:56px" data-pt="${l}">${esc(b.text[l] || '')}</textarea></div>`).join('');
    }
  }
  h += `<div class="row" style="margin-top:8px">
    <button class="btn btn-ghost btn-sm" type="button" data-act="front">ไว้หน้าสุด</button>
    <button class="btn btn-ghost btn-sm" type="button" data-act="back">ไว้หลังสุด</button>
    <button class="btn btn-ghost btn-sm" type="button" data-act="dup">ทำสำเนา</button>
    <button class="btn btn-danger btn-sm" type="button" data-act="del">ลบ</button></div>`;
  $('props').innerHTML = h;
}

function drawAll() {
  S.layout = normalizeLayout(S.layout);
  drawPage();
  drawList();
  drawPanel();
}

// ------------------------------------------------------------------ edits
function select(id) {
  S.sel = id;
  drawLayer();
  drawList();
  drawProps();
}

function update(fn, { props = false } = {}) {
  remember();
  fn();
  S.layout = normalizeLayout(S.layout);
  drawPage();
  drawList();
  if (props) drawProps();
}

function newId(field) {
  let i = 1;
  while (block(`${field}${i}`)) i += 1;
  return `${field}${i}`;
}

function addBlock(field) {
  if (S.layout.blocks.length >= MAX_BLOCKS) { toast(`มีส่วนประกอบได้ไม่เกิน ${MAX_BLOCKS} กล่อง`, 'error'); return; }
  const size = isImageField(field) ? { w: field === 'image' ? 120 : 25, h: field === 'image' ? 120 : 25 }
    : field === 'line' ? { w: 100, h: 0.4 } : field === 'box' ? { w: 60, h: 40 } : { w: 80, h: field === 'concept' || field === 'bio' || field === 'text' ? 30 : 8 };
  const id = newId(field);
  update(() => {
    S.layout.blocks.push({ id, field, x: 20, y: 20, ...size, size: 10, text: { th: field === 'text' ? 'ข้อความ' : '', en: '', zh: '' } });
  });
  select(id);
}

function act(kind) {
  const b = block(S.sel);
  if (!b) return;
  const i = S.layout.blocks.indexOf(b);
  if (kind === 'del') { update(() => { S.layout.blocks.splice(i, 1); }); S.sel = null; drawLayer(); drawList(); drawProps(); return; }
  if (kind === 'dup') {
    if (S.layout.blocks.length >= MAX_BLOCKS) return;
    const id = newId(b.field);
    update(() => { S.layout.blocks.push({ ...JSON.parse(JSON.stringify(b)), id, x: b.x + 5, y: b.y + 5 }); });
    select(id);
    return;
  }
  if (kind === 'front') update(() => { S.layout.blocks.splice(i, 1); S.layout.blocks.push(b); });
  if (kind === 'back') update(() => { S.layout.blocks.splice(i, 1); S.layout.blocks.unshift(b); });
  drawLayer();
}

// Drag to move, drag the corner to resize. Positions snap to 0.5 mm.
let drag = null;
const snap = (v) => Math.round(v * 2) / 2;
$('layer').addEventListener('pointerdown', (e) => {
  const box = e.target.closest('.dz-box');
  if (!box) { select(null); return; }
  e.preventDefault();
  const b = block(box.dataset.id);
  if (S.sel !== b.id) select(b.id);
  const pxPerMm = (96 / 25.4) * S.scale;
  drag = { id: b.id, resize: !!e.target.dataset.h, sx: e.clientX, sy: e.clientY, x: b.x, y: b.y, w: b.w, h: b.h, pxPerMm, moved: false, before: JSON.stringify(S.layout) };
  $('layer').setPointerCapture(e.pointerId);
});
$('layer').addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = (e.clientX - drag.sx) / drag.pxPerMm;
  const dy = (e.clientY - drag.sy) / drag.pxPerMm;
  if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 0.3) return;
  drag.moved = true;
  const b = block(drag.id);
  if (drag.resize) { b.w = Math.max(1, snap(drag.w + dx)); b.h = Math.max(0.2, snap(drag.h + dy)); }
  else { b.x = snap(drag.x + dx); b.y = snap(drag.y + dy); }
  const el = $('sheet').querySelector(`.blk[data-id="${CSS.escape(b.id)}"]`);
  if (el) Object.assign(el.style, { left: `${b.x}mm`, top: `${b.y}mm`, width: `${b.w}mm`, height: `${b.h}mm` });
  const box = $('layer').querySelector(`.dz-box[data-id="${CSS.escape(b.id)}"]`);
  if (box) box.setAttribute('style', boxStyle(b));
});
const endDrag = () => {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!d.moved) return;
  S.undo.push(d.before);
  S.redo = [];
  drawPage();
  drawList();
  drawProps();
};
$('layer').addEventListener('pointerup', endDrag);
$('layer').addEventListener('pointercancel', endDrag);

$('blist').addEventListener('click', (e) => {
  const del = e.target.closest('[data-del-id]');
  if (del) { S.sel = del.dataset.delId; act('del'); return; }
  const li = e.target.closest('[data-id]');
  if (li) select(li.dataset.id);
});
$('del-sel').addEventListener('click', () => act('del'));
$('add').addEventListener('click', () => addBlock($('add-f').value));
$('props').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act); });
$('props').addEventListener('change', (e) => {
  const b = block(S.sel);
  if (!b) return;
  const el = e.target;
  if (el.dataset.cmyk || el.dataset.pal) return; // handled by the panel-wide colour handler
  if (el.dataset.ptpick) {
    if (el.value === '') return;
    update(() => { b[el.dataset.ptpick] = Number(el.value); }, { props: true });
    return;
  }
  if (el.dataset.named) {
    const k = el.dataset.named;
    update(() => { b[k] = el.value === 'custom' ? { ...S.layout.colors[NAMED_COLORS.includes(b[k]) ? b[k] : 'ink'] } : el.value; }, { props: true });
  } else if (el.dataset.p) {
    const k = el.dataset.p;
    const val = el.type === 'checkbox' ? el.checked : el.type === 'number' || k === 'weight' ? Number(el.value) : el.value;
    update(() => { b[k] = val; }, { props: k === 'size' || k === 'altSize' });
  } else if (el.dataset.pt) {
    update(() => { b.text = { ...b.text, [el.dataset.pt]: el.value }; });
  }
});
// CMYK boxes and palette picks, for page colours and the selected block alike.
function setColor(target, value) {
  const [scope, key] = target.split(':');
  if (scope === 'page') S.layout.colors[key] = value;
  else { const b = block(S.sel); if (b) b[key] = value; }
}
function getColor(target) {
  const [scope, key] = target.split(':');
  return scope === 'page' ? S.layout.colors[key] : (block(S.sel) || {})[key];
}
document.querySelector('.dz-panel').addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.size) {
    update(() => { S.layout.sizes[el.dataset.size] = Number(el.value); });
    return;
  }
  if (el.dataset.cmyk) {
    const cur = cmykOf(getColor(el.dataset.cmyk), { c: 0, m: 0, y: 0, k: 0 });
    update(() => setColor(el.dataset.cmyk, cmykOf({ ...cur, [el.dataset.ch]: el.value }, cur)), { props: true });
    drawPanelColors();
  } else if (el.dataset.pal && el.value !== '') {
    update(() => setColor(el.dataset.pal, { ...PRINT_PALETTE[Number(el.value)].v }), { props: true });
    drawPanelColors();
  }
});
function drawPanelColors() {
  $('page-colors').innerHTML = PAGE_COLORS.map(([k, label]) => cmykField(`page:${k}`, label, S.layout.colors[k])).join('');
}

document.querySelector('.dz-panel').addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.font) update(() => { S.layout.fonts[el.dataset.font] = el.value; }), loadBookFonts(S.layout).then(drawPage);
});

document.addEventListener('keydown', (e) => {
  const typing = e.target.closest('input, textarea, select');
  if ((e.ctrlKey || e.metaKey) && !typing) {
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); restore(S.undo, S.redo); return; }
    if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); restore(S.redo, S.undo); return; }
    if (k === 'd') { e.preventDefault(); act('dup'); return; }
  }
  if (typing || !S.sel) return;
  const b = block(S.sel);
  if (!b) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); act('del'); return; }
  const step = e.shiftKey ? 5 : 0.5;
  const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
  if (mv) { e.preventDefault(); update(() => { b.x += mv[0]; b.y += mv[1]; }, { props: true }); }
});

$('undo').addEventListener('click', () => restore(S.undo, S.redo));
$('redo').addEventListener('click', () => restore(S.redo, S.undo));
$('grid').addEventListener('change', (e) => $('stage').classList.toggle('grid', e.target.checked));
$('zoom').addEventListener('change', () => { S.scale = fitScale(); drawPage(); });
window.addEventListener('resize', () => { if ($('zoom').value === 'fit') { S.scale = fitScale(); drawPage(); } });
$('prev').addEventListener('click', () => { S.wi = (S.wi - 1 + S.works.length) % S.works.length; drawPage(); });
$('next').addEventListener('click', () => { S.wi = (S.wi + 1) % S.works.length; drawPage(); });
$('langs').addEventListener('change', () => {
  const on = [...document.querySelectorAll('[data-lang-on]')].filter((x) => x.checked).map((x) => x.dataset.langOn);
  S.langs = on.length ? on : ['th'];
  drawPage();
});
$('src').addEventListener('change', async (e) => {
  const slug = e.target.value;
  try {
    if (!slug) { S.ex = SAMPLE_EXHIBITION; S.works = SAMPLE_WORKS; }
    else {
      const d = await api(`/api/manage/${encodeURIComponent(slug)}/catalog?full=1`);
      S.ex = d.exhibition;
      S.works = d.works.length ? d.works : SAMPLE_WORKS;
      if (!d.works.length) toast('นิทรรศการนี้ยังไม่มีผลงานที่จัดแสดง ใช้ข้อมูลสมมติแทน');
    }
    S.wi = 0;
    drawPage();
  } catch (err) { toast(err.message, 'error'); }
});

async function saveAs() {
  const name = prompt('ชื่อเทมเพลตใหม่', `${$('name').value || S.t.name} (สำเนา)`);
  if (!name) return;
  try {
    const d = await api('/api/catalog-templates', { method: 'POST', body: { name, description: $('desc').value, layout: S.layout } });
    S.saved = snapshot();
    location.href = `/catalog-templates/${d.id}`;
  } catch (err) { toast(err.message, 'error'); }
}
$('save-new').addEventListener('click', saveAs);
$('save').addEventListener('click', async () => {
  if (!S.canEdit) { saveAs(); return; }
  try {
    await api(`/api/catalog-templates/${S.t.id}`, { method: 'PUT', body: { name: $('name').value, description: $('desc').value, layout: S.layout } });
    S.saved = snapshot();
    toast(S.t.used_by && S.t.used_by.length ? `บันทึกแล้ว มีผลกับสูจิบัตรของ ${S.t.used_by.length} นิทรรศการที่ใช้เทมเพลตนี้` : 'บันทึกเทมเพลตแล้ว', 'ok');
  } catch (err) { toast(err.message, 'error'); }
});
window.addEventListener('beforeunload', (e) => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });

async function main() {
  const me = await requireLogin();
  try {
    const d = await api(`/api/catalog-templates/${encodeURIComponent(rawId)}`);
    S.t = d.template;
    S.canEdit = !!S.t.can_edit;
    S.layout = normalizeLayout(S.t.layout);
  } catch (err) {
    $('name').value = '';
    $('meta').textContent = err.message;
    document.querySelector('.dz').hidden = true;
    return;
  }
  document.title = `ออกแบบ: ${S.t.name}`;
  $('name').value = S.t.name;
  $('desc').value = S.t.description || '';
  $('name').readOnly = !S.canEdit;
  $('meta').textContent = S.t.builtin ? 'เทมเพลตหลักของระบบ' : `สร้างโดย ${S.t.author || '—'}${S.t.used_by.length ? ` · ใช้อยู่ใน ${S.t.used_by.map((x) => x.title_th).join(', ')}` : ' · ยังไม่มีนิทรรศการใช้'}`;
  if (!S.canEdit) {
    $('ro').hidden = false;
    $('ro').textContent = S.t.builtin
      ? 'เทมเพลตหลักของระบบแก้ทับไม่ได้ ทดลองปรับได้ตามต้องการ แล้วกด "บันทึกเป็นแบบใหม่" เพื่อเก็บเป็นเทมเพลตของคุณ'
      : 'เทมเพลตนี้สร้างโดยผู้ใช้อื่น ปรับแล้วกด "บันทึกเป็นแบบใหม่" เพื่อเก็บเป็นเทมเพลตของคุณ';
    $('save').hidden = true;
  }
  $('f-head').innerHTML = CATALOG_FONTS.map((f) => `<option>${esc(f)}</option>`).join('');
  $('f-body').innerHTML = $('f-head').innerHTML;
  $('langs').innerHTML = LANG_CODES.map((l) => `<label class="check small"><input type="checkbox" data-lang-on="${l}"${S.langs.includes(l) ? ' checked' : ''}> ${LANG_NAMES[l]}</label>`).join('');
  $('src').insertAdjacentHTML('beforeend', (me.exhibitions || []).map((x) => `<option value="${esc(x.slug)}">${esc(x.title_th)}</option>`).join(''));
  S.saved = snapshot();
  await loadBookFonts(S.layout);
  S.scale = fitScale();
  drawAll();
}
main().catch((e) => { if (e.message !== 'redirect') toast(e.message, 'error'); });
