import { api, esc, img, srcset, applyTheme, paras, badgeHtml, slugFromPath, icons } from './core.js';
import { t, pick, pickOther, fmtDate, fmtTime, catName, catLabel, applyStatic, mountSwitcher, localError, locale } from './i18n.js';
import { countryName, flagImg } from './countries.js';

applyStatic();
mountSwitcher(document.getElementById('lang'));

const slug = slugFromPath(1);
const $ = (id) => document.getElementById(id);
const state = { ex: null, works: [], filter: 'all', q: '', cat: '', sort: 'order' };

function heroHtml(ex, works) {
  const sub = ex.submission || {};
  const dates = ex.starts_on ? `${fmtDate(ex.starts_on)}${ex.ends_on ? ` – ${fmtDate(ex.ends_on)}` : ''}` : '';
  const subtitle = pick(ex, 'subtitle');
  const other = pickOther(ex, 'title');
  const artists = new Set(works.map((w) => w.artist_id)).size;
  const section = ex.status === 'archived' ? `<a href="/#past">${esc(t('pastTitle'))}</a>` : `<a href="/#now">${esc(t('navNow'))}</a>`;
  return `
    <div class="hero-main">
      <nav class="crumbs" aria-label="breadcrumb"><a href="/">${esc(t('siteName'))}</a><span aria-hidden="true">/</span>${section}</nav>
      ${other ? `<p class="eyebrow">${esc(other)}</p>` : ''}
      <h1>${esc(pick(ex, 'title'))}</h1>
      ${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ''}
      <div class="hero-meta">
        ${sub.open ? `<span class="status-pill">${esc(t('openCall'))}</span>` : ''}
        ${sub.open && ex.submission_closes_at ? `<span>${esc(t('closesOn', { d: `${fmtDate(ex.submission_closes_at)} · ${fmtTime(ex.submission_closes_at)}` }))}</span>` : ''}
        ${dates ? `<span>${esc(dates)}</span>` : ''}
        ${ex.venue ? `<span>${esc(ex.venue)}</span>` : ''}
      </div>
      ${sub.open ? `<a class="btn btn-lg" href="/e/${encodeURIComponent(ex.slug)}/submit">${esc(t('submitCta'))} ${icons.arrowRight}</a>` : ''}
    </div>
    <div class="hero-side">
      ${ex.hero_url ? `<figure class="hero-image" style="margin:0"><img src="${esc(img(ex.hero_url, 1200))}" alt=""></figure>` : ''}
      <dl class="stats">
        <div><dt>${esc(t('worksLabel'))}</dt><dd>${works.length}</dd></div>
        <div><dt>${esc(t('artist'))}</dt><dd>${artists}</dd></div>
      </dl>
    </div>`;
}

function cardClass(w, i) {
  if (state.ex.layout !== 'salon' || !w.image_width || !w.image_height) return '';
  const r = w.image_width / w.image_height;
  if (r > 1.45 && i % 3 === 0) return 'wide';
  if (r < 0.75 && i % 2 === 0) return 'tall';
  return '';
}

function visible() {
  const q = state.q.trim().toLowerCase();
  const list = state.works.filter((w) =>
    (state.filter === 'all' || w.endorsed) && (!state.cat || w.category === state.cat) &&
    (!q || [w.title_th, w.title_en, w.title_zh, w.artist_name_th, w.artist_name_en, w.artist_name_zh].some((x) => (x || '').toLowerCase().includes(q))));
  const by = (f) => (a, b) => (f(a) || '').localeCompare(f(b) || '', locale);
  if (state.sort === 'artist') list.sort(by((w) => pick(w, 'artist_name')));
  if (state.sort === 'title') list.sort(by((w) => pick(w, 'title')));
  return list;
}

function renderWorks() {
  const list = visible();
  const el = $('works');
  if (!list.length) {
    el.innerHTML = `<p class="empty">${esc(state.works.length ? t('noMatch') : t('noWorks'))}</p>`;
    return;
  }
  const label = pick(state.ex, 'badge_label');
  const cats = state.ex.categories;
  el.innerHTML = list.map((w, i) => {
    const title = pick(w, 'title'), name = pick(w, 'artist_name');
    const meta = [catLabel(cats, w), pick(w, 'technique'), w.dimensions].filter(Boolean).join(' · ');
    return `<a class="work-card ${cardClass(w, i)}" href="/e/${encodeURIComponent(slug)}/work/${w.id}">
      <div class="frame">
        <img src="${esc(img(w.image_url, 600))}" ${srcset(w.image_url) ? `srcset="${esc(srcset(w.image_url))}" sizes="(min-width: 900px) 25vw, 50vw"` : ''}
             alt="${esc(t('by', { title, artist: name }))}" loading="lazy"
             ${w.image_width ? `width="${w.image_width}" height="${w.image_height}"` : ''}>
        ${w.endorsed ? badgeHtml(label) : ''}
      </div>
      <div class="label">
        <span class="no">No. ${w.no}</span>
        <p class="title">${esc(title)}</p>
        <p class="artist">${flagImg(w.nationality, { alt: countryName(w.nationality, locale) }, esc)}${esc([w.academic_title_th, name].filter(Boolean).join(' '))}</p>
        ${meta ? `<p class="meta">${esc(meta)}</p>` : ''}
      </div>
    </a>`;
  }).join('');
}

async function main() {
  try {
    const data = await api(`/api/x/${encodeURIComponent(slug)}`);
    if (data.redirectTo) { location.replace(`/e/${encodeURIComponent(data.redirectTo)}`); return; }
    const ex = data.exhibition;
    state.ex = ex;
    // Catalogue numbers follow the exhibition's own order, whatever the visitor sorts by.
    state.works = data.works.map((w, i) => ({ ...w, no: String(i + 1).padStart(3, '0') }));
    applyTheme(ex);
    document.title = pick(ex, 'title');
    $('hero').innerHTML = heroHtml(ex, state.works);
    const statement = pick(ex, 'statement');
    $('statement').innerHTML = statement ? `<div class="statement">${paras(statement)}</div>` : '';
    $('ex-nav').innerHTML = `
      <a href="#works">${esc(t('works'))}</a>
      ${ex.submission && ex.submission.open ? `<a href="/e/${encodeURIComponent(slug)}/submit">${esc(t('submit'))}</a>` : ''}`;
    const nEnd = state.works.filter((w) => w.endorsed).length;
    $('n-all').textContent = `(${state.works.length})`;
    $('n-end').textContent = `(${nEnd})`;
    $('f-endorsed').hidden = nEnd === 0;
    // Category filter: only categories that have shown works, in the exhibition's order.
    const used = [...new Set(state.works.map((w) => w.category).filter(Boolean))];
    const order = (ex.categories || []).map((c) => c.name);
    used.sort((a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999));
    $('cat').hidden = used.length < 2;
    $('cat').innerHTML = `<option value="">${esc(t('allCategories'))}</option>${used.map((n) => `<option value="${esc(n)}">${esc(catName(ex.categories, n))} (${state.works.filter((w) => w.category === n).length})</option>`).join('')}`;
    renderWorks();
  } catch (e) {
    $('hero').innerHTML = `<div class="hero-main"><h1>${esc(t('notFoundEx'))}</h1><p class="muted">${esc(localError(e.message))}</p><a class="btn btn-ghost" href="/">${esc(t('backGallery'))}</a></div>`;
  }
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-filter]');
  if (!b) return;
  state.filter = b.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  renderWorks();
});
$('cat').addEventListener('change', (e) => { state.cat = e.target.value; renderWorks(); });
$('sort').addEventListener('change', (e) => { state.sort = e.target.value; renderWorks(); });
$('q').addEventListener('input', (e) => { state.q = e.target.value; renderWorks(); });
main();
