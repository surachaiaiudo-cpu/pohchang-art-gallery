import { api, esc, img, toast, icons, paras, loadFonts } from './core.js';
import { t, pick, pickOther, fmtDate, catLabel, applyStatic, mountSwitcher, localError } from './i18n.js';

applyStatic();
mountSwitcher(document.getElementById('lang'));

loadFonts(['IBM Plex Sans Thai']);
const token = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
const R = `/api/review/${encodeURIComponent(token)}`;
const $ = (id) => document.getElementById(id);
const S = { works: [], votes: {}, i: 0, open: false, ex: null, onlyTodo: false };

const LABEL = { approve: t('approve'), reject: t('reject'), abstain: t('abstain') };

function list() {
  return S.onlyTodo ? S.works.filter((w) => !S.votes[w.id] || S.works[S.i] === w) : S.works;
}

function progress() {
  const done = S.works.filter((w) => S.votes[w.id]).length;
  $('rv-count').textContent = t('reviewedCount', { done, total: S.works.length });
  $('rv-bar').style.width = `${S.works.length ? Math.round((done / S.works.length) * 100) : 0}%`;
}

function renderThumbs() {
  $('rv-thumbs').innerHTML = list().map((w) => {
    const v = S.votes[w.id];
    const idx = S.works.indexOf(w);
    return `<button type="button" data-go="${idx}" aria-current="${idx === S.i}" aria-label="${esc(pick(w, 'title'))}${v ? ` (${LABEL[v.decision]})` : ''}">
      <img src="${esc(img(w.image_url, 200))}" alt="" loading="lazy">
      ${v ? `<span class="mark ${v.decision}">${v.decision === 'approve' ? icons.check : v.decision === 'reject' ? icons.cross : icons.minus}</span>` : ''}</button>`;
  }).join('');
}

function render() {
  progress();
  renderThumbs();
  const w = S.works[S.i];
  if (!w) { $('rv-work').innerHTML = `<p class="muted">${esc(t('noReviewWorks'))}</p>`; return; }
  const v = S.votes[w.id] || {};
  const artist = [w.academic_title_th, pick(w, 'artist_name')].filter(Boolean).join(' ');
  const title = pick(w, 'title'), titleOther = pickOther(w, 'title'), concept = pick(w, 'concept');
  $('rv-work').innerHTML = `
    <div class="rv-img"><img src="${esc(img(w.image_url, 1600))}" alt="${esc(title)}"></div>
    <div>
      <p class="small muted" style="margin:0 0 4px">${esc(t('workOf', { i: S.i + 1, n: S.works.length }))}</p>
      <h1 style="font-size:1.5rem">${esc(title)}</h1>
      ${titleOther ? `<p class="muted" style="margin-top:-6px">${esc(titleOther)}</p>` : ''}
      ${w.category ? `<p class="small" style="margin:0"><span class="tag">${esc(catLabel(S.ex.categories, w))}</span></p>` : ''}
      ${w.video_url ? `<p class="small"><a href="${esc(w.video_url)}" target="_blank" rel="noopener noreferrer">${esc(t('watchVideo'))} ↗</a></p>` : ''}
      <p class="small">${artist ? `${esc(artist)}<br>` : ''}${esc(pick(w, 'technique'))}${w.dimensions ? ` · ${esc(w.dimensions)}` : ''}${w.year_created ? ` · ${esc(w.year_created)}` : ''}</p>
      ${concept ? `<details><summary>${esc(t('conceptOfWork'))}</summary><div class="small">${paras(concept)}</div></details>` : ''}
      <div class="decide" role="group" aria-label="${esc(t('decision'))}">
        <button type="button" data-d="approve" aria-pressed="${v.decision === 'approve'}" ${S.open ? '' : 'disabled'}>${icons.check} ${esc(t('approve'))}</button>
        <button type="button" data-d="reject" aria-pressed="${v.decision === 'reject'}" ${S.open ? '' : 'disabled'}>${icons.cross} ${esc(t('reject'))}</button>
        <button type="button" data-d="abstain" aria-pressed="${v.decision === 'abstain'}" ${S.open ? '' : 'disabled'}>${icons.minus} ${esc(t('abstain'))}</button>
      </div>
      <p class="hint">${esc(t('abstainHint'))}</p>
      <div style="display:grid;gap:4px;margin:12px 0">
        <label for="comment" style="font-weight:600;font-size:.92rem">${esc(t('comment'))}</label>
        <textarea id="comment" maxlength="2000" ${S.open ? '' : 'disabled'}>${esc(v.comment || '')}</textarea>
        ${S.open ? `<div><button class="btn btn-ghost btn-sm" type="button" id="save-comment">${esc(t('saveComment'))}</button></div>` : ''}
      </div>
      <div class="row" style="justify-content:space-between;margin-top:16px">
        <button class="btn btn-ghost" type="button" data-step="-1" ${S.i === 0 ? 'disabled' : ''}>${icons.arrowLeft} ${esc(t('prev'))}</button>
        <button class="btn btn-ghost" type="button" data-step="1" ${S.i >= S.works.length - 1 ? 'disabled' : ''}>${esc(t('next'))} ${icons.arrowRight}</button>
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
    toast(`${LABEL[decision]}: ${pick(w, 'title')}`, 'ok');
    // Move on to the next work that still needs a decision.
    const next = S.works.findIndex((x, i) => i > S.i && !S.votes[x.id]);
    if (next > -1 && !prev) { S.i = next; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  } catch (e) {
    if (prev) S.votes[w.id] = prev; else delete S.votes[w.id];
    render();
    toast(localError(e.message), 'error');
  }
}

async function main() {
  try {
    const d = await api(R);
    S.works = d.works;
    S.votes = d.votes;
    S.open = d.open;
    S.ex = d.exhibition;
    const exTitle = pick(d.exhibition, 'title');
    document.title = `${t('reviewTitle')} — ${exTitle}`;
    $('rv-ex').textContent = exTitle;
    $('rv-who').textContent = t('reviewer', { name: d.reviewer.name });
    const rule = t('rule', { k: d.exhibition.review_threshold, n: d.exhibition.review_panel_size, badge: pick(d.exhibition, 'badge_label') });
    $('rv-notice').innerHTML = `<div class="card small" style="margin:0">${esc(rule)}${d.exhibition.review_deadline ? ` · ${t('editUntil', { d: esc(fmtDate(d.exhibition.review_deadline, true)) })}` : ''}
      ${S.open ? '' : `<br><strong>${esc(t('notOpen'))}</strong>`}</div>`;
    const first = S.works.findIndex((w) => !S.votes[w.id]);
    S.i = first > -1 ? first : 0;
    render();
  } catch (e) {
    $('rv-ex').textContent = t('linkBroken');
    $('rv-work').innerHTML = `<div class="card"><p>${esc(localError(e.message))}</p><p class="muted small">${esc(t('askCurator'))}</p></div>`;
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
    if (!v) { toast(t('pickFirst'), 'error'); return; }
    try {
      await api(`${R}/vote`, { method: 'POST', body: { work_id: w.id, decision: v.decision, comment: $('comment').value } });
      v.comment = $('comment').value;
      toast(t('commentSaved'), 'ok');
    } catch (err) { toast(localError(err.message), 'error'); }
  }
});
$('only-todo').addEventListener('change', (e) => { S.onlyTodo = e.target.checked; renderThumbs(); });
document.addEventListener('keydown', (e) => {
  if (e.target.closest('textarea, input')) return;
  if (e.key === 'ArrowRight' && S.i < S.works.length - 1) { S.i++; render(); }
  if (e.key === 'ArrowLeft' && S.i > 0) { S.i--; render(); }
});
main();
