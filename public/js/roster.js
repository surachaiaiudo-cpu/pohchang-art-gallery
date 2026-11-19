// /manage/<slug>/roster - artist roster (owner's workshop process, 2026-11-14): channel, selection status,
// artist number (เลขที่ศิลปิน), withdrawn + note; artists added by hand; selection-round works kept private.
import { api, esc, toast, slugFromPath } from './core.js';
import { requireLogin } from './backoffice.js';
import { flagImg, countryName, countryOptions } from './countries.js';
import { CHANNELS, ROSTER, STAGES, formatNo } from './roster-logic.js';
import { readSpreadsheet } from './xlsx-read.js';

const slug = slugFromPath(1);
const M = `/api/manage/${encodeURIComponent(slug)}`;
const $ = (id) => document.getElementById(id);
const S = { me: null, ex: null, artists: [], coords: [], stages: { exhibit: 0, selection: 0 }, submitStage: 'exhibit', sel: new Set(), im: null, view: null };

// Separate tables by result (owner, 2026-11-19): ยังไม่พิจารณา / ผ่าน / ไม่ผ่าน / ทั้งหมด. Ticking moves the artist to
// the other table; withdrawn artists stay in their result's table (struck through). Last view remembered.
const VIEWS = [
  { key: 'pending', label: 'ยังไม่พิจารณา', test: (a) => !a.roster },
  { key: 'selected', label: 'ผ่าน', test: (a) => a.roster === 'selected' },
  { key: 'not_selected', label: 'ไม่ผ่าน', test: (a) => a.roster === 'not_selected' },
  { key: 'all', label: 'ทั้งหมด', test: () => true }
];
const VIEW_KEY = 'roster:view';
const viewOf = (key) => VIEWS.find((v) => v.key === key) || VIEWS[3];

const opts = (list, value, first) => (first ? `<option value="">${esc(first)}</option>` : '')
  + list.map((x) => `<option value="${esc(String(x.key))}"${String(x.key) === String(value) ? ' selected' : ''}>${esc(x.label)}</option>`).join('');
const label = (list, key) => (list.find((x) => String(x.key) === String(key)) || list[0]).label;
const fullName = (a) => a.name_th + (a.name_en && a.name_en !== a.name_th ? ` / ${a.name_en}` : '');

function stats() {
  const live = S.artists.filter((a) => !a.withdrawn);
  const sel = live.filter((a) => a.roster === 'selected');
  const thai = sel.filter((a) => a.nationality === 'TH').length;
  const box = (n, t) => `<div class="stat"><b>${n}</b><span>${esc(t)}</span></div>`;
  $('stats').innerHTML = [
    box(S.artists.length, 'ศิลปินทั้งหมดในรายชื่อ'),
    box(live.filter((a) => !a.roster).length, 'ยังไม่พิจารณา'),
    box(sel.length, 'ผ่าน (ไม่นับผู้ถอนตัว)'),
    box(live.filter((a) => a.roster === 'not_selected').length, 'ไม่ผ่าน'),
    box(`${sel.length - thai} / ${thai}`, 'ผ่าน: ต่างประเทศ / ไทย'),
    box(S.artists.filter((a) => a.artist_no).length, 'มีเลขที่แล้ว'),
    box(S.artists.filter((a) => a.withdrawn).length, 'ถอนตัว')
  ].join('');
}

function stageCard() {
  const { exhibit, selection } = S.stages;
  $('stage-card').hidden = false;
  $('stage-text').innerHTML = `ตอนนี้มีผลงานรอบคัดเลือก <b>${selection}</b> ชิ้น และผลงานจัดแสดง <b>${exhibit}</b> ชิ้น`;
  $('submit-stage').innerHTML = opts(STAGES, S.submitStage);
  $('stage-all').hidden = exhibit === 0;
  $('stage-back').hidden = selection === 0;
}

// Work-group filter + sort (owner, 2026-11-19): the "กลุ่มงาน" box filters by the categories of the artist's
// works (an artist with works in several groups shows under each); the sort box orders by number (default;
// no number = order added) or by name.
const SORT_KEY = 'roster:sort';
const NO_CAT = '__none__'; // not a group name: names come from the exhibition's list
const nameOf = (a) => String(a.name_th || a.name_en || '').replace(/\s+/g, ' ').trim();
const byName = (a, b) => nameOf(a).localeCompare(nameOf(b), 'th', { sensitivity: 'base' }) || (a.id - b.id);
const byNo = (a, b) => ((a.artist_no || 1e9) - (b.artist_no || 1e9)) || (a.id - b.id);
const sorted = (list) => [...list].sort($('f-sort').value === 'name' ? byName : byNo);

function catFilter() {
  const box = $('f-cat');
  const keep = box.value;
  const count = (c) => S.artists.filter((a) => (a.categories || []).includes(c)).length;
  const listed = (S.ex.categories || []).map((c) => c.name);
  const used = [...new Set(S.artists.flatMap((a) => a.categories || []).filter(Boolean))];
  const names = [...listed, ...used.filter((c) => !listed.includes(c))];
  const none = count('');
  box.innerHTML = '<option value="">ทุกกลุ่มงาน</option>'
    + names.filter((c) => count(c)).map((c) => `<option value="${esc(c)}">${esc(c)} (${count(c)})</option>`).join('')
    + (none ? `<option value="${NO_CAT}">ไม่ระบุกลุ่มงาน (${none})</option>` : '');
  box.value = [...box.options].some((o) => o.value === keep) ? keep : '';
}

function visible() {
  const ch = $('f-channel').value;
  const cat = $('f-cat').value;
  const q = $('f-q').value.trim().toLowerCase();
  return sorted(S.artists.filter((a) => {
    if (ch !== '' && String(a.channel) !== ch) return false;
    if (cat && !(a.categories || []).includes(cat === NO_CAT ? '' : cat)) return false;
    if (!viewOf(S.view).test(a)) return false;
    if (!q) return true;
    const hay = [a.name_th, a.name_en, a.name_zh, a.affiliation, countryName(a.nationality, 'th'), countryName(a.nationality, 'en'), formatNo(a.artist_no)]
      .join(' ').toLowerCase();
    return hay.includes(q);
  }));
}

function rows() {
  const list = visible();
  $('sel-count').textContent = S.sel.size ? `(เลือก ${S.sel.size})` : '';
  $('sel-all').checked = list.length > 0 && list.every((a) => S.sel.has(a.id));
  if (!list.length) { $('rows').innerHTML = '<tr><td colspan="11" class="muted">ไม่มีศิลปินตามเงื่อนไขนี้</td></tr>'; return; }
  $('rows').innerHTML = list.map((a) => {
    const works = [
      a.works_selection ? `<span class="tag tag-sel" title="ผลงานรอบคัดเลือก (ไม่เผยแพร่)">รอบคัดเลือก ${a.works_selection}</span>` : '',
      a.works_selection ? `<span class="tag ${a.selection_endorsed ? 'tag-endorsed' : 'tag-needs'}" title="ผลงานรอบคัดเลือกที่ผ่านเกณฑ์ผู้ทรงฯ / ที่ส่งให้ผู้ทรงฯ พิจารณา">ผ่าน ${a.selection_endorsed}/${a.selection_reviewed}</span>` : '',
      a.works_exhibit ? `<span class="tag tag-shown">จัดแสดง ${a.works_exhibit}</span>` : ''
    ].join('') || '<span class="muted small">—</span>';
    return `<tr data-id="${a.id}" class="${a.withdrawn ? 'ro-out' : ''}">
      <td><input type="checkbox" data-sel aria-label="เลือก ${esc(a.name_th)}"${S.sel.has(a.id) ? ' checked' : ''}></td>
      <td class="ro-no"><input type="text" inputmode="numeric" maxlength="3" data-f="artist_no" value="${esc(formatNo(a.artist_no))}" aria-label="เลขที่ศิลปิน ${esc(a.name_th)}" placeholder="—"></td>
      <td class="ro-name"><b>${esc(fullName(a))}</b><span class="small muted">${flagImg(a.nationality, {}, esc)}${esc(countryName(a.nationality, 'th') || 'ไม่ระบุประเทศ')}${a.affiliation ? ` · ${esc(a.affiliation)}` : ''}</span></td>
      <td><select data-f="channel" aria-label="ช่องทาง">${opts(CHANNELS, a.channel)}</select></td>
      <td class="ro-pass"><label class="check"><input type="checkbox" data-pass="selected" aria-label="ผ่าน ${esc(a.name_th)}"${a.roster === 'selected' ? ' checked' : ''}> ผ่าน</label>
        <label class="check"><input type="checkbox" data-pass="not_selected" aria-label="ไม่ผ่าน ${esc(a.name_th)}"${a.roster === 'not_selected' ? ' checked' : ''}> ไม่ผ่าน</label></td>
      <td class="ro-coord">${coordCell(a)}</td>
      <td class="small">${(a.categories || []).length ? a.categories.map((c) => (c ? esc(c) : '<span class="muted">ไม่ระบุ</span>')).join('<br>') : '<span class="muted">—</span>'}</td>
      <td class="ro-works">${works}</td>
      <td><input type="checkbox" data-f="withdrawn" aria-label="ถอนตัว"${a.withdrawn ? ' checked' : ''}></td>
      <td class="ro-note"><input type="text" maxlength="500" data-f="roster_note" value="${esc(a.roster_note || '')}" aria-label="หมายเหตุ" placeholder="${a.withdrawn ? 'เหตุผลที่ถอนตัว' : ''}"></td>
      <td>${a.works_selection || a.works_exhibit ? '' : '<button class="btn btn-danger btn-sm" type="button" data-del>ลบ</button>'}</td>
    </tr>`;
  }).join('');
}

function views() {
  if (!S.view) {
    let saved = null;
    try { saved = localStorage.getItem(VIEW_KEY); } catch { /* no storage */ }
    S.view = VIEWS.some((v) => v.key === saved) ? saved : (S.artists.some((a) => !a.roster) ? 'pending' : 'selected');
  }
  $('views').innerHTML = VIEWS.map((v) => `<button type="button" role="tab" data-view="${v.key}" aria-controls="ro-panel" aria-selected="${v.key === S.view}">${esc(v.label)} (${S.artists.filter(v.test).length})</button>`).join('');
}

// Coordinators (owner, 2026-11-19): one per artist, chosen here; progress (notified / signed) comes from /coord.
const when = (s) => (s ? new Date(`${s.replace(' ', 'T')}Z`) : null);
const fmtDate = (d) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
function progress(a) {
  if (a.accepted_at) return `<span class="small co-signed">✓ ลงนามแล้ว ${fmtDate(when(a.accepted_at))}</span>`;
  if (a.notified_at) return `<span class="small co-wait">แจ้งแล้ว ${fmtDate(when(a.notified_at))}</span>`;
  return a.roster === 'selected' ? '<span class="small co-todo">ยังไม่แจ้ง</span>' : '';
}
function coordCell(a) {
  if (!S.coords.length && !a.coordinator_id) return '<span class="small muted">— (admin ยังไม่เพิ่มผู้ประสานงาน)</span>';
  return `<select data-f="coordinator_id" aria-label="ผู้ประสานงานของ ${esc(a.name_th)}"><option value="">— ไม่มี —</option>${S.coords
    .map((c) => `<option value="${c.id}"${c.id === a.coordinator_id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select><div>${progress(a)}</div>`;
}
function coordSummary() {
  const sel = S.artists.filter((a) => a.roster === 'selected' && !a.withdrawn);
  if (!S.coords.length || !sel.length) { $('coord-sum').hidden = true; return; }
  const line = (name, list) => `<tr><td>${esc(name)}</td><td>${list.length}</td><td>${list.filter((a) => a.notified_at && !a.accepted_at).length}</td><td>${list.filter((a) => a.accepted_at).length}</td><td>${list.filter((a) => !a.notified_at && !a.accepted_at).length}</td></tr>`;
  const none = sel.filter((a) => !a.coordinator_id);
  $('coord-sum').hidden = false;
  $('coord-sum').innerHTML = `<h2 style="margin-top:0">ผู้ประสานงาน (ศิลปินที่ผ่าน ไม่นับผู้ถอนตัว)</h2>
    <div class="table-wrap"><table><thead><tr><th scope="col">ผู้ประสานงาน</th><th scope="col">ดูแล</th><th scope="col">แจ้งแล้ว รอลงนาม</th><th scope="col">ลงนามแล้ว</th><th scope="col">ยังไม่แจ้ง</th></tr></thead><tbody>
    ${S.coords.map((c) => line(c.name, sel.filter((a) => a.coordinator_id === c.id))).join('')}
    ${none.length ? line('ยังไม่กำหนดผู้ประสานงาน', none) : ''}</tbody></table></div>`;
}

const render = () => { stats(); stageCard(); coordSummary(); catFilter(); views(); rows(); };

async function load() {
  const d = await api(`${M}/roster`);
  S.artists = d.artists;
  S.stages = d.work_stages;
  S.submitStage = d.submit_stage;
  S.coords = d.coordinators || [];
  const ids = new Set(S.artists.map((a) => a.id));
  for (const id of [...S.sel]) if (!ids.has(id)) S.sel.delete(id);
  render();
}

async function saveField(a, field, input) {
  let value;
  if (field === 'withdrawn') value = input.checked;
  else if (field === 'channel') value = Number(input.value);
  else if (field === 'coordinator_id') value = input.value ? Number(input.value) : null;
  else if (field === 'artist_no') {
    const t = input.value.trim();
    if (t === formatNo(a.artist_no)) return;
    value = t === '' ? null : Number(t);
    if (value !== null && (!Number.isInteger(value) || value < 1 || value > 999)) {
      toast('เลขที่ต้องเป็นตัวเลข 1–999', 'error'); input.value = formatNo(a.artist_no); return;
    }
    if (a.artist_no && value !== a.artist_no
        && !confirm(`เปลี่ยนเลขที่ของ ${a.name_th} จาก ${formatNo(a.artist_no)} เป็น ${value === null ? '(ไม่มีเลข)' : formatNo(value)} ?\nเอกสารที่พิมพ์ไปแล้วจะไม่ตรงกัน`)) {
      input.value = formatNo(a.artist_no); return;
    }
  } else value = input.value;
  if (field === 'withdrawn' && value && a.artist_no) toast(`คงเลขที่ ${formatNo(a.artist_no)} ไว้ให้ ${a.name_th} — ใส่หมายเหตุได้ในช่องท้ายแถว`);
  try {
    await api(`${M}/roster/${a.id}`, { method: 'PUT', body: { [field]: value } });
    Object.assign(a, { [field]: field === 'withdrawn' ? (value ? 1 : 0) : value });
    if (field === 'roster' && !viewOf(S.view).test(a)) toast(`ย้าย ${a.name_th} ไปตาราง “${viewOf(value || 'pending').label}” แล้ว`);
    if (['withdrawn', 'roster', 'artist_no', 'coordinator_id'].includes(field)) render();
    else stats();
  } catch (err) {
    toast(err.message, 'error');
    await load();
  }
}

function wire() {
  $('f-channel').innerHTML = `<option value="">ทุกช่องทาง</option>${opts(CHANNELS, '')}`;
  $('f-channel').value = '';
  $('views').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    S.view = b.dataset.view;
    try { localStorage.setItem(VIEW_KEY, S.view); } catch { /* no storage */ }
    views();
    rows();
  });
  $('b-channel').innerHTML = opts(CHANNELS, '', '— ช่องทาง (ไม่เปลี่ยน) —');
  $('b-roster').innerHTML = `<option value="*">— สถานะ (ไม่เปลี่ยน) —</option>${opts(ROSTER, '*')}`;
  $('a-channel').innerHTML = opts(CHANNELS, 1);
  $('a-roster').innerHTML = opts(ROSTER, 'selected');
  $('a-nat').innerHTML = `<option value="">— ไม่ระบุ —</option>${countryOptions('th', '', esc)}`;
  for (const id of ['f-channel', 'f-cat']) $(id).addEventListener('change', rows);
  try { const saved = localStorage.getItem(SORT_KEY); if (saved && [...$('f-sort').options].some((o) => o.value === saved)) $('f-sort').value = saved; } catch { /* no storage */ }
  $('f-sort').addEventListener('change', () => {
    try { localStorage.setItem(SORT_KEY, $('f-sort').value); } catch { /* no storage */ }
    rows();
  });
  $('f-q').addEventListener('input', rows);

  $('rows').addEventListener('change', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const a = S.artists.find((x) => x.id === Number(tr.dataset.id));
    if (e.target.matches('[data-sel]')) {
      if (e.target.checked) S.sel.add(a.id); else S.sel.delete(a.id);
      $('sel-count').textContent = S.sel.size ? `(เลือก ${S.sel.size})` : '';
      return;
    }
    // Pass / not pass ticks (owner, 2026-11-19): one at a time; neither ticked = not considered yet.
    if (e.target.dataset.pass) {
      saveField(a, 'roster', { value: e.target.checked ? e.target.dataset.pass : '' });
      return;
    }
    if (e.target.dataset.f) saveField(a, e.target.dataset.f, e.target);
  });
  $('rows').addEventListener('click', async (e) => {
    if (!e.target.matches('[data-del]')) return;
    const a = S.artists.find((x) => x.id === Number(e.target.closest('tr').dataset.id));
    if (!confirm(`ลบ ${a.name_th} ออกจากรายชื่อ?`)) return;
    try { await api(`${M}/roster/${a.id}`, { method: 'DELETE' }); toast('ลบแล้ว'); await load(); } catch (err) { toast(err.message, 'error'); }
  });
  $('sel-all').addEventListener('change', (e) => {
    for (const a of visible()) if (e.target.checked) S.sel.add(a.id); else S.sel.delete(a.id);
    rows();
  });
  $('b-apply').addEventListener('click', async () => {
    if (!S.sel.size) { toast('ยังไม่ได้เลือกศิลปิน', 'error'); return; }
    const body = { action: 'set', ids: [...S.sel] };
    if ($('b-channel').value !== '') body.channel = Number($('b-channel').value);
    if ($('b-roster').value !== '*') body.roster = $('b-roster').value;
    if ($('b-coord').value !== '*') body.coordinator_id = $('b-coord').value ? Number($('b-coord').value) : null;
    if (body.channel === undefined && body.roster === undefined && body.coordinator_id === undefined) { toast('เลือกช่องทาง สถานะ หรือผู้ประสานงานที่จะตั้งก่อน', 'error'); return; }
    try {
      const r = await api(`${M}/roster`, { method: 'POST', body });
      toast(`ปรับแล้ว ${r.updated} ท่าน`);
      S.sel.clear();
      await load();
    } catch (err) { toast(err.message, 'error'); }
  });

  $('number').addEventListener('click', async () => {
    const todo = S.artists.filter((a) => a.roster === 'selected' && !a.withdrawn && !a.artist_no).length;
    if (!todo) { toast('ไม่มีศิลปินที่ผ่านและยังไม่มีเลขที่', 'error'); return; }
    const has = S.artists.some((a) => a.artist_no);
    const msg = has
      ? `มีศิลปินที่มีเลขที่แล้ว เลขใหม่ ${todo} ท่านจะต่อท้ายเลขสุดท้าย (ไม่เรียงปนกับเลขเดิม)\nดำเนินการต่อ?`
      : `ให้เลขที่ 3 หลักกับศิลปินที่ผ่าน ${todo} ท่าน?\nเลขที่ให้แล้วจะไม่เปลี่ยนเอง`;
    if (!confirm(msg)) return;
    try {
      const r = await api(`${M}/roster`, { method: 'POST', body: { action: 'number' } });
      toast(`ให้เลขที่แล้ว ${r.numbered} ท่าน${r.skipped ? ` (เกิน 999: ${r.skipped})` : ''}`);
      await load();
    } catch (err) { toast(err.message, 'error'); }
  });
  $('clear-numbers').addEventListener('click', async () => {
    if (!confirm('ล้างเลขที่ศิลปินทั้งหมดของนิทรรศการนี้? (ใช้ก่อนพิมพ์เอกสารเท่านั้น)')) return;
    try { const r = await api(`${M}/roster`, { method: 'POST', body: { action: 'clear_numbers' } }); toast(`ล้างแล้ว ${r.cleared} ท่าน`); await load(); } catch (err) { toast(err.message, 'error'); }
  });

  $('submit-stage').addEventListener('change', async (e) => {
    try {
      await api(M, { method: 'PUT', body: { submit_stage: e.target.value } });
      S.submitStage = e.target.value;
      toast(`ผลงานที่ส่งทางฟอร์มต่อจากนี้: ${label(STAGES, e.target.value)}`);
    } catch (err) { toast(err.message, 'error'); e.target.value = S.submitStage; }
  });
  const stageAll = async (stage) => {
    const n = stage === 'selection' ? S.stages.exhibit : S.stages.selection;
    const typed = prompt(`เปลี่ยนผลงาน ${n} ชิ้นเป็น “${label(STAGES, stage)}”\nพิมพ์รหัสนิทรรศการ "${S.ex.slug}" เพื่อยืนยัน`);
    if (typed === null) return;
    try {
      const r = await api(`${M}/roster`, { method: 'POST', body: { action: 'stage_all', stage, confirm: typed.trim() } });
      toast(`เปลี่ยนแล้ว ${r.updated} ชิ้น`);
      await load();
    } catch (err) { toast(err.message, 'error'); }
  };
  $('stage-all').addEventListener('click', () => stageAll('selection'));
  $('stage-back').addEventListener('click', () => stageAll('exhibit'));

  $('add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      action: 'add',
      channel: Number($('a-channel').value),
      roster: $('a-roster').value,
      artist: {
        name_th: $('a-name-th').value, name_en: $('a-name-en').value, academic_title_th: $('a-title').value,
        nationality: $('a-nat').value, email: $('a-email').value, phone: $('a-phone').value, affiliation: $('a-aff').value
      }
    };
    const send = async (force) => {
      await api(`${M}/roster`, { method: 'POST', body: { ...body, force } });
      toast(`เพิ่ม ${body.artist.name_th} แล้ว`);
      $('add-form').reset();
      $('a-channel').value = String(body.channel);
      $('a-roster').value = body.roster;
      await load();
    };
    try {
      await send(false);
    } catch (err) {
      if (err.status === 409 && err.data && err.data.duplicate) {
        const d = err.data.duplicate;
        if (confirm(`มีศิลปินชื่อ “${d.name_th}${d.name_en ? ` / ${d.name_en}` : ''}” ในรายชื่อแล้ว\nยังต้องการเพิ่มเป็นอีกคนหนึ่งหรือไม่?`)) {
          try { await send(true); } catch (e2) { toast(e2.message, 'error'); }
        }
      } else toast(err.message, 'error');
    }
  });
}

// ------------------------------------------------------------- import from Excel (owner, 2026-11-17)
function importPreview() {
  const { rows } = S.im.result;
  const ok = rows.filter((r) => !r.errors.length && !r.duplicate).length;
  const dup = rows.filter((r) => !r.errors.length && r.duplicate).length;
  const bad = rows.filter((r) => r.errors.length).length;
  const force = rows.filter((r) => S.im.force.has(r.line)).length;
  $('im-summary').innerHTML = `ทั้งหมด <b>${rows.length}</b> แถว · พร้อมนำเข้า <b class="im-ok">${ok}</b>`
    + ` · ชื่อซ้ำ <b class="im-dup">${dup}</b> (ข้าม เว้นแต่ติ๊ก “เพิ่มอยู่ดี”) · มีปัญหา <b class="im-bad">${bad}</b> (ข้าม แก้ในไฟล์แล้วนำเข้าใหม่)`;
  $('im-go').textContent = `บันทึกเข้ารายชื่อ ${ok + force} ท่าน`;
  $('im-go').disabled = ok + force === 0;
  $('im-rows').innerHTML = rows.map((r) => {
    const a = r.artist;
    let state;
    if (r.errors.length) state = `<span class="im-bad">✕ ${esc(r.errors.join(' · '))}</span>`;
    else if (r.duplicate) {
      const who = r.duplicate.where === 'list'
        ? `ชื่อซ้ำกับ “${esc(r.duplicate.name_th)}${r.duplicate.name_en ? ` / ${esc(r.duplicate.name_en)}` : ''}” ในรายชื่อ`
        : `ชื่อซ้ำกับแถว ${r.duplicate.line} ในไฟล์`;
      state = `<span class="im-dup">⚠ ${who}</span><label class="check small" style="min-height:0"><input type="checkbox" data-force="${r.line}"${S.im.force.has(r.line) ? ' checked' : ''}> เพิ่มอยู่ดี</label>`;
    } else state = '<span class="im-ok">✓ พร้อม</span>';
    const skip = r.errors.length || (r.duplicate && !S.im.force.has(r.line));
    return `<tr class="${skip ? 'im-skip' : ''}">
      <td>${r.line}</td><td>${state}</td>
      <td class="ro-name"><b>${esc(a.name_th || '—')}</b>${a.name_en && a.name_en !== a.name_th ? `<span class="small">${esc(a.name_en)}</span>` : ''}${a.academic_title_th ? `<span class="small muted">${esc(a.academic_title_th)}</span>` : ''}</td>
      <td class="small">${a.nationality ? `${flagImg(a.nationality, {}, esc)}${esc(countryName(a.nationality, 'th'))}` : '<span class="muted">—</span>'}</td>
      <td class="small">${esc(label(CHANNELS, r.channel))}</td>
      <td class="small">${esc(label(ROSTER, r.roster))}${r.roster_note ? `<br><span class="muted">${esc(r.roster_note)}</span>` : ''}</td>
      <td class="small muted">${esc([a.email, a.phone, a.affiliation].filter(Boolean).join(' · ') || '—')}${r.coordinator_id ? `<br>ผู้ประสานงาน: ${esc((S.coords.find((c) => c.id === r.coordinator_id) || {}).name || '')}` : ''}</td>
    </tr>`;
  }).join('');
  $('im-preview').hidden = false;
}

function importReset() {
  S.im = null;
  $('im-preview').hidden = true;
  $('im-file').value = '';
  $('im-name').textContent = '';
}

function wireImport() {
  $('im-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    $('im-name').textContent = `กำลังอ่าน ${file.name}…`;
    try {
      const rows = await readSpreadsheet(file);
      if (!rows.length) throw new Error('ไฟล์นี้ไม่มีข้อมูลในแผ่นงานแรก');
      const result = await api(`${M}/roster`, { method: 'POST', body: { action: 'import_preview', rows } });
      S.im = { rows, result, force: new Set() };
      $('im-name').textContent = `${file.name} · หัวตารางแถวที่ ${result.headerLine}`;
      importPreview();
    } catch (err) {
      importReset();
      toast(err.message, 'error');
    }
  });
  $('im-rows').addEventListener('change', (e) => {
    if (!e.target.matches('[data-force]')) return;
    const line = Number(e.target.dataset.force);
    if (e.target.checked) S.im.force.add(line); else S.im.force.delete(line);
    importPreview();
  });
  $('im-cancel').addEventListener('click', importReset);
  $('im-go').addEventListener('click', async () => {
    if (!S.im) return;
    $('im-go').disabled = true;
    try {
      const r = await api(`${M}/roster`, { method: 'POST', body: { action: 'import', rows: S.im.rows, force_lines: [...S.im.force] } });
      toast(`นำเข้าแล้ว ${r.added} ท่าน${r.skipped ? ` · ข้าม ${r.skipped} แถว` : ''}`);
      importReset();
      await load();
    } catch (err) {
      toast(err.message, 'error');
      $('im-go').disabled = false;
    }
  });
}

(async () => {
  try {
    S.me = await requireLogin();
    const d = await api(M);
    S.ex = d.exhibition;
    document.title = `รายชื่อศิลปิน · ${S.ex.title_th}`;
    $('ex-sub').textContent = S.ex.title_th;
    $('back').href = `/manage/${encodeURIComponent(S.ex.slug)}`;
    $('coord-link').href = `/coord/${encodeURIComponent(S.ex.slug)}`;
    $('clear-numbers').hidden = S.me.user.role !== 'admin';
    wire();
    wireImport();
    await load();
    $('b-coord').innerHTML = `<option value="*">— ผู้ประสานงาน (ไม่เปลี่ยน) —</option><option value="">ไม่มีผู้ประสานงาน</option>${S.coords
      .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}`;
    $('b-coord').hidden = !S.coords.length;
  } catch (err) {
    if (err.message !== 'redirect') $('ex-sub').textContent = err.message;
  }
})();
