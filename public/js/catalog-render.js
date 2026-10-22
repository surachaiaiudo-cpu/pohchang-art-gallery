// Draws an exhibition catalogue into real A4 pages (210 × 297 mm) in the browser. The same pages are
// shown on screen (scaled by the page script) and printed / saved as PDF by the browser.
// Long text (statement, expert panel, list of works) flows onto as many pages as it needs, so the
// pages are measured in the DOM: the container must be in the document and laid out (not display:none).
import { esc, img, icons, loadFonts } from './core.js';
import { flagUrl, countryName, isCountryCode } from './countries.js';
import qrcode from './qrcode.mjs';
import {
  PAGE, values, techniqueValues, listLabel, orderWorks, words, isImageField, BOOK_WORDS, NAMED_COLORS, cmykToHex
} from './catalog-core.js';

const LOCALES = { th: 'th-TH', en: 'en-GB', zh: 'zh-CN' };
const collator = (l) => new Intl.Collator(LOCALES[l] || 'th-TH', { sensitivity: 'base', numeric: true }).compare;

function dateIn(value, l) {
  if (!value) return '';
  const d = new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(LOCALES[l], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(d);
}
const dateRange = (ex, l) => {
  const a = dateIn(ex.starts_on, l);
  const b = dateIn(ex.ends_on, l);
  return a && b ? `${a} – ${b}` : a || b;
};

const colorOf = (c) => (NAMED_COLORS.includes(c) ? `var(--c-${c})` : cmykToHex(c));
const pad = (n) => String(n).padStart(3, '0');

// Several language versions of one text: the first is the main line, the others follow smaller.
function multi(list, { join = false } = {}) {
  if (!list.length) return '';
  if (join) return `<span class="v">${esc(list.join(' / '))}</span>`;
  return list.map((v, i) => `<span class="v${i ? ' alt' : ''}">${esc(v)}</span>`).join('');
}
// { th, en, zh } -> the texts in the book languages (same fallback as values()).
const byLang = (obj, langs) => values(Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [`x_${k}`, v])), 'x', langs);
const paragraphs = (text) => String(text).split(/\n{2,}/).map((p) => esc(p.trim()).replace(/\n/g, '<br>')).filter(Boolean);

function qrSvg(text) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="-1 -1 ${n + 2} ${n + 2}" width="100%" height="100%" aria-hidden="true" shape-rendering="crispEdges"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="#fff"/><path d="${d}" fill="currentColor"/></svg>`;
}

// ------------------------------------------------------------------ one artwork page
function artistValues(w, langs) {
  const out = [];
  for (const l of langs) {
    const name = w[`artist_name_${l}`];
    if (!name) continue;
    const t = l === 'th' ? w.academic_title_th : l === 'en' ? w.academic_title_en : '';
    const v = `${t ? `${t} ` : ''}${name}`.trim();
    if (!out.includes(v)) out.push(v);
  }
  if (!out.length && (w.artist_name_th || w.artist_name_en)) out.push(`${w.academic_title_th ? `${w.academic_title_th} ` : ''}${w.artist_name_th || w.artist_name_en}`);
  return out;
}

function categoryValues(ex, w, langs) {
  if (!w.category) return [];
  const item = (ex.categories || []).find((c) => c.name === w.category) || { subLabels: {} };
  const out = [];
  for (const l of langs) {
    const cat = listLabel(ex.categories, w.category, l);
    let sub = '';
    if (w.subcategory) sub = l === 'th' ? w.subcategory : (((item.subLabels || {})[w.subcategory] || {})[l] || ((item.subLabels || {})[w.subcategory] || {}).en || w.subcategory);
    const v = [cat, sub].filter(Boolean).join(' · ');
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

function blockContent(b, w, ctx) {
  const { ex, settings, langs } = ctx;
  const f = settings.fields;
  if (Object.prototype.hasOwnProperty.call(f, b.field) && !f[b.field]) return null;
  const label = (key) => (b.label ? `<span class="lab">${esc(words(key, langs).join(' / '))}</span> ` : '');
  const text = (list, key, opts) => (list.length ? `${key ? label(key) : ''}${multi(list, opts)}` : null);
  switch (b.field) {
    case 'image': {
      if (!w.image_url) return null;
      const pos = { left: 'left center', center: 'center', right: 'right center' }[b.align] || 'center';
      return `<img src="${esc(img(w.image_url, 1600))}" alt="${esc(values(w, 'title', langs)[0] || '')}" loading="lazy" decoding="async" style="object-fit:${b.fit};object-position:${pos}">`;
    }
    case 'avatar':
      if (!w.avatar_url) return null;
      return `<img src="${esc(img(w.avatar_url, 400))}" alt="" loading="lazy" decoding="async" style="object-fit:${b.fit};border-radius:${b.radius}mm">`;
    case 'qr':
      return `<div class="qr">${qrSvg(`${ctx.origin}/e/${encodeURIComponent(ex.slug)}/work/${w.id}`)}</div>`;
    case 'number': return `<span class="v">No. ${pad(ctx.no)}</span>`;
    case 'title': return text(values(w, 'title', langs));
    case 'artist': return text(artistValues(w, langs));
    case 'country': {
      if (!w.nationality) return null;
      if (!isCountryCode(w.nationality)) return `<span class="v">${esc(w.nationality)}</span>`;
      const names = [...new Set(langs.map((l) => countryName(w.nationality, l)))];
      return `${label('country')}<span class="v"><img class="flag" src="${esc(flagUrl(w.nationality))}" alt=""> ${esc(names.join(' / '))}</span>`;
    }
    case 'affiliation': return w.affiliation ? `${label('affiliation')}<span class="v">${esc(w.affiliation)}</span>` : null;
    case 'category': return text(categoryValues(ex, w, langs), 'category');
    case 'technique': return text(techniqueValues(ex.techniques, w, langs), 'technique');
    case 'dimensions': return w.dimensions ? `${label('dimensions')}<span class="v">${esc(w.dimensions)}</span>` : null;
    case 'year': return w.year_created ? `${label('year')}<span class="v">${esc(w.year_created)}</span>` : null;
    case 'price': return w.price ? `${label('price')}<span class="v">${esc(w.price)}</span>` : null;
    case 'concept':
    case 'bio': {
      const list = values(w, b.field, langs);
      if (!list.length) return null;
      return `${b.label ? `<span class="lab block">${esc(words(b.field, langs).join(' / '))}</span>` : ''}${list.map((v, i) => `<span class="v para${i ? ' alt' : ''}">${paragraphs(v).join('<br>')}</span>`).join('')}`;
    }
    case 'badge':
      if (!w.endorsed) return null;
      return `<span class="v badge">${icons.badge} ${esc(values(ex, 'badge_label', langs).join(' · '))}</span>`;
    default: return layoutContent(b, ctx);
  }
}

// Pieces that do not depend on an artwork (also used on the cover-less pages).
function layoutContent(b, ctx) {
  const { ex, settings, langs } = ctx;
  switch (b.field) {
    case 'page': return '<span class="v pno"></span>';
    case 'footer': { const list = byLang(settings.footer, langs); return list.length ? `<span class="v">${esc(list.join(' · '))}</span>` : null; }
    case 'exhibition': return `<span class="v">${esc(values(ex, 'title', langs).join(' · '))}</span>`;
    case 'text': {
      const list = byLang(b.text, langs);
      return list.length ? list.map((v, i) => `<span class="v para${i ? ' alt' : ''}">${paragraphs(v).join('<br>')}</span>`).join('') : null;
    }
    case 'line': case 'box': return '';
    default: return null;
  }
}

function blockStyle(b) {
  const s = [`left:${b.x}mm`, `top:${b.y}mm`, `width:${b.w}mm`, `height:${b.h}mm`];
  if (b.field === 'line') s.push(`background:${colorOf(b.color)}`);
  else if (b.field === 'box') s.push(`background:${colorOf(b.bg)}`, `border-radius:${b.radius || 0}mm`);
  else if (isImageField(b.field)) { if (b.field === 'qr') s.push('color:var(--c-ink)'); }
  else {
    s.push(`font-size:${b.size}pt`, `font-weight:${b.weight}`, `text-align:${b.align}`, `color:${colorOf(b.color)}`,
      `line-height:${b.lineHeight}`, `font-family:var(--f-${b.font})`);
    if (b.italic) s.push('font-style:italic');
    if (b.upper) s.push('text-transform:uppercase;letter-spacing:.06em');
    s.push(`justify-content:${{ top: 'flex-start', middle: 'center', bottom: 'flex-end' }[b.vertical] || 'flex-start'}`);
  }
  return s.join(';');
}

export function blocksHtml(blocks, w, ctx, { designer = false } = {}) {
  return blocks.map((b) => {
    const content = w ? blockContent(b, w, ctx) : layoutContent(b, ctx);
    if (content === null && !designer) return '';
    const kind = isImageField(b.field) ? 'img' : ['line', 'box'].includes(b.field) ? 'shape' : 'text';
    const inner = kind === 'text' && content ? `<div class="in">${content}</div>` : (content || '');
    return `<div class="blk blk-${kind} f-${b.field}" data-id="${esc(b.id)}" style="${blockStyle(b)}">${inner}</div>`;
  }).join('');
}

// Shrinks text that does not fit its box (long Thai titles), down to 55 % of the set size.
export function fitText(root) {
  root.querySelectorAll('.blk-text').forEach((el) => {
    const base = parseFloat(el.style.fontSize);
    if (!base) return;
    let scale = 1;
    while (el.scrollHeight > el.clientHeight + 1 && scale > 0.56) {
      scale -= 0.05;
      el.style.fontSize = `${(base * scale).toFixed(2)}pt`;
    }
    el.classList.toggle('overflow', el.scrollHeight > el.clientHeight + 1);
  });
}

// ------------------------------------------------------------------ pages
export function themeVars(layout) {
  const c = layout.colors;
  return `--c-paper:${cmykToHex(c.paper)};--c-ink:${cmykToHex(c.ink)};--c-muted:${cmykToHex(c.muted)};--c-accent:${cmykToHex(c.accent)};` +
    `--f-head:'${layout.fonts.head}','IBM Plex Sans Thai',sans-serif;--f-body:'${layout.fonts.body}','IBM Plex Sans Thai',sans-serif;`;
}

export async function loadBookFonts(layout) {
  const fams = [...new Set([layout.fonts.head, layout.fonts.body, 'IBM Plex Sans Thai'])];
  loadFonts(fams);
  if (!document.fonts || !document.fonts.load) return;
  const wait = Promise.all(fams.flatMap((f) => [400, 600].map((wt) => document.fonts.load(`${wt} 16px "${f}"`, 'กขคABC').catch(() => null))));
  await Promise.race([wait, new Promise((r) => setTimeout(r, 4000))]);
}

function newPage(book, kind, label) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<section class="sheet sheet-${kind}" aria-label="${esc(label)}"></section>`;
  wrap.dataset.kind = kind;
  wrap.dataset.label = label;
  book.appendChild(wrap);
  return wrap.firstElementChild;
}

function coverHtml(ctx, works) {
  const { ex, settings, langs, layout } = ctx;
  const titles = values(ex, 'title', langs);
  const subs = values(ex, 'subtitle', langs);
  const dates = [...new Set(langs.map((l) => dateRange(ex, l)).filter(Boolean))];
  const note = byLang(settings.coverNote, langs);
  const foot = byLang(settings.footer, langs);
  const pic = ex.hero_url || (works[0] && works[0].image_url) || '';
  const artists = new Set(works.map((w) => w.artist_id)).size;
  const count = langs.map((l) => (l === 'th' ? `ผลงาน ${works.length} ชิ้น · ศิลปิน ${artists} คน`
    : l === 'zh' ? `${works.length} ${BOOK_WORDS.zh.works} · ${artists} ${BOOK_WORDS.zh.artists}` : `${works.length} ${BOOK_WORDS.en.works} · ${artists} ${BOOK_WORDS.en.artists}`))[0];
  const text = `
    <p class="cv-eyebrow">${esc(words('catalogue', langs).join(' · '))}</p>
    <h1 class="cv-title">${titles.map((t, i) => `<span class="v${i ? ' alt' : ''}">${esc(t)}</span>`).join('')}</h1>
    ${subs.length ? `<p class="cv-sub">${subs.map((t, i) => `<span class="v${i ? ' alt' : ''}">${esc(t)}</span>`).join('')}</p>` : ''}
    <div class="cv-meta">${dates.map((d) => `<span>${esc(d)}</span>`).join('')}${ex.venue ? `<span>${esc(ex.venue)}</span>` : ''}<span>${esc(count)}</span></div>
    ${note.length ? `<div class="cv-note">${note.map((n, i) => `<p class="${i ? 'alt' : ''}">${paragraphs(n).join('<br>')}</p>`).join('')}</div>` : ''}`;
  const picHtml = pic ? `<div class="cv-pic"><img src="${esc(img(pic, 1600))}" alt="" decoding="async"></div>` : '';
  return `<div class="cover cover-image${pic ? '' : ' no-pic'}">${picHtml}<div class="cv-text">${text}</div>
    ${foot.length ? `<p class="cv-foot">${esc(foot.join(' · '))}</p>` : ''}</div>`;
}

// Fills pages with items, starting a new page whenever the next item would overflow.
// Items are HTML strings; a long paragraph (class "split") is broken between pages by words.
function flow(book, kind, label, heading, items, { grid = false } = {}) {
  const pages = [];
  let area;
  const start = (first) => {
    const sheet = newPage(book, kind, label);
    sheet.innerHTML = `<div class="flow">${heading ? `<h2 class="flow-h">${heading}${first ? '' : ' <span class="cont">(ต่อ / cont.)</span>'}</h2>` : ''}<div class="flow-body${grid ? ' grid' : ''}"></div></div>`;
    area = sheet.querySelector('.flow-body');
    pages.push(sheet);
  };
  const fits = () => area.parentElement.scrollHeight <= area.parentElement.clientHeight + 1;
  start(true);
  for (const html of items) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const el = tmp.firstElementChild;
    area.appendChild(el);
    if (fits()) continue;
    if (el.classList.contains('split')) {
      // Keep as many words as fit here; the rest starts the next page.
      const segs = segment(el.dataset.text || el.textContent);
      let lo = 0; let hi = segs.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        el.textContent = segs.slice(0, mid).join('');
        if (fits()) lo = mid; else hi = mid - 1;
      }
      if (lo > 0) {
        el.textContent = segs.slice(0, lo).join('');
        let rest = segs.slice(lo).join('').trim();
        while (rest) {
          start(false);
          const p = el.cloneNode(false);
          p.textContent = rest;
          area.appendChild(p);
          if (fits()) { rest = ''; break; }
          const s2 = segment(rest);
          let a = 0; let z = s2.length;
          while (a < z) { const m = Math.ceil((a + z) / 2); p.textContent = s2.slice(0, m).join(''); if (fits()) a = m; else z = m - 1; }
          p.textContent = s2.slice(0, Math.max(1, a)).join('');
          rest = s2.slice(Math.max(1, a)).join('').trim();
        }
        continue;
      }
    }
    if (area.children.length > 1) {
      area.removeChild(el);
      start(false);
      area.appendChild(el);
    }
  }
  return pages;
}

function segment(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return [...new Intl.Segmenter('th', { granularity: 'word' }).segment(text)].map((s) => s.segment);
  }
  return text.split(/(\s+)/);
}

// Builds the whole book inside `book`; returns the page wrappers in order.
export async function renderBook(book, data, { origin = location.origin } = {}) {
  const { exhibition: ex, settings, template, reviewers } = data;
  const layout = template.layout;
  const langs = settings.langs;
  const works = orderWorks(data.works, settings, ex, collator);
  const ctx = { ex, settings, langs, layout, origin };
  book.innerHTML = '';
  book.setAttribute('style', themeVars(layout));
  book.lang = langs[0] === 'zh' ? 'zh-Hans' : langs[0];
  await loadBookFonts(layout);
  const S = settings.sections;

  // The cover is the uploaded cover image, shown whole on the A4 page; without one, a simple cover from the texts.
  if (S.cover) {
    const up = data.cover && data.cover.url;
    newPage(book, 'cover', 'ปก / Cover').innerHTML = up
      ? `<div class="cover-upload"><img src="${esc(img(up, 2400))}" alt="${esc(values(ex, 'title', langs)[0] || '')}" decoding="async"></div>`
      : coverHtml(ctx, works);
  }

  if (S.statement) {
    const items = [];
    const ls = langs.filter((l) => (ex[`statement_${l}`] || '').trim());
    for (const l of ls) {
      if (ls.length > 1) items.push(`<h3 class="flow-sub" lang="${l}">${esc(BOOK_WORDS[l].statement)}</h3>`);
      for (const p of String(ex[`statement_${l}`]).split(/\n{2,}/).map((x) => x.trim()).filter(Boolean)) {
        items.push(`<p class="split" lang="${l}" data-text="${esc(p)}">${esc(p)}</p>`);
      }
    }
    if (items.length) flow(book, 'statement', words('statement', langs).join(' / '), esc(words('statement', langs).join(' / ')), items);
  }

  if (S.committee && reviewers.length) {
    const items = reviewers.map((r, i) => `<div class="person"><span class="pn">${i + 1}</span><div>${r.name ? `<b>${esc(r.name)}</b>` : ''}${r.title ? `<span>${esc(r.title)}</span>` : ''}</div></div>`);
    flow(book, 'committee', words('committee', langs).join(' / '), esc(words('committee', langs).join(' / ')), items, { grid: true });
  }

  const workPages = [];
  if (S.works) {
    works.forEach((w, i) => {
      const sheet = newPage(book, 'work', `No. ${pad(i + 1)} ${values(w, 'title', langs)[0] || ''}`);
      sheet.innerHTML = blocksHtml(layout.blocks, w, { ...ctx, no: i + 1 });
      sheet.parentElement.dataset.work = w.id;
      workPages.push(sheet);
    });
  }

  // Page numbers (the cover is page 1 but shows none).
  const all = [...book.querySelectorAll('.sheet')];
  all.forEach((s, i) => {
    s.parentElement.dataset.n = String(i + 1);
    if (s.classList.contains('sheet-cover')) return;
    s.querySelectorAll('.pno').forEach((x) => { x.textContent = String(i + 1); });
    if (!s.querySelector('.pno') && !s.classList.contains('sheet-work')) s.insertAdjacentHTML('beforeend', `<span class="auto-pno">${i + 1}</span>`);
  });

  if (S.index && works.length) {
    const head = words('index', langs).join(' / ');
    const items = [`<div class="ix-row ix-head"><span>${esc(words('no', langs)[0])}</span><span>${esc(words('title', langs).join(' / '))}</span><span>${esc(words('artist', langs).join(' / '))}</span><span>${esc(words('page', langs)[0])}</span></div>`,
      ...works.map((w, i) => {
        const p = workPages[i] ? workPages[i].parentElement.dataset.n : '';
        return `<div class="ix-row"><span>${pad(i + 1)}</span><span>${multi(values(w, 'title', langs))}</span><span>${multi(artistValues(w, langs))}</span><span>${p}</span></div>`;
      })];
    const before = all.length;
    const pages = flow(book, 'index', head, esc(head), items);
    pages.forEach((s, i) => s.insertAdjacentHTML('beforeend', `<span class="auto-pno">${before + i + 1}</span>`));
    pages.forEach((s, i) => { s.parentElement.dataset.n = String(before + i + 1); });
  }

  [...book.querySelectorAll('.sheet-work')].forEach(fitText);
  return [...book.querySelectorAll('.sheet-wrap')];
}

export { PAGE };

// A small, non-interactive picture of one artwork page (template thumbnails, settings preview).
export function miniSheet(layout, work, ctx, s = 0.22) {
  const inner = blocksHtml(layout.blocks, work, { origin: location.origin, no: 1, ...ctx, layout });
  return `<div class="mini" style="--s:${s}"><section class="sheet sheet-work" style="${themeVars(layout)}">${inner}</section></div>`;
}
