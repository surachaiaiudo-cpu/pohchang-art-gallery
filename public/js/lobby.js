import { api, esc, img, loadFonts } from './core.js';
import { t, pick, pickOther, fmtDate, applyStatic, mountSwitcher, localError, lang } from './i18n.js';

loadFonts(['IBM Plex Sans Thai']);
applyStatic();
mountSwitcher(document.getElementById('lang'));

function card(e) {
  const live = e.submission && e.submission.open;
  const dates = e.starts_on ? `${fmtDate(e.starts_on)}${e.ends_on ? ` – ${fmtDate(e.ends_on)}` : ''}` : '';
  const other = pickOther(e, 'title');
  return `<a class="ex-card" href="/e/${encodeURIComponent(e.slug)}">
    <div class="cover">${e.cover_url ? `<img src="${esc(img(e.cover_url, 800))}" alt="" loading="lazy">` : ''}</div>
    <h3>${esc(pick(e, 'title'))}</h3>
    ${other ? `<p class="muted" style="margin:0">${esc(other)}</p>` : ''}
    <p class="muted" style="margin:6px 0 0;font-size:.92rem">
      ${live ? `<span class="pill live">${esc(t('openCall'))}</span> ` : ''}${esc(dates)}
      ${e.work_count ? ` · ${esc(t('nWorks', { n: e.work_count }))}` : ''}${e.endorsed_count ? ` · ${esc(t('nEndorsed', { n: e.endorsed_count }))}` : ''}
    </p>
  </a>`;
}

async function main() {
  try {
    const [{ exhibitions }, cfg] = await Promise.all([api('/api/exhibitions'), api('/api/config')]);
    // A custom SITE_NAME is shown as set; the built-in default follows the page language.
    const name = cfg.siteName === 'หอศิลป์ออนไลน์' ? t('siteName') : cfg.siteName;
    document.getElementById('site-name').textContent = name;
    document.title = name;
    const year = new Date().getFullYear() + (lang === 'th' ? 543 : 0);
    document.getElementById('foot').textContent = `© ${year} ${name}`;
    const now = exhibitions.filter((e) => e.status === 'open' || e.status === 'closed');
    const past = exhibitions.filter((e) => e.status === 'archived');
    document.getElementById('now-list').innerHTML = now.length ? now.map(card).join('') : `<p class="muted">${esc(t('noNow'))}</p>`;
    document.getElementById('past-list').innerHTML = past.length ? past.map(card).join('') : `<p class="muted">${esc(t('noPast'))}</p>`;
  } catch (e) {
    document.getElementById('now-list').innerHTML = `<p class="error-text">${esc(localError(e.message))}</p>`;
  }
}
main();
