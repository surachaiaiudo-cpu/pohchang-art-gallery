import { api, esc, img, loadFonts } from './core.js';
import { t, pick, pickOther, fmtDate, fmtTime, applyStatic, mountSwitcher, localError, lang } from './i18n.js';

// Lobby, design B (owner's choice 2026-10-29): one work hangs on the wall with its label, the
// gallery's name runs across the whole width underneath, each exhibition is a stretch of wall,
// open calls sit on one field of the accent colour. Works are always shown whole.
loadFonts(['IBM Plex Sans Thai', 'Anuphan']);
applyStatic();
mountSwitcher(document.getElementById('lang'));
mountSwitcher(document.getElementById('foot-lang'));
const $ = (id) => document.getElementById(id);
const DAY = 86400000;

function shuffle(list) {
  const seen = new Set();
  const a = list.filter((x) => { const k = x.url || x; if (seen.has(k)) return false; seen.add(k); return true; });
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const realTitle = (w) => { const s = pick(w, 'title'); return s && s !== '-' ? s : ''; };

// ---------- The wall ----------
// 8 works shared fairly between the exhibitions (owner's choice 2026-10-21): exhibitions in random
// order, one work from each in turn. One hangs at a time, 4 seconds each; it pauses while pointed
// at, focused or in a hidden tab, and stays still when the system asks for reduced motion.
const HERO_SLIDES = 8, HERO_MS = 4000;
function fairPick(exhibitions, n) {
  const queues = shuffle(exhibitions.filter((e) => (e.samples || []).length))
    .map((e) => shuffle(e.samples).map((w) => ({ ...w, from: pick(e, 'title'), slug: e.slug })));
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
  $('hero-lead').textContent = pick(site, 'hero_lead') || t('lobbyLead');
  const works = fairPick(exhibitions, HERO_SLIDES);
  const art = $('hero-art'), label = $('hero-label');
  if (!works.length) { art.hidden = true; return; }
  const total = works.length;
  let i = 0;

  function show(k, first) {
    const w = works[k];
    const title = realTitle(w), artist = pick(w, 'name');
    const pic = new Image();
    pic.src = img(w.url, 1600);
    pic.alt = title && artist ? t('by', { title, artist }) : (title || artist || '');
    pic.decoding = 'async';
    if (!first) {
      for (const old of art.querySelectorAll('img')) {
        old.classList.remove('arriving'); old.classList.add('leaving');
        old.addEventListener('animationend', () => old.remove(), { once: true });
        setTimeout(() => old.remove(), 600);
      }
      pic.classList.add('arriving');
    }
    art.append(pic);
    label.innerHTML = `
      ${title ? `<span class="wl-title">${esc(title)}</span>` : ''}
      ${artist ? `<span class="wl-artist">${esc(artist)}</span>` : ''}
      <a class="wl-from" href="/e/${encodeURIComponent(w.slug)}">${esc(t('heroFrom', { name: w.from }))} →</a>`;
    $('hero-pos').textContent = t('heroPos', { n: k + 1, total });
    // Fetch the next work early so it arrives without a gap.
    const next = works[(k + 1) % total];
    if (next) { const pre = new Image(); pre.src = img(next.url, 1600); }
  }
  show(0, true);
  if (total < 2) return;

  $('hero-ctrl').hidden = false;
  const go = (k) => { i = (k + total) % total; show(i); restart(); };
  $('hero-prev').addEventListener('click', () => go(i - 1));
  $('hero-next').addEventListener('click', () => go(i + 1));
  $('hero-ctrl').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
  });
  let x0 = null, y0 = 0;
  art.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  art.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? i + 1 : i - 1);
  }, { passive: true });

  // Reduced motion: the work changes only when the visitor asks.
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const held = { hover: false, focus: false };
  const band = $('hero');
  band.addEventListener('mouseenter', () => { held.hover = true; });
  band.addEventListener('mouseleave', () => { held.hover = false; });
  band.addEventListener('focusin', () => { held.focus = true; });
  band.addEventListener('focusout', () => { held.focus = false; });
  let timer = 0;
  function restart() {
    clearInterval(timer);
    if (still) return;
    timer = setInterval(() => {
      if (document.hidden || held.hover || held.focus) return;
      i = (i + 1) % total; show(i);
    }, HERO_MS);
  }
  restart();
}

// The name runs edge to edge: measure it once at a known size, then scale to the column.
function fitName() {
  const h = $('site-name');
  const cs = getComputedStyle(h);
  const room = h.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const probe = document.createElement('span');
  probe.textContent = h.textContent;
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${cs.fontWeight} 100px ${cs.fontFamily};letter-spacing:-0.02em`;
  document.body.append(probe);
  const w = probe.getBoundingClientRect().width;
  probe.remove();
  if (w > 0 && room > 0) h.style.fontSize = `${Math.min(220, Math.floor((room / w) * 100 * 0.99))}px`;
}

// ---------- Rooms ----------
function roomMeta(e) {
  const dates = e.starts_on ? `${fmtDate(e.starts_on)}${e.ends_on ? ` – ${fmtDate(e.ends_on)}` : ''}` : '';
  return [e.venue, dates, e.work_count ? t('nWorks', { n: e.work_count }) : ''].filter(Boolean).join(' · ');
}
function room(e) {
  const picks = shuffle(e.samples || []).slice(0, 4).map((w) => w.url);
  const cover = e.hero_url || e.cover_url;
  const pics = picks.length ? picks : (cover ? [cover] : []);
  const other = pickOther(e, 'title');
  const wall = pics.length
    ? pics.map((u, k) => `<img${k ? '' : ' class="lead"'} src="${esc(img(u, k ? 500 : 900))}" alt="" loading="lazy">`).join('')
    : `<p class="empty-wall">${esc(t('wallEmpty'))}</p>`;
  return `<a class="room-b" href="/e/${encodeURIComponent(e.slug)}">
    <span class="room-b-wall">${wall}</span>
    <span class="room-b-text">
      <span class="room-b-name">${esc(pick(e, 'title'))}</span>
      ${other ? `<span class="room-b-other">${esc(other)}</span>` : ''}
      <span class="room-b-meta">${esc(roomMeta(e))}</span>
      <span class="room-b-go">${esc(t('enterRoom'))} →</span>
    </span>
  </a>`;
}

// ---------- Open calls ----------
function callCard(e) {
  const cover = e.hero_url || e.cover_url;
  const close = Date.parse(e.submission_closes_at || '');
  let left = '';
  if (close) {
    // Whole days left (2 days 11 hours shows as 2); under a day reads "closes today".
    const days = Math.floor((close - Date.now()) / DAY);
    left = days < 1 ? t('closesToday') : t('daysLeft', { n: days });
  }
  const when = close ? t('closesOn', { d: `${fmtDate(e.submission_closes_at)} · ${fmtTime(e.submission_closes_at)}` }) : '';
  const base = `/e/${encodeURIComponent(e.slug)}`;
  return `<div class="call-b">
    ${cover ? `<a href="${base}" tabindex="-1" aria-hidden="true"><img src="${esc(img(cover, 700))}" alt="" loading="lazy"></a>` : ''}
    <div class="call-b-text">
      <a class="call-b-name" href="${base}">${esc(pick(e, 'title'))}</a>
      ${left ? `<span class="call-b-left">${esc(left)}</span>` : ''}
      <span>${esc([when, e.venue, e.work_count ? t('sentSoFar', { n: e.work_count }) : ''].filter(Boolean).join(' · '))}</span>
      <a class="btn btn-lg" href="${base}/submit">${esc(t('callSubmit'))}</a>
    </div>
  </div>`;
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
    $('site-name').textContent = pick(site, 'hero_title') || name;
    document.title = name;
    fitName();
    document.fonts && document.fonts.ready.then(fitName);
    window.addEventListener('resize', fitName);
    hero(site, name, exhibitions);
    footer(site, name, exhibitions);
    // Owner's order (2026-10-25): on view → open call → past. An exhibition may be in both of the
    // first two. A call that has not opened yet or has ended is not listed under "open call".
    const deadline = (e) => Date.parse(e.submission_closes_at || '') || 8.64e15;
    const now = exhibitions.filter((e) => e.status === 'open' && e.on_view);
    const calls = exhibitions.filter((e) => e.status === 'open' && e.submission && e.submission.open).sort((a, b) => deadline(a) - deadline(b));
    const past = exhibitions.filter((e) => e.status === 'archived');
    $('now-list').innerHTML = now.map(room).join('');
    $('call-list').innerHTML = calls.map(callCard).join('');
    $('past-list').innerHTML = past.map(room).join('');
    $('call-title').textContent = calls.length > 1 ? t('callsTitle', { n: calls.length }) : t('navCall');
    $('now').hidden = !now.length;
    $('call').hidden = !calls.length;
    $('past').hidden = !past.length;
    $('nav-now').hidden = !now.length;
    $('nav-call').hidden = !calls.length;
    $('nav-past').hidden = !past.length;
    $('hero-submit').hidden = !calls.length;
    $('loading').hidden = true;
    if (!now.length && !calls.length && !past.length) { $('loading').hidden = false; $('loading').textContent = t('noNow'); }
  } catch (e) {
    $('loading').innerHTML = `<span class="error-text">${esc(localError(e.message))}</span>`;
  }
}
main();
