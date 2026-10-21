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
  const seen = new Set();
  const a = list.filter((x) => { const k = x.url || x; if (seen.has(k)) return false; seen.add(k); return true; });
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

// Works are never cropped: each one is shown whole, in front of a dark, blurred copy of itself.
const blurBg = (cls, u) => `<img class="${cls}" src="${esc(img(u, 400))}" alt="" loading="lazy">`;

// The strip shows 3-5 works (by screen width) and moves one tile at a time. The tiles are listed
// twice so it can loop without a jump; the second copy is hidden from screen readers.
function strip(samples) {
  const urls = samples.map((x) => x.url || x);
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
    ${cover ? blurBg('room-bg', cover) : ''}
    <span class="room-inner wrap">
      <span class="room-text">
        ${live ? `<span class="status-pill">${esc(t('openCall'))}</span>` : ''}
        <span class="room-title">${esc(pick(e, 'title'))}</span>
        ${other ? `<span class="room-sub">${esc(other)}</span>` : ''}
        ${meta ? `<span class="room-meta">${esc(meta)}</span>` : ''}
        ${strip(pickRandom(e.samples || [], SAMPLES))}
      </span>
      ${cover ? `<span class="room-art"><img src="${esc(img(cover, 1600))}" alt="" loading="lazy"></span>` : ''}
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
    for (const en of entries) {
      const s = strips.find((x) => x.el === en.target);
      if (!s) continue;
      s.onScreen = en.isIntersecting;
      // A strip that starts below the fold waits out of sight, then its works rise in one after another.
      if (!s.seen) {
        if (en.isIntersecting) { s.seen = true; if (s.el.classList.contains('await')) { s.el.classList.remove('await'); s.el.classList.add('seen'); } }
        else s.el.classList.add('await');
      }
    }
  }) : null;
  for (const s of strips) {
    [...s.track.children].forEach((tile, k) => tile.style.setProperty('--k', k));
    if (io) io.observe(s.el); else s.onScreen = true;
    const r = room(s);
    r.addEventListener('mouseenter', () => { s.held = true; });
    r.addEventListener('mouseleave', () => { s.held = false; });
    r.addEventListener('focusin', () => { s.held = true; });
    r.addEventListener('focusout', () => { s.held = false; });
    s.track.addEventListener('transitionend', (e) => {
      if (e.target !== s.track) return; // a tile's own hover effect, not the strip's move
      const n = Number(s.el.dataset.count);
      if (s.i >= n) { // reached the copy: jump back to the same picture in the first set, unseen
        s.track.style.transition = 'none';
        s.i -= n;
        s.track.querySelector('.arrive')?.classList.remove('arrive');
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
      // The work sliding in at the right edge comes out of a soft blur.
      s.track.querySelector('.arrive')?.classList.remove('arrive');
      s.track.children[s.i + visibleTiles(s.el) - 1]?.classList.add('arrive');
    }
  }, STEP_MS);
}

// Hero: 8 works shared fairly between the exhibitions, one every 4 seconds. Each new work is unveiled with a
// sideways wipe, settles from a slight zoom to its whole size, and its museum label (number, title,
// artist) rises in line by line. The thin bars below fill with time; tapping one, the arrows, a swipe
// or the arrow keys change the work. It pauses while pointed at, focused or in a hidden tab.
const HERO_SLIDES = 8, HERO_MS = 4000;
const pad2 = (n) => String(n).padStart(2, '0');
// Every exhibition with works gets a turn: exhibitions in random order, each with its own
// shuffled works, taken one from each in rotation until the hero is full. Each work keeps the
// title and address of the exhibition it came from, for its label's link.
function fairPick(exhibitions, n) {
  const queues = pickRandom(exhibitions.filter((e) => (e.samples || []).length), exhibitions.length)
    .map((e) => pickRandom(e.samples, e.samples.length).map((w) => ({ ...w, from: pick(e, 'title'), slug: e.slug })));
  const seen = new Set(), out = [];
  while (out.length < n && queues.some((q) => q.length)) {
    for (const q of queues) {
      while (q.length && seen.has(q[0].url)) q.shift();
      const w = q.shift();
      if (!w) continue;
      seen.add(w.url); out.push(w);
      if (out.length >= n) break;
    }
  }
  return out;
}
function hero(site, name, exhibitions) {
  $('hero-title').textContent = pick(site, 'hero_title') || name;
  $('hero-lead').textContent = pick(site, 'hero_lead') || t('lobbyLead');
  const works = fairPick(exhibitions, HERO_SLIDES);
  if (!works.length) return;
  const total = works.length;
  $('hero-slides').innerHTML = works.map((w, i) => {
    const title = pick(w, 'title'), artist = pick(w, 'name');
    const realTitle = title && title !== '-' ? title : '';
    return `<figure class="hero-slide${i ? '' : ' on'}">
      ${blurBg('hs-bg', w.url)}
      <span class="wrap hs-frame"><span class="hs-art"><span class="hs-piece">
        <span class="hs-pic"><img src="${esc(img(w.url, 1600))}" alt=""${i ? ' loading="lazy"' : ''}></span>
        <figcaption class="hs-label">
          <span class="hs-no mono">${pad2(i + 1)} / ${pad2(total)}</span>
          <span class="hs-rule"></span>
          ${realTitle ? `<span class="hs-title">${esc(realTitle)}</span>` : ''}
          ${artist ? `<span class="hs-artist">${esc(artist)}</span>` : ''}
          ${w.from ? `<a class="hs-from" href="/e/${encodeURIComponent(w.slug)}">${esc(t('heroFrom', { name: w.from }))}<span aria-hidden="true"> →</span></a>` : ''}
        </figcaption>
      </span></span></span>
    </figure>`;
  }).join('');
  const band = $('hero');
  band.classList.add('has-slides');
  if (total < 2) return;

  const slides = [...$('hero-slides').children];
  const ui = $('hero-ui');
  $('hero-segs').innerHTML = works.map((_, i) =>
    `<button type="button" class="hs-seg${i ? '' : ' on'}" aria-label="${esc(t('heroGoto', { n: i + 1 }))}"${i ? '' : ' aria-current="true"'}><span></span></button>`).join('');
  const segs = [...$('hero-segs').children];
  ui.hidden = false;
  band.classList.add('has-ui');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) band.classList.add('still');
  let i = 0;

  function go(next, dir) {
    next = (next + total) % total;
    if (next === i) return;
    band.dataset.dir = dir || (next > i ? 'next' : 'prev');
    slides.forEach((el) => el.classList.remove('off'));
    slides[i].classList.remove('on'); slides[i].classList.add('off');
    segs[i].classList.remove('on'); segs[i].removeAttribute('aria-current');
    segs.forEach((el, k) => el.classList.toggle('done', k < next));
    i = next;
    // Re-adding the class restarts the reveal and the bar's timer from zero.
    void slides[i].offsetWidth;
    slides[i].classList.add('on');
    segs[i].classList.add('on'); segs[i].setAttribute('aria-current', 'true');
  }
  // The filling bar is the clock: when its animation ends, the next work comes in.
  segs.forEach((el, k) => {
    el.addEventListener('click', () => go(k));
    el.firstElementChild.addEventListener('animationend', () => { if (k === i && !still) go(i + 1, 'next'); });
  });
  $('hero-prev').addEventListener('click', () => go(i - 1, 'prev'));
  $('hero-next').addEventListener('click', () => go(i + 1, 'next'));
  ui.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1, 'prev'); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1, 'next'); }
  });

  // Pause while the visitor looks closely, uses the controls, or the tab is hidden.
  const held = { hover: false, focus: false, tab: document.hidden };
  const sync = () => band.classList.toggle('paused', held.hover || held.focus || held.tab);
  band.addEventListener('mouseenter', () => { held.hover = true; sync(); });
  band.addEventListener('mouseleave', () => { held.hover = false; sync(); band.style.removeProperty('--px'); band.style.removeProperty('--py'); });
  for (const el of [ui, $('hero-slides')]) {
    el.addEventListener('focusin', () => { held.focus = true; sync(); });
    el.addEventListener('focusout', () => { held.focus = false; sync(); });
  }
  document.addEventListener('visibilitychange', () => { held.tab = document.hidden; sync(); });
  sync();

  // Swipe on touch screens.
  let x0 = null, y0 = 0;
  band.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  band.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? i + 1 : i - 1, dx < 0 ? 'next' : 'prev');
  }, { passive: true });

  // A little depth with a mouse: the work and its blurred backdrop drift apart as the pointer moves.
  if (!still && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let raf = 0;
    band.addEventListener('mousemove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = band.getBoundingClientRect();
        band.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        band.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      });
    });
  }
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
