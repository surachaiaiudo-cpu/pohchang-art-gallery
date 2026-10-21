import { api, esc, img, loadFonts } from './core.js';
import { t, pick, pickOther, fmtDate, fmtTime, applyStatic, mountSwitcher, localError, lang } from './i18n.js';

// The lobby only shows the exhibitions: one wide "room" per exhibition, cover image with its title.
loadFonts(['IBM Plex Sans Thai', 'IBM Plex Mono', 'Anuphan']);
applyStatic();
mountSwitcher(document.getElementById('lang'));
mountSwitcher(document.getElementById('foot-lang'));
const $ = (id) => document.getElementById(id);
const SAMPLES = 6;          // works per strip, picked at random on every visit
const STEP_MS = 4000;       // one tile further every 4 seconds

function pickRandom(list, n) {
  const a = [...new Set(list)];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

// The strip shows 3-5 works (by screen width) and moves one tile at a time. The tiles are listed
// twice so it can loop without a jump; the second copy is hidden from screen readers.
function strip(urls) {
  if (!urls.length) return '';
  const tile = (u, copy) => `<span class="room-tile"${copy ? ' aria-hidden="true"' : ''}><img src="${esc(img(u, 400))}" alt="" loading="lazy"></span>`;
  return `<span class="room-strip" data-count="${urls.length}"><span class="room-track">
    ${urls.map((u) => tile(u, false)).join('')}${urls.map((u) => tile(u, true)).join('')}
  </span></span>`;
}

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
    ${cover ? `<img class="room-bg" src="${esc(img(cover, 2400))}" alt="" loading="lazy">` : ''}
    <span class="room-text wrap">
      ${live ? `<span class="status-pill">${esc(t('openCall'))}</span>` : ''}
      <span class="room-title">${esc(pick(e, 'title'))}</span>
      ${other ? `<span class="room-sub">${esc(other)}</span>` : ''}
      ${meta ? `<span class="room-meta">${esc(meta)}</span>` : ''}
      ${strip(pickRandom(e.samples || [], SAMPLES))}
    </span>
  </a>`;
}

function visibleTiles(stripEl) {
  const tile = stripEl.querySelector('.room-tile');
  return tile ? Math.round(stripEl.clientWidth / tile.getBoundingClientRect().width) : 0;
}

// A strip whose works all fit on screen stays still and hides the looping copy.
function markStatic() {
  for (const el of document.querySelectorAll('.room-strip')) {
    el.classList.remove('static');
    const still = Number(el.dataset.count) <= visibleTiles(el);
    el.classList.toggle('static', still);
    if (still) { el.firstElementChild.style.transform = ''; }
  }
}

// Auto-advance only while the strip is on screen, the tab is visible, the visitor is not pointing
// at or focused on it, and the system does not ask for reduced motion.
function animateStrips() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const strips = [...document.querySelectorAll('.room-strip')].map((el) => ({ el, track: el.firstElementChild, i: 0, onScreen: false, held: false }));
  const room = (s) => s.el.closest('.room');
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    for (const en of entries) { const s = strips.find((x) => x.el === en.target); if (s) s.onScreen = en.isIntersecting; }
  }) : null;
  for (const s of strips) {
    if (io) io.observe(s.el); else s.onScreen = true;
    const r = room(s);
    r.addEventListener('mouseenter', () => { s.held = true; });
    r.addEventListener('mouseleave', () => { s.held = false; });
    r.addEventListener('focusin', () => { s.held = true; });
    r.addEventListener('focusout', () => { s.held = false; });
    s.track.addEventListener('transitionend', () => {
      const n = Number(s.el.dataset.count);
      if (s.i >= n) { // reached the copy: jump back to the same picture in the first set, unseen
        s.track.style.transition = 'none';
        s.i -= n;
        s.track.style.transform = `translateX(${-s.i * step(s)}px)`;
        void s.track.offsetWidth;
        s.track.style.transition = '';
      }
    });
  }
  const step = (s) => {
    const tiles = s.track.children;
    return tiles.length > 1 ? tiles[1].offsetLeft - tiles[0].offsetLeft : 0;
  };
  setInterval(() => {
    if (document.hidden) return;
    for (const s of strips) {
      if (!s.onScreen || s.held) continue;
      if (s.el.classList.contains('static')) { s.i = 0; continue; } // everything already in view
      s.i += 1;
      s.track.style.transform = `translateX(${-s.i * step(s)}px)`;
    }
  }, STEP_MS);
}

// Hero: works from every exhibition cross-fade behind the gallery's name, one every 6 seconds.
const HERO_SLIDES = 5, HERO_MS = 6000;
function hero(site, name, exhibitions) {
  $('hero-title').textContent = pick(site, 'hero_title') || name;
  $('hero-lead').textContent = pick(site, 'hero_lead') || t('lobbyLead');
  const urls = pickRandom(exhibitions.flatMap((e) => e.samples || []), HERO_SLIDES);
  if (!urls.length) return;
  $('hero-slides').innerHTML = urls.map((u, i) => `<img src="${esc(img(u, 2400))}" alt=""${i ? ' loading="lazy"' : ''} class="${i ? '' : 'on'}">`).join('');
  $('hero').classList.add('has-slides');
  if (urls.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const slides = [...$('hero-slides').children];
  let i = 0;
  setInterval(() => {
    if (document.hidden) return;
    slides[i].classList.remove('on');
    i = (i + 1) % slides.length;
    slides[i].classList.add('on');
  }, HERO_MS);
}

const EXTERNAL = [['website', 'footWebsite'], ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['tiktok', 'TikTok'], ['line', 'LINE']];
function footer(site, name, exhibitions) {
  $('foot-name').textContent = name;
  const org = pick(site, 'org_name'), address = pick(site, 'address');
  $('foot-org').hidden = !org; $('foot-org').textContent = org;
  $('foot-address').hidden = !address; $('foot-address').textContent = address;
  const contact = [
    site.email ? `<li><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>` : '',
    site.phone ? `<li><a href="tel:${esc(site.phone.replace(/[^\d+]/g, ''))}">${esc(site.phone)}</a></li>` : ''
  ].join('');
  $('foot-contact').innerHTML = contact;
  $('foot-contact-col').hidden = !contact;
  const follow = EXTERNAL.filter(([k]) => site[k]).map(([k, label]) =>
    `<li><a href="${esc(site[k])}" target="_blank" rel="noopener noreferrer">${esc(k === 'website' ? t(label) : label)} ↗</a></li>`).join('');
  $('foot-follow').innerHTML = follow;
  $('foot-follow-col').hidden = !follow;
  $('foot-ex').innerHTML = exhibitions.map((e) => `<li><a href="/e/${encodeURIComponent(e.slug)}">${esc(pick(e, 'title'))}</a></li>`).join('');
  $('foot').textContent = `© ${new Date().getFullYear() + (lang === 'th' ? 543 : 0)} ${org || name}`;
}

async function main() {
  try {
    const [{ exhibitions }, cfg, siteRes] = await Promise.all([
      api('/api/exhibitions'), api('/api/config'), api('/api/site').catch(() => ({ site: {} }))
    ]);
    const site = siteRes.site || {};
    // A custom SITE_NAME is shown as set; the built-in default follows the page language.
    const name = cfg.siteName === 'หอศิลป์ออนไลน์' ? t('siteName') : cfg.siteName;
    $('site-name').textContent = name;
    document.title = name;
    hero(site, name, exhibitions);
    footer(site, name, exhibitions);
    // Open calls first (closing soonest), then the rest on view; past exhibitions newest first.
    const deadline = (e) => (e.submission && e.submission.open ? Date.parse(e.submission_closes_at || '') || 8.64e15 : 9e15);
    const now = exhibitions.filter((e) => e.status === 'open' || e.status === 'closed').sort((a, b) => deadline(a) - deadline(b));
    const past = exhibitions.filter((e) => e.status === 'archived');
    $('now-list').innerHTML = now.map(room).join('');
    $('past-list').innerHTML = past.map(room).join('');
    $('now').hidden = !now.length;
    $('past').hidden = !past.length;
    $('loading').hidden = true;
    markStatic();
    window.addEventListener('resize', markStatic);
    animateStrips();
    if (!now.length && !past.length) { $('loading').hidden = false; $('loading').textContent = t('noNow'); }
  } catch (e) {
    $('loading').innerHTML = `<span class="error-text">${esc(localError(e.message))}</span>`;
  }
}
main();
