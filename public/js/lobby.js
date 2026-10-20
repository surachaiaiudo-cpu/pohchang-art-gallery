import { api, esc, img, loadFonts, icons } from './core.js';
import { t, pick, fmtDate, fmtTime, applyStatic, mountSwitcher, localError, lang } from './i18n.js';

loadFonts(['IBM Plex Sans Thai', 'IBM Plex Mono', 'Anuphan']);
applyStatic();
mountSwitcher(document.getElementById('lang'));
const $ = (id) => document.getElementById(id);

function dates(e) {
  return e.starts_on ? `${fmtDate(e.starts_on)}${e.ends_on ? ` – ${fmtDate(e.ends_on)}` : ''}` : '';
}

// Exhibition card: the lobby's ground, the exhibition's own accent on the cover edge.
function card(e) {
  const live = e.submission && e.submission.open;
  const sub = [live ? '' : dates(e), e.endorsed_count ? t('nEndorsed', { n: e.endorsed_count }) : ''].filter(Boolean).join(' · ');
  return `<a class="ex-card" data-theme="${esc(e.theme_preset)}" href="/e/${encodeURIComponent(e.slug)}">
    <div class="cover">${e.cover_url ? `<img src="${esc(img(e.cover_url, 800))}" alt="" loading="lazy">` : ''}</div>
    ${live ? `<span><span class="pill live">${esc(t('openCall'))}</span>${e.submission_closes_at ? ` <span class="muted">${esc(t('closesOn', { d: fmtDate(e.submission_closes_at) }))}</span>` : ''}</span>` : ''}
    <div class="row1"><h3>${esc(pick(e, 'title'))}</h3>${e.work_count ? `<span class="count">${esc(t('nWorks', { n: e.work_count }))}</span>` : ''}</div>
    ${pick(e, 'subtitle') ? `<span class="sub">${esc(pick(e, 'subtitle'))}</span>` : ''}
    ${sub ? `<span class="sub">${esc(sub)}</span>` : ''}
  </a>`;
}

// The exhibition the lobby leads with: an open call closing soonest, else the newest one on view.
function pickFeatured(list) {
  const calls = list.filter((e) => e.submission && e.submission.open)
    .sort((a, b) => (Date.parse(a.submission_closes_at || '') || Infinity) - (Date.parse(b.submission_closes_at || '') || Infinity));
  return calls[0] || list.find((e) => e.status === 'open' || e.status === 'closed') || null;
}

function heroHtml(f, tiles) {
  if (!f) {
    return `<div class="hero-main"><p class="eyebrow">Online Art Gallery</p>
      <h1>${esc(t('lobbyHeadline'))}</h1><p class="lead">${esc(t('lobbyLead'))}</p></div>`;
  }
  const live = f.submission && f.submission.open;
  const nCats = (f.categories || []).length;
  return `<div class="hero-main">
      <div class="hero-meta" style="margin:0">
        ${live ? `<span class="status-pill">${esc(t('openCall'))}</span>` : `<span class="status-pill quiet">${esc(t('onView'))}</span>`}
        ${live && f.submission_closes_at ? `<span>${esc(t('closesOn', { d: `${fmtDate(f.submission_closes_at)} · ${fmtTime(f.submission_closes_at)}` }))}</span>` : esc(dates(f))}
      </div>
      <h1>${esc(pick(f, 'title'))}</h1>
      <p class="lead">${esc(pick(f, 'subtitle') || t('lobbyLead'))}</p>
      ${live ? `<dl class="facts-row">
        <div><dt>${esc(t('maxPer'))}</dt><dd>${esc(t('nWorks', { n: f.max_works_per_artist }))}</dd></div>
        <div><dt>${esc(t('category'))}</dt><dd>${nCats ? esc(t('nCats', { n: nCats })) : '—'}</dd></div>
        <div><dt>${esc(t('language'))}</dt><dd lang="mul">ไทย · EN · 中文</dd></div>
      </dl>` : ''}
      <div class="cta-row">
        ${live ? `<a class="btn btn-lg" href="/e/${encodeURIComponent(f.slug)}/submit">${esc(t('submitCta'))} ${icons.arrowRight}</a>` : ''}
        <a class="btn btn-ghost btn-lg" href="/e/${encodeURIComponent(f.slug)}">${esc(t('viewExhibition'))}</a>
      </div>
    </div>
    ${tiles.length ? `<div class="lobby-collage" aria-hidden="true">
      ${tiles.slice(0, 4).map((u, i) => `<div class="tile t${i + 1}"><img src="${esc(img(u, 800))}" alt="" loading="lazy"></div>`).join('')}
    </div>` : ''}`;
}

async function main() {
  try {
    const [{ exhibitions }, cfg] = await Promise.all([api('/api/exhibitions'), api('/api/config')]);
    // A custom SITE_NAME is shown as set; the built-in default follows the page language.
    const name = cfg.siteName === 'หอศิลป์ออนไลน์' ? t('siteName') : cfg.siteName;
    $('site-name').textContent = name;
    $('foot-name').textContent = name;
    document.title = name;
    const year = new Date().getFullYear() + (lang === 'th' ? 543 : 0);
    $('foot').textContent = `© ${year} · ไทย / English / 中文`;

    const featured = pickFeatured(exhibitions);
    // Collage: the featured exhibition's works, topped up with other exhibitions' covers.
    let tiles = [];
    if (featured) {
      try {
        const d = await api(`/api/x/${encodeURIComponent(featured.slug)}`);
        tiles = d.works.map((w) => w.image_url);
      } catch { tiles = []; }
    }
    for (const e of exhibitions) if (e !== featured && e.cover_url) tiles.push(e.cover_url);
    $('hero').innerHTML = heroHtml(featured, [...new Set(tiles)]);

    const now = exhibitions.filter((e) => e !== featured && (e.status === 'open' || e.status === 'closed'));
    const past = exhibitions.filter((e) => e.status === 'archived');
    $('now-wrap').hidden = !now.length;
    $('now-list').innerHTML = now.map(card).join('');
    $('past-list').innerHTML = past.length ? past.map(card).join('') : `<p class="muted">${esc(t('noPast'))}</p>`;
  } catch (e) {
    $('hero').innerHTML = `<p class="error-text">${esc(localError(e.message))}</p>`;
  }
}
main();
