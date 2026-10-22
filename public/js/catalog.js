// Catalogue page /e/:slug/catalog: the whole book as A4 pages, printed or saved as PDF by the browser
// (whole book, one page, or a list of pages). ?preview=1 shows the unpublished book to its staff.
import { api, esc, slugFromPath } from './core.js';
import { t, pick, applyStatic, mountSwitcher, localError } from './i18n.js';
import { renderBook } from './catalog-render.js';
import { parsePageList } from './catalog-core.js';

applyStatic();
mountSwitcher(document.getElementById('lang'));

const $ = (id) => document.getElementById(id);
const slug = slugFromPath(1);
const preview = new URLSearchParams(location.search).get('preview') === '1';
let pages = [];
let fileName = 'catalogue';

// Pages are drawn at real size (210 mm) and scaled down to fit the screen.
function fit() {
  const pagePx = 210 * 96 / 25.4;
  const side = window.innerWidth > 1000 ? 260 : 0;
  const s = Math.min(1, (window.innerWidth - 32 - side) / pagePx);
  $('book').style.setProperty('--s', s.toFixed(4));
}
window.addEventListener('resize', fit);

function status(text) {
  $('status').hidden = !text;
  $('status').textContent = text || '';
}

// Images are loaded lazily on screen; before printing, the chosen pages' images must be complete.
async function loadImages(wraps) {
  const imgs = wraps.flatMap((w) => [...w.querySelectorAll('img')]);
  let done = 0;
  const one = (im) => new Promise((resolve) => {
    im.loading = 'eager';
    const fin = () => { done += 1; status(t('catPreparing', { i: done, n: imgs.length })); resolve(); };
    if (im.complete && im.naturalWidth) { fin(); return; }
    im.addEventListener('load', fin, { once: true });
    im.addEventListener('error', fin, { once: true });
  });
  status(t('catPreparing', { i: 0, n: imgs.length }));
  await Promise.race([Promise.all(imgs.map(one)), new Promise((r) => setTimeout(r, 45000))]);
  status('');
}

async function printPages(list) {
  const chosen = list ? pages.filter((p) => list.includes(Number(p.dataset.n))) : pages;
  if (!chosen.length) return;
  document.querySelectorAll('.cbtn').forEach((b) => { b.disabled = true; });
  pages.forEach((p) => p.classList.remove('pick', 'last'));
  document.body.classList.toggle('print-some', !!list);
  if (list) { chosen.forEach((p) => p.classList.add('pick')); chosen[chosen.length - 1].classList.add('last'); }
  await loadImages(chosen);
  const old = document.title;
  document.title = list ? `${fileName}-p${list.length === 1 ? list[0] : `${list[0]}-${list[list.length - 1]}`}` : fileName;
  const restore = () => {
    document.title = old;
    document.body.classList.remove('print-some');
    document.querySelectorAll('.cbtn').forEach((b) => { b.disabled = false; });
  };
  window.addEventListener('afterprint', restore, { once: true });
  window.print();
  setTimeout(restore, 1500);
}

function addTools() {
  pages.forEach((wrap) => {
    const n = wrap.dataset.n;
    wrap.id = `p-${n}`;
    const tools = document.createElement('div');
    tools.className = 'sheet-tools no-print';
    tools.innerHTML = `<span class="n">${esc(t('catPageN', { n }))}</span><button class="cbtn sm" type="button">${esc(t('catPrintPage'))}</button>`;
    tools.querySelector('button').addEventListener('click', () => printPages([Number(n)]));
    wrap.appendChild(tools);
  });
}

async function main() {
  try {
    const data = preview
      ? await api(`/api/manage/${encodeURIComponent(slug)}/catalog?full=1`)
      : await api(`/api/x/${encodeURIComponent(slug)}/catalog`);
    const ex = data.exhibition;
    const title = pick(ex, 'title');
    document.title = `${t('catalog')} · ${title}`;
    fileName = `${t('catalog')}-${ex.slug}`;
    $('ttl').textContent = title;
    $('back').href = preview ? `/manage/${encodeURIComponent(ex.slug)}/catalog` : `/e/${encodeURIComponent(ex.slug)}`;
    if (preview) { $('note').textContent = t('catPreview'); $('note').classList.add('preview'); }
    fit();
    pages = await renderBook($('book'), data);
    $('msg').hidden = true;
    $('note').textContent = `${preview ? `${t('catPreview')} · ` : ''}${t('catPageCount', { n: pages.length })}`;
    addTools();
    document.querySelectorAll('.cbtn').forEach((b) => { b.disabled = false; });
    const target = /^#p-\d+$/.test(location.hash) && document.querySelector(location.hash);
    if (target) target.scrollIntoView();
  } catch (e) {
    const msg = e.status === 404 && !preview ? t('catNotPublished') : localError(e.message);
    $('msg').innerHTML = `${esc(msg)}<br><br><a href="/e/${encodeURIComponent(slug)}">${esc(t('catBackEx'))}</a>`;
    $('tip').hidden = true;
  }
}

$('print-all').addEventListener('click', () => printPages(null));
$('pick-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const list = parsePageList($('pick').value, pages.length);
  if (!list || !list.length) { status(t('catBadPages', { n: pages.length })); setTimeout(() => status(''), 3500); return; }
  printPages(list);
});
main();
