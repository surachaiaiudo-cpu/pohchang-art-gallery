import { api, esc, img, loadFonts } from './core.js';
import { t, pick, pickOther, fmtDate, fmtTime, applyStatic, mountSwitcher, localError, lang } from './i18n.js';

// The lobby only shows the exhibitions: one wide "room" per exhibition, cover image with its title.
loadFonts(['IBM Plex Sans Thai', 'IBM Plex Mono', 'Anuphan']);
applyStatic();
mountSwitcher(document.getElementById('lang'));
const $ = (id) => document.getElementById(id);

function room(e) {
  const live = e.submission && e.submission.open;
  const cover = e.hero_url || e.cover_url;
  const other = pickOther(e, 'title');
  const dates = e.starts_on ? `${fmtDate(e.starts_on)}${e.ends_on ? ` – ${fmtDate(e.ends_on)}` : ''}` : '';
  const meta = [
    live && e.submission_closes_at ? t('closesOn', { d: `${fmtDate(e.submission_closes_at)} · ${fmtTime(e.submission_closes_at)}` }) : dates,
    e.work_count ? t('nWorks', { n: e.work_count }) : ''
  ].filter(Boolean).join(' · ');
  return `<a class="room${cover ? '' : ' no-cover'}" data-theme="${esc(e.theme_preset)}" href="/e/${encodeURIComponent(e.slug)}">
    ${cover ? `<img src="${esc(img(cover, 2400))}" alt="" loading="lazy">` : ''}
    <span class="room-text wrap">
      ${live ? `<span class="status-pill">${esc(t('openCall'))}</span>` : ''}
      <span class="room-title">${esc(pick(e, 'title'))}</span>
      ${other ? `<span class="room-sub">${esc(other)}</span>` : ''}
      ${meta ? `<span class="room-meta">${esc(meta)}</span>` : ''}
    </span>
  </a>`;
}

async function main() {
  try {
    const [{ exhibitions }, cfg] = await Promise.all([api('/api/exhibitions'), api('/api/config')]);
    // A custom SITE_NAME is shown as set; the built-in default follows the page language.
    const name = cfg.siteName === 'หอศิลป์ออนไลน์' ? t('siteName') : cfg.siteName;
    $('site-name').textContent = name;
    document.title = name;
    $('foot').textContent = `© ${new Date().getFullYear() + (lang === 'th' ? 543 : 0)} ${name}`;
    // Open calls first (closing soonest), then the rest on view; past exhibitions newest first.
    const deadline = (e) => (e.submission && e.submission.open ? Date.parse(e.submission_closes_at || '') || 8.64e15 : 9e15);
    const now = exhibitions.filter((e) => e.status === 'open' || e.status === 'closed').sort((a, b) => deadline(a) - deadline(b));
    const past = exhibitions.filter((e) => e.status === 'archived');
    $('now-list').innerHTML = now.map(room).join('');
    $('past-list').innerHTML = past.map(room).join('');
    $('now').hidden = !now.length;
    $('past').hidden = !past.length;
    $('loading').hidden = true;
    if (!now.length && !past.length) { $('loading').hidden = false; $('loading').textContent = t('noNow'); }
  } catch (e) {
    $('loading').innerHTML = `<span class="error-text">${esc(localError(e.message))}</span>`;
  }
}
main();
