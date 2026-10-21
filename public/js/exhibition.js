import { api, esc, img, srcset, applyTheme, paras, badgeHtml, slugFromPath, icons } from './core.js';
import { t, pick, pickOther, fmtDate, fmtTime, catName, catLabel, techName, techniqueLabel, applyStatic, mountSwitcher, localError, locale } from './i18n.js';
import { countryName, flagImg, flagUrl, flagEmoji, canShowFlagEmoji, isCountryCode } from './countries.js';

applyStatic();
mountSwitcher(document.getElementById('lang'));

const slug = slugFromPath(1);
const $ = (id) => document.getElementById(id);
// Filters live in the address (?cat=&tech=&country=&q=&sort=&show=endorsed) so a filtered view can be shared.
const NO_COUNTRY = '-';
const params = new URLSearchParams(location.search);
const state = {
  ex: null, works: [], filter: params.get('show') === 'endorsed' ? 'endorsed' : 'all', q: params.get('q') || '',
  cat: params.get('cat') || '', tech: params.get('tech') || '', country: params.get('country') || '',
  sort: ['artist', 'title'].includes(params.get('sort')) ? params.get('sort') : 'order'
};
const countryOf = (w) => (isCountryCode(w.nationality) ? w.nationality : NO_COUNTRY);

function syncUrl() {
  const p = new URLSearchParams();
  if (state.filter === 'endorsed') p.set('show', 'endorsed');
  for (const k of ['cat', 'tech', 'country', 'q']) if (state[k].trim()) p.set(k, state[k].trim());
  if (state.sort !== 'order') p.set('sort', state.sort);
  const qs = p.toString();
  history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
}

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
    (!state.tech || w.technique_group === state.tech) && (!state.country || countryOf(w) === state.country) &&
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
    el.innerHTML = state.works.length
      ? `<div class="empty"><p>${esc(t('noMatch'))}</p><button type="button" class="btn btn-ghost" id="clear-filters">${esc(t('clearFilters'))}</button></div>`
      : `<p class="empty">${esc(t('noWorks'))}</p>`;
    return;
  }
  const label = pick(state.ex, 'badge_label');
  const cats = state.ex.categories;
  el.innerHTML = list.map((w, i) => {
    const title = pick(w, 'title'), name = pick(w, 'artist_name');
    const meta = [catLabel(cats, w), techniqueLabel(state.ex.techniques, w), w.dimensions].filter(Boolean).join(' · ');
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

// Technique filter: groups that have works, in the exhibition's order. Works whose technique a
// curator has not confirmed yet only show under "all".
function fillTechniques(ex) {
  const n = (g) => state.works.filter((w) => w.technique_group === g).length;
  const order = (ex.techniques || []).map((x) => x.name);
  const used = [...new Set(state.works.map((w) => w.technique_group).filter(Boolean))]
    .sort((a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999));
  const useful = used.length > 1 || (used.length === 1 && n(used[0]) < state.works.length);
  $('tech').hidden = !useful;
  $('tech').innerHTML = `<option value="">${esc(t('allTechniques'))}</option>${used.map((g) => `<option value="${esc(g)}">${esc(techName(ex.techniques, g))} (${n(g)})</option>`).join('')}`;
  if (!used.includes(state.tech)) state.tech = '';
}

// Country filter: only countries with works, by name in the visitor's language, with a flag
// (inside the list where the system draws flag emoji, otherwise beside it) and a count.
let emojiFlags = false;
function fillCountries() {
  const counts = {};
  for (const w of state.works) counts[countryOf(w)] = (counts[countryOf(w)] || 0) + 1;
  const codes = Object.keys(counts).filter((c) => c !== NO_COUNTRY)
    .sort((a, b) => countryName(a, locale).localeCompare(countryName(b, locale), locale));
  const options = codes.length + (counts[NO_COUNTRY] ? 1 : 0);
  $('country-wrap').hidden = options < 2;
  emojiFlags = canShowFlagEmoji();
  $('country').innerHTML = `<option value="">${esc(t('allCountries'))}</option>${codes.map((c) =>
    `<option value="${c}">${emojiFlags ? `${flagEmoji(c)} ` : ''}${esc(countryName(c, locale))} (${counts[c]})</option>`).join('')}${counts[NO_COUNTRY] ? `<option value="${NO_COUNTRY}">${esc(t('noCountry'))} (${counts[NO_COUNTRY]})</option>` : ''}`;
  if (!(state.country in counts)) state.country = '';
}

function showCountryFlag() {
  const url = emojiFlags ? '' : flagUrl(state.country);
  $('country-flag').hidden = !url;
  $('country-wrap').classList.toggle('has-flag', !!url);
  if (url) $('country-flag').src = url;
}

function restoreControls(usedCats) {
  if (!usedCats.includes(state.cat)) state.cat = '';
  $('cat').value = state.cat;
  $('tech').value = state.tech;
  $('country').value = state.country;
  $('sort').value = state.sort;
  $('q').value = state.q;
  if (state.filter === 'endorsed' && $('f-endorsed').hidden) state.filter = 'all';
  document.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.filter === state.filter)));
  showCountryFlag();
  syncUrl();
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
    fillTechniques(ex);
    fillCountries();
    restoreControls(used);
    renderWorks();
  } catch (e) {
    $('hero').innerHTML = `<div class="hero-main"><h1>${esc(t('notFoundEx'))}</h1><p class="muted">${esc(localError(e.message))}</p><a class="btn btn-ghost" href="/">${esc(t('backGallery'))}</a></div>`;
  }
}

const update = () => { syncUrl(); renderWorks(); };
document.addEventListener('click', (e) => {
  if (e.target.closest('#clear-filters')) {
    Object.assign(state, { filter: 'all', cat: '', tech: '', country: '', q: '' });
    restoreControls([]);
    renderWorks();
    return;
  }
  const b = e.target.closest('[data-filter]');
  if (!b) return;
  state.filter = b.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  update();
});
$('cat').addEventListener('change', (e) => { state.cat = e.target.value; update(); });
$('tech').addEventListener('change', (e) => { state.tech = e.target.value; update(); });
$('country').addEventListener('change', (e) => { state.country = e.target.value; showCountryFlag(); update(); });
$('sort').addEventListener('change', (e) => { state.sort = e.target.value; update(); });
$('q').addEventListener('input', (e) => { state.q = e.target.value; update(); });
main();
