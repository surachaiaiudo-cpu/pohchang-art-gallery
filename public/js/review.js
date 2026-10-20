import { api, esc, img, thDate, toast, icons, paras, loadFonts } from './core.js';

loadFonts(['IBM Plex Sans Thai']);
const token = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
const R = `/api/review/${encodeURIComponent(token)}`;
const $ = (id) => document.getElementById(id);
const S = { works: [], votes: {}, i: 0, open: false, ex: null, onlyTodo: false };

const LABEL = { approve: 'อนุมัติ', reject: 'ไม่อนุมัติ', abstain: 'งดพิจารณา' };

function list() {
  return S.onlyTodo ? S.works.filter((w) => !S.votes[w.id] || S.works[S.i] === w) : S.works;
}

function progress() {
  const done = S.works.filter((w) => S.votes[w.id]).length;
  $('rv-count').textContent = `พิจารณาแล้ว ${done} จาก ${S.works.length} ผลงาน`;
  $('rv-bar').style.width = `${S.works.length ? Math.round((done / S.works.length) * 100) : 0}%`;
}

function renderThumbs() {
  $('rv-thumbs').innerHTML = list().map((w) => {
    const v = S.votes[w.id];
    const idx = S.works.indexOf(w);
    return `<button type="button" data-go="${idx}" aria-current="${idx === S.i}" aria-label="${esc(w.title_th)}${v ? ` (${LABEL[v.decision]})` : ''}">
      <img src="${esc(img(w.image_url, 200))}" alt="" loading="lazy">
      ${v ? `<span class="mark ${v.decision}">${v.decision === 'approve' ? icons.check : v.decision === 'reject' ? icons.cross : icons.minus}</span>` : ''}</button>`;
  }).join('');
}

function render() {
  progress();
  renderThumbs();
  const w = S.works[S.i];
  if (!w) { $('rv-work').innerHTML = '<p class="muted">ยังไม่มีผลงานให้พิจารณา</p>'; return; }
  const v = S.votes[w.id] || {};
  const artist = [w.academic_title_th, w.artist_name_th].filter(Boolean).join(' ');
  $('rv-work').innerHTML = `
    <div class="rv-img"><img src="${esc(img(w.image_url, 1600))}" alt="${esc(w.title_th)}"></div>
    <div>
      <p class="small muted" style="margin:0 0 4px">ผลงานที่ ${S.i + 1} / ${S.works.length}</p>
      <h1 style="font-size:1.5rem">${esc(w.title_th)}</h1>
      ${w.title_en ? `<p class="muted" style="margin-top:-6px">${esc(w.title_en)}</p>` : ''}
      <p class="small">${artist ? `${esc(artist)}<br>` : ''}${esc(w.technique_th)}${w.dimensions ? ` · ${esc(w.dimensions)}` : ''}${w.year_created ? ` · ${esc(w.year_created)}` : ''}</p>
      ${w.concept_th ? `<details><summary>แนวคิดของผลงาน</summary><div class="small">${paras(w.concept_th)}</div></details>` : ''}
      <div class="decide" role="group" aria-label="ผลการพิจารณา">
        <button type="button" data-d="approve" aria-pressed="${v.decision === 'approve'}" ${S.open ? '' : 'disabled'}>${icons.check} อนุมัติ</button>
        <button type="button" data-d="reject" aria-pressed="${v.decision === 'reject'}" ${S.open ? '' : 'disabled'}>${icons.cross} ไม่อนุมัติ</button>
        <button type="button" data-d="abstain" aria-pressed="${v.decision === 'abstain'}" ${S.open ? '' : 'disabled'}>${icons.minus} งดพิจารณา</button>
      </div>
      <p class="hint">"งดพิจารณา" ใช้เมื่อมีส่วนได้ส่วนเสีย เช่น เป็นผลงานของลูกศิษย์หรือคนในครอบครัว</p>
      <div style="display:grid;gap:4px;margin:12px 0">
        <label for="comment" style="font-weight:600;font-size:.92rem">ความเห็น (ไม่บังคับ)</label>
        <textarea id="comment" maxlength="2000" ${S.open ? '' : 'disabled'}>${esc(v.comment || '')}</textarea>
        ${S.open ? '<div><button class="btn btn-ghost btn-sm" type="button" id="save-comment">บันทึกความเห็น</button></div>' : ''}
      </div>
      <div class="row" style="justify-content:space-between;margin-top:16px">
        <button class="btn btn-ghost" type="button" data-step="-1" ${S.i === 0 ? 'disabled' : ''}>${icons.arrowLeft} ก่อนหน้า</button>
        <button class="btn btn-ghost" type="button" data-step="1" ${S.i >= S.works.length - 1 ? 'disabled' : ''}>ถัดไป ${icons.arrowRight}</button>
      </div>
    </div>`;
}

async function vote(decision) {
  const w = S.works[S.i];
  const comment = $('comment') ? $('comment').value : '';
  const prev = S.votes[w.id];
  S.votes[w.id] = { decision, comment };
  render();
  try {
    await api(`${R}/vote`, { method: 'POST', body: { work_id: w.id, decision, comment } });
    toast(`${LABEL[decision]}: ${w.title_th}`, 'ok');
    // Move on to the next work that still needs a decision.
    const next = S.works.findIndex((x, i) => i > S.i && !S.votes[x.id]);
    if (next > -1 && !prev) { S.i = next; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  } catch (e) {
    if (prev) S.votes[w.id] = prev; else delete S.votes[w.id];
    render();
    toast(e.message, 'error');
  }
}

async function main() {
  try {
    const d = await api(R);
    S.works = d.works;
    S.votes = d.votes;
    S.open = d.open;
    S.ex = d.exhibition;
    document.title = `พิจารณาผลงาน — ${d.exhibition.title_th}`;
    $('rv-ex').textContent = d.exhibition.title_th;
    $('rv-who').textContent = `ผู้ทรงคุณวุฒิ: ${d.reviewer.name}`;
    const rule = `ผลงานที่ได้รับอนุมัติ ${d.exhibition.review_threshold} ใน ${d.exhibition.review_panel_size} เสียง จะได้ badge "${d.exhibition.badge_label_th}"`;
    $('rv-notice').innerHTML = `<div class="card small" style="margin:0">${esc(rule)}${d.exhibition.review_deadline ? ` · แก้ไขผลได้จนถึง <strong>${esc(thDate(d.exhibition.review_deadline, true))}</strong>` : ''}
      ${S.open ? '' : '<br><strong>ขณะนี้ยังไม่เปิดหรือปิดการพิจารณาแล้ว ดูผลงานได้แต่บันทึกผลไม่ได้</strong>'}</div>`;
    const first = S.works.findIndex((w) => !S.votes[w.id]);
    S.i = first > -1 ? first : 0;
    render();
  } catch (e) {
    $('rv-ex').textContent = 'เปิดลิงก์ไม่ได้';
    $('rv-work').innerHTML = `<div class="card"><p>${esc(e.message)}</p><p class="muted small">กรุณาติดต่อภัณฑารักษ์เพื่อขอลิงก์ใหม่</p></div>`;
  }
}

document.addEventListener('click', async (e) => {
  const d = e.target.closest('[data-d]');
  if (d && !d.disabled) { vote(d.dataset.d); return; }
  const s = e.target.closest('[data-step]');
  if (s && !s.disabled) { S.i = Math.max(0, Math.min(S.works.length - 1, S.i + Number(s.dataset.step))); render(); window.scrollTo({ top: 0 }); return; }
  const g = e.target.closest('[data-go]');
  if (g) { S.i = Number(g.dataset.go); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (e.target.id === 'save-comment') {
    const w = S.works[S.i];
    const v = S.votes[w.id];
    if (!v) { toast('กรุณาเลือกผลการพิจารณาก่อนบันทึกความเห็น', 'error'); return; }
    try {
      await api(`${R}/vote`, { method: 'POST', body: { work_id: w.id, decision: v.decision, comment: $('comment').value } });
      v.comment = $('comment').value;
      toast('บันทึกความเห็นแล้ว', 'ok');
    } catch (err) { toast(err.message, 'error'); }
  }
});
$('only-todo').addEventListener('change', (e) => { S.onlyTodo = e.target.checked; renderThumbs(); });
document.addEventListener('keydown', (e) => {
  if (e.target.closest('textarea, input')) return;
  if (e.key === 'ArrowRight' && S.i < S.works.length - 1) { S.i++; render(); }
  if (e.key === 'ArrowLeft' && S.i > 0) { S.i--; render(); }
});
main();
