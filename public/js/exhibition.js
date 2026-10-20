import { api, esc, img, srcset, thDate, applyTheme, paras, badgeHtml, slugFromPath } from './core.js';

const slug = slugFromPath(1);
let state = { ex: null, works: [], filter: 'all', q: '' };

function heroHtml(ex) {
  const sub = ex.submission || {};
  const dates = ex.starts_on ? `${thDate(ex.starts_on)}${ex.ends_on ? ` – ${thDate(ex.ends_on)}` : ''}` : '';
  return `
    <div>
      <p class="eyebrow">${esc(ex.title_en || 'Exhibition')}</p>
      <h1>${esc(ex.title_th)}</h1>
      ${ex.subtitle_th ? `<p class="subtitle">${esc(ex.subtitle_th)}</p>` : ''}
      <div class="hero-meta">
        ${dates ? `<span>${esc(dates)}</span>` : ''}
        ${ex.venue ? `<span>${esc(ex.venue)}</span>` : ''}
        ${sub.open && ex.submission_closes_at ? `<span>รับผลงานถึง ${esc(thDate(ex.submission_closes_at, true))}</span>` : ''}
      </div>
      ${sub.open ? `<a class="btn" href="/e/${encodeURIComponent(ex.slug)}/submit">ส่งผลงานเข้าร่วม</a>` : ''}
    </div>
    ${ex.hero_url ? `<figure class="hero-image" style="margin:0"><img src="${esc(img(ex.hero_url, 1200))}" alt=""></figure>` : ''}`;
}

function cardClass(w, i) {
  if (state.ex.layout !== 'salon' || !w.image_width || !w.image_height) return '';
  const r = w.image_width / w.image_height;
  if (r > 1.45 && i % 3 === 0) return 'wide';
  if (r < 0.75 && i % 2 === 0) return 'tall';
  return '';
}

function renderWorks() {
  const q = state.q.trim().toLowerCase();
  const list = state.works.filter((w) =>
    (state.filter === 'all' || w.endorsed) &&
    (!q || [w.title_th, w.title_en, w.artist_name_th, w.artist_name_en].some((t) => (t || '').toLowerCase().includes(q))));
  const el = document.getElementById('works');
  if (!list.length) {
    el.innerHTML = `<p class="empty">${state.works.length ? 'ไม่พบผลงานตามเงื่อนไข' : 'ยังไม่มีผลงานจัดแสดง'}</p>`;
    return;
  }
  const label = state.ex.badge_label_th;
  el.innerHTML = list.map((w, i) => `
    <a class="work-card ${cardClass(w, i)}" href="/e/${encodeURIComponent(slug)}/work/${w.id}">
      <div class="frame">
        <img src="${esc(img(w.image_url, 600))}" ${srcset(w.image_url) ? `srcset="${esc(srcset(w.image_url))}" sizes="(min-width: 900px) 25vw, 50vw"` : ''}
             alt="${esc(w.title_th)} โดย ${esc(w.artist_name_th)}" loading="lazy"
             ${w.image_width ? `width="${w.image_width}" height="${w.image_height}"` : ''}>
        ${w.endorsed ? badgeHtml(label) : ''}
      </div>
      <div class="cap">
        <p class="title">${esc(w.title_th)}</p>
        <p class="artist">${esc([w.academic_title_th, w.artist_name_th].filter(Boolean).join(' '))}</p>
      </div>
    </a>`).join('');
}

async function main() {
  try {
    const data = await api(`/api/x/${encodeURIComponent(slug)}`);
    if (data.redirectTo) { location.replace(`/e/${encodeURIComponent(data.redirectTo)}`); return; }
    const ex = data.exhibition;
    state.ex = ex;
    state.works = data.works;
    applyTheme(ex);
    document.title = ex.title_th;
    document.getElementById('hero').classList.toggle('has-image', !!ex.hero_url);
    document.getElementById('hero').innerHTML = heroHtml(ex);
    document.getElementById('statement').innerHTML = ex.statement_th ? `<div class="statement">${paras(ex.statement_th)}</div>` : '';
    document.getElementById('ex-nav').innerHTML = `
      <a href="#works">ผลงาน</a>
      ${ex.submission && ex.submission.open ? `<a href="/e/${encodeURIComponent(slug)}/submit">ส่งผลงาน</a>` : ''}`;
    const nEnd = data.works.filter((w) => w.endorsed).length;
    document.getElementById('n-all').textContent = `(${data.works.length})`;
    document.getElementById('n-end').textContent = `(${nEnd})`;
    document.getElementById('f-endorsed').hidden = nEnd === 0;
    renderWorks();
  } catch (e) {
    document.getElementById('hero').innerHTML = `<div><h1>ไม่พบนิทรรศการ</h1><p class="muted">${esc(e.message)}</p><a class="btn btn-ghost" href="/">กลับหอศิลป์</a></div>`;
  }
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-filter]');
  if (!b) return;
  state.filter = b.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  renderWorks();
});
document.getElementById('q').addEventListener('input', (e) => { state.q = e.target.value; renderWorks(); });
main();
