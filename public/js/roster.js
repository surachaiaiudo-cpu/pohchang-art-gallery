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
const S = { me: null, ex: null, artists: [], stages: { exhibit: 0, selection: 0 }, submitStage: 'exhibit', sel: new Set(), im: null };

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
    box(live.filter((a) => a.roster === 'candidate').length, 'รอผลคัดเลือก'),
    box(sel.length, 'ได้รับคัดเลือก'),
    box(`${sel.length - thai} / ${thai}`, 'ได้รับคัดเลือก: ต่างประเทศ / ไทย'),
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

// Sort (owner, 2026-11-19): by number (default), by artist name, or by technique then name. The technique
// of an artist = the technique group of their first work (the exhibition's list order; not confirmed last).
const SORT_KEY = 'roster:sort';
const nameOf = (a) => String(a.name_th || a.name_en || '').replace(/\s+/g, ' ').trim();
const byName = (a, b) => nameOf(a).localeCompare(nameOf(b), 'th', { sensitivity: 'base' }) || (a.id - b.id);
const byNo = (a, b) => ((a.artist_no || 1e9) - (b.artist_no || 1e9)) || (a.id - b.id);
function techRank(a) {
  const names = (S.ex.techniques || []).map((t) => t.name);
  if (!(a.techniques || []).length) return [names.length + 2, '']; // no works yet: last
  const t = a.techniques.find(Boolean) || '';
  if (!t) return [names.length + 1, '']; // technique not confirmed yet
  const i = names.indexOf(t);
  return [i >= 0 ? i : names.length, t];
}
function sorted(list) {
  const how = $('f-sort').value;
  if (how === 'name') return [...list].sort(byName);
  if (how === 'technique') {
    return [...list].sort((a, b) => {
      const [ra, ta] = techRank(a);
      const [rb, tb] = techRank(b);
      return (ra - rb) || ta.localeCompare(tb, 'th') || byName(a, b);
    });
  }
  return [...list].sort(byNo);
}

function visible() {
  const ch = $('f-channel').value;
  const ro = $('f-roster').value;
  const q = $('f-q').value.trim().toLowerCase();
  return sorted(S.artists.filter((a) => {
    if (ch !== '' && String(a.channel) !== ch) return false;
    if (ro === 'withdrawn') { if (!a.withdrawn) return false; } else if (ro !== '*' && ro !== a.roster) return false;
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
  if (!list.length) { $('rows').innerHTML = '<tr><td colspan="10" class="muted">ไม่มีศิลปินตามเงื่อนไขนี้</td></tr>'; return; }
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
      <td><select data-f="roster" aria-label="สถานะการคัดเลือก">${opts(ROSTER, a.roster)}</select></td>
      <td class="small">${(a.techniques || []).length ? (a.techniques).map((t) => (t ? esc(t) : '<span class="muted">ยังไม่ยืนยัน</span>')).join('<br>') : '<span class="muted">—</span>'}</td>
      <td class="ro-works">${works}</td>
      <td><input type="checkbox" data-f="withdrawn" aria-label="ถอนตัว"${a.withdrawn ? ' checked' : ''}></td>
      <td class="ro-note"><input type="text" maxlength="500" data-f="roster_note" value="${esc(a.roster_note || '')}" aria-label="หมายเหตุ" placeholder="${a.withdrawn ? 'เหตุผลที่ถอนตัว' : ''}"></td>
      <td>${a.works_selection || a.works_exhibit ? '' : '<button class="btn btn-danger btn-sm" type="button" data-del>ลบ</button>'}</td>
    </tr>`;
  }).join('');
}

const render = () => { stats(); stageCard(); rows(); };

async function load() {
  const d = await api(`${M}/roster`);
  S.artists = d.artists;
  S.stages = d.work_stages;
  S.submitStage = d.submit_stage;
  const ids = new Set(S.artists.map((a) => a.id));
  for (const id of [...S.sel]) if (!ids.has(id)) S.sel.delete(id);
  render();
}

async function saveField(a, field, input) {
  let value;
  if (field === 'withdrawn') value = input.checked;
  else if (field === 'channel') value = Number(input.value);
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
    if (field === 'withdrawn' || field === 'roster' || field === 'artist_no') render();
    else stats();
  } catch (err) {
    toast(err.message, 'error');
    await load();
  }
}

function wire() {
  $('f-channel').innerHTML = `<option value="">ทุกช่องทาง</option>${opts(CHANNELS, '')}`;
  $('f-channel').value = '';
  $('f-roster').innerHTML = `<option value="*">ทุกสถานะ</option>${opts(ROSTER, '*')}<option value="withdrawn">ถอนตัว</option>`;
  $('f-roster').value = '*';
  $('b-channel').innerHTML = opts(CHANNELS, '', '— ช่องทาง (ไม่เปลี่ยน) —');
  $('b-roster').innerHTML = `<option value="*">— สถานะ (ไม่เปลี่ยน) —</option>${opts(ROSTER, '*')}`;
  $('a-channel').innerHTML = opts(CHANNELS, 1);
  $('a-roster').innerHTML = opts(ROSTER, 'selected');
  $('a-nat').innerHTML = `<option value="">— ไม่ระบุ —</option>${countryOptions('th', '', esc)}`;
  for (const id of ['f-channel', 'f-roster']) $(id).addEventListener('change', rows);
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
    if (body.channel === undefined && body.roster === undefined) { toast('เลือกช่องทางหรือสถานะที่จะตั้งก่อน', 'error'); return; }
    try {
      const r = await api(`${M}/roster`, { method: 'POST', body });
      toast(`ปรับแล้ว ${r.updated} ท่าน`);
      S.sel.clear();
      await load();
    } catch (err) { toast(err.message, 'error'); }
  });

  $('number').addEventListener('click', async () => {
    const todo = S.artists.filter((a) => a.roster === 'selected' && !a.withdrawn && !a.artist_no).length;
    if (!todo) { toast('ไม่มีศิลปินที่ได้รับคัดเลือกและยังไม่มีเลขที่', 'error'); return; }
    const has = S.artists.some((a) => a.artist_no);
    const msg = has
      ? `มีศิลปินที่มีเลขที่แล้ว เลขใหม่ ${todo} ท่านจะต่อท้ายเลขสุดท้าย (ไม่เรียงปนกับเลขเดิม)\nดำเนินการต่อ?`
      : `ให้เลขที่ 3 หลักกับศิลปินที่ได้รับคัดเลือก ${todo} ท่าน?\nเลขที่ให้แล้วจะไม่เปลี่ยนเอง`;
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
      <td class="small muted">${esc([a.email, a.phone, a.affiliation].filter(Boolean).join(' · ') || '—')}</td>
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
    $('clear-numbers').hidden = S.me.user.role !== 'admin';
    wire();
    wireImport();
    await load();
  } catch (err) {
    if (err.message !== 'redirect') $('ex-sub').textContent = err.message;
  }
})();
