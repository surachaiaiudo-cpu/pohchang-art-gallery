import { api, esc, img, srcset, applyTheme, paras, badgeHtml, slugFromPath } from './core.js';
import { t, pick, pickOther, fmtDate, catName, catLabel, applyStatic, mountSwitcher, localError } from './i18n.js';

applyStatic();
mountSwitcher(document.getElementById('lang'));

const slug = slugFromPath(1);
let state = { ex: null, works: [], filter: 'all', q: '', cat: '' };

function heroHtml(ex) {
  const sub = ex.submission || {};
  const dates = ex.starts_on ? `${fmtDate(ex.starts_on)}${ex.ends_on ? ` – ${fmtDate(ex.ends_on)}` : ''}` : '';
  const subtitle = pick(ex, 'subtitle');
  return `
    <div>
      <p class="eyebrow">${esc(pickOther(ex, 'title') || 'Exhibition')}</p>
      <h1>${esc(pick(ex, 'title'))}</h1>
      ${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ''}
      <div class="hero-meta">
        ${dates ? `<span>${esc(dates)}</span>` : ''}
        ${ex.venue ? `<span>${esc(ex.venue)}</span>` : ''}
        ${sub.open && ex.submission_closes_at ? `<span>${esc(t('untilDate', { d: fmtDate(ex.submission_closes_at, true) }))}</span>` : ''}
      </div>
      ${sub.open ? `<a class="btn" href="/e/${encodeURIComponent(ex.slug)}/submit">${esc(t('submitCta'))}</a>` : ''}
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
    (state.filter === 'all' || w.endorsed) && (!state.cat || w.category === state.cat) &&
    (!q || [w.title_th, w.title_en, w.title_zh, w.artist_name_th, w.artist_name_en, w.artist_name_zh].some((t) => (t || '').toLowerCase().includes(q))));
  const el = document.getElementById('works');
  if (!list.length) {
    el.innerHTML = `<p class="empty">${esc(state.works.length ? t('noMatch') : t('noWorks'))}</p>`;
    return;
  }
  const label = pick(state.ex, 'badge_label');
  const cats = state.ex.categories;
  el.innerHTML = list.map((w, i) => `
    <a class="work-card ${cardClass(w, i)}" href="/e/${encodeURIComponent(slug)}/work/${w.id}">
      <div class="frame">
        <img src="${esc(img(w.image_url, 600))}" ${srcset(w.image_url) ? `srcset="${esc(srcset(w.image_url))}" sizes="(min-width: 900px) 25vw, 50vw"` : ''}
             alt="${esc(t('by', { title: pick(w, 'title'), artist: pick(w, 'artist_name') }))}" loading="lazy"
             ${w.image_width ? `width="${w.image_width}" height="${w.image_height}"` : ''}>
        ${w.endorsed ? badgeHtml(label) : ''}
      </div>
      <div class="cap">
        <p class="title">${esc(pick(w, 'title'))}</p>
        <p class="artist">${esc([w.academic_title_th, pick(w, 'artist_name')].filter(Boolean).join(' '))}</p>
        ${w.category ? `<p class="artist" style="opacity:.75">${esc(catLabel(cats, w))}</p>` : ''}
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
    document.title = pick(ex, 'title');
    document.getElementById('hero').classList.toggle('has-image', !!ex.hero_url);
    document.getElementById('hero').innerHTML = heroHtml(ex);
    const statement = pick(ex, 'statement');
    document.getElementById('statement').innerHTML = statement ? `<div class="statement">${paras(statement)}</div>` : '';
    document.getElementById('ex-nav').innerHTML = `
      <a href="#works">${esc(t('works'))}</a>
      ${ex.submission && ex.submission.open ? `<a href="/e/${encodeURIComponent(slug)}/submit">${esc(t('submit'))}</a>` : ''}`;
    const nEnd = data.works.filter((w) => w.endorsed).length;
    document.getElementById('n-all').textContent = `(${data.works.length})`;
    document.getElementById('n-end').textContent = `(${nEnd})`;
    document.getElementById('f-endorsed').hidden = nEnd === 0;
    // Category filter: only categories that have shown works.
    const used = [...new Set(data.works.map((w) => w.category).filter(Boolean))];
    const order = (ex.categories || []).map((c) => c.name);
    used.sort((a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999));
    const sel = document.getElementById('cat');
    sel.hidden = used.length < 2;
    sel.innerHTML = `<option value="">${esc(t('allCategories'))}</option>${used.map((n) => `<option value="${esc(n)}">${esc(catName(ex.categories, n))} (${data.works.filter((w) => w.category === n).length})</option>`).join('')}`;
    renderWorks();
  } catch (e) {
    document.getElementById('hero').innerHTML = `<div><h1>${esc(t('notFoundEx'))}</h1><p class="muted">${esc(localError(e.message))}</p><a class="btn btn-ghost" href="/">${esc(t('backGallery'))}</a></div>`;
  }
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-filter]');
  if (!b) return;
  state.filter = b.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  renderWorks();
});
document.getElementById('cat').addEventListener('change', (e) => { state.cat = e.target.value; renderWorks(); });
document.getElementById('q').addEventListener('input', (e) => { state.q = e.target.value; renderWorks(); });
main();
