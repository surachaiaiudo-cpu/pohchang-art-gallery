import { api, esc, img, applyTheme, paras, badgeHtml, icons, slugFromPath } from './core.js';
import { t, pick, pickOther, catLabel, applyStatic, mountSwitcher, localError, locale } from './i18n.js';
import { countryName, flagImg } from './countries.js';

applyStatic();
mountSwitcher(document.getElementById('lang'));

const slug = slugFromPath(1);
const id = slugFromPath(3);
const base = `/e/${encodeURIComponent(slug)}`;

function fact(label, value, prefixHtml = '') {
  return value ? `<dt>${esc(label)}</dt><dd><span>${prefixHtml}${esc(value)}</span></dd>` : '';
}

async function main() {
  const el = document.getElementById('work');
  try {
    const d = await api(`/api/x/${encodeURIComponent(slug)}/works/${encodeURIComponent(id)}`);
    const { exhibition: ex, work: w } = d;
    applyTheme(ex);
    const title = pick(w, 'title'), exTitle = pick(ex, 'title'), name = pick(w, 'artist_name');
    document.title = `${title} — ${exTitle}`;
    const back = document.getElementById('back');
    back.href = base;
    back.textContent = `← ${exTitle}`;
    document.getElementById('pos').textContent = `${d.position} / ${d.total}`;
    const artist = [w.academic_title_th, name].filter(Boolean).join(' ');
    const titleOther = pickOther(w, 'title'), nameOther = pickOther(w, 'artist_name');
    const concept = pick(w, 'concept'), bio = pick(w, 'bio');
    el.innerHTML = `
      <figure class="work-figure" style="margin:0">
        <img id="main-img" src="${esc(img(w.image_url, 1600))}" alt="${esc(t('by', { title, artist: name }))}">
      </figure>
      <article>
        ${w.endorsed ? `<p style="margin:0 0 14px">${badgeHtml(pick(ex, 'badge_label'))}</p>` : ''}
        <h1 style="font-size:clamp(1.6rem,3.4vw,2.4rem)">${esc(title)}</h1>
        ${titleOther ? `<p class="muted" style="margin-top:-4px">${esc(titleOther)}</p>` : ''}
        <dl class="facts">
          ${fact(t('artist'), artist)}
          ${fact(t('category'), catLabel(ex.categories, w))}
          ${fact(t('technique'), pick(w, 'technique'))}
          ${fact(t('size'), w.dimensions)}
          ${fact(t('year'), w.year_created)}
          ${fact(t('affiliation'), w.affiliation)}
          ${fact(t('nationality'), countryName(w.nationality, locale), flagImg(w.nationality))}
        </dl>
        ${w.video_url ? `<p><a class="btn btn-ghost" href="${esc(w.video_url)}" target="_blank" rel="noopener noreferrer">${esc(t('watchVideo'))} ↗</a></p>` : ''}
        ${concept ? `<h2 style="font-size:1.15rem">${esc(t('concept'))}</h2>${paras(concept)}` : ''}
        ${bio || w.avatar_url ? `
          <div class="artist-box">
            ${w.avatar_url ? `<img src="${esc(img(w.avatar_url, 160))}" alt="">` : ''}
            <div><strong>${esc(artist)}</strong>${nameOther ? `<div class="muted">${esc(nameOther)}</div>` : ''}</div>
          </div>
          ${bio ? `<div class="muted">${paras(bio)}</div>` : ''}` : ''}
        <nav class="pager" aria-label="${esc(t('pager'))}">
          ${d.prev ? `<a class="btn btn-ghost" href="${base}/work/${d.prev}">${icons.arrowLeft} ${esc(t('prev'))}</a>` : '<span></span>'}
          ${d.next ? `<a class="btn btn-ghost" href="${base}/work/${d.next}">${esc(t('next'))} ${icons.arrowRight}</a>` : ''}
        </nav>
      </article>`;
    const lb = document.getElementById('lightbox');
    document.getElementById('main-img').addEventListener('click', () => {
      lb.querySelector('img').src = img(w.image_url, 2400);
      lb.querySelector('img').alt = title;
      lb.classList.add('open');
      lb.focus();
    });
    lb.addEventListener('click', () => lb.classList.remove('open'));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') lb.classList.remove('open');
      if (e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowLeft' && d.prev) location.href = `${base}/work/${d.prev}`;
      if (e.key === 'ArrowRight' && d.next) location.href = `${base}/work/${d.next}`;
    });
  } catch (e) {
    el.innerHTML = `<div><h1>${esc(t('notFoundWork'))}</h1><p class="muted">${esc(localError(e.message))}</p><a class="btn btn-ghost" href="${base}">${esc(t('backExhibition'))}</a></div>`;
  }
}
main();
