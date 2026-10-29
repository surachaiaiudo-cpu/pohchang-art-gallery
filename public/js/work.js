import { api, esc, img, applyTheme, paras, badgeHtml, icons, slugFromPath } from './core.js';
import { t, pick, pickOther, catLabel, techniqueLabel, applyStatic, mountSwitcher, localError, locale } from './i18n.js';
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
    back.innerHTML = `${icons.arrowLeft}<span>${esc(exTitle)}</span>`;
    const no = String(d.position).padStart(3, '0');
    document.getElementById('pos').textContent = `${no} / ${String(d.total).padStart(3, '0')}`;
    const artist = [w.academic_title_th, name].filter(Boolean).join(' ');
    const titleOther = pickOther(w, 'title'), nameOther = pickOther(w, 'artist_name');
    const concept = pick(w, 'concept'), bio = pick(w, 'bio');
    const country = countryName(w.nationality, locale);
    el.innerHTML = `
      <figure class="work-figure">
        <div class="wall"><img id="main-img" src="${esc(img(w.image_url, 1600))}" alt="${esc(t('by', { title, artist: name }))}"></div>
        <figcaption>${esc(t(matchMedia('(hover: none)').matches ? 'figHintTouch' : 'figHint'))}</figcaption>
      </figure>
      <article class="work-info" aria-labelledby="w-title">
        ${w.endorsed ? `<p style="margin:0">${badgeHtml(pick(ex, 'badge_label'))}</p>` : ''}
        <div class="label">
          <span class="no">No. ${no}</span>
          <h1 id="w-title">${esc(title)}</h1>
          ${titleOther ? `<span class="muted">${esc(titleOther)}</span>` : ''}
          <span class="artist-line">${flagImg(w.nationality, { alt: country }, esc)}${esc(artist)}</span>
        </div>
        <dl class="facts">
          ${fact(t('category'), catLabel(ex.categories, w))}
          ${fact(t('technique'), techniqueLabel(ex.techniques, w))}
          ${fact(t('size'), w.dimensions)}
          ${fact(t('year'), w.year_created)}
          ${fact(t('nationality'), country, flagImg(w.nationality))}
          ${fact(t('affiliation'), w.affiliation)}
          <dt>${esc(t('exhibitionLabel'))}</dt><dd><a href="${base}">${esc(exTitle)}</a></dd>
        </dl>
        ${w.video_url ? `<p style="margin:0"><a class="btn btn-ghost" href="${esc(w.video_url)}" target="_blank" rel="noopener noreferrer">${esc(t('watchVideo'))} ↗</a></p>` : ''}
        ${concept ? `<section class="concept"><h2>${esc(t('concept'))}</h2>${paras(concept)}</section>` : ''}
        ${bio || w.avatar_url ? `
          <section class="artist-box" aria-label="${esc(t('artist'))}">
            ${w.avatar_url ? `<img src="${esc(img(w.avatar_url, 400))}" alt="">` : ''}
            <div><strong>${esc(artist)}</strong>${nameOther ? `<div class="muted">${esc(nameOther)}</div>` : ''}
              ${bio ? `<div class="muted" style="font-size:.95rem">${paras(bio)}</div>` : ''}</div>
          </section>` : ''}
        <nav class="pager" aria-label="${esc(t('pager'))}">
          ${d.prev ? `<a href="${base}/work/${d.prev.id}"><small>← ${esc(t('prev'))}</small><b>${esc(pick(d.prev, 'title'))}</b></a>` : ''}
          ${d.next ? `<a class="next" href="${base}/work/${d.next.id}"><small>${esc(t('next'))} →</small><b>${esc(pick(d.next, 'title'))}</b></a>` : ''}
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
      if (e.key === 'ArrowLeft' && d.prev) location.href = `${base}/work/${d.prev.id}`;
      if (e.key === 'ArrowRight' && d.next) location.href = `${base}/work/${d.next.id}`;
    });
  } catch (e) {
    el.innerHTML = `<div><h1>${esc(t('notFoundWork'))}</h1><p class="muted">${esc(localError(e.message))}</p><a class="btn btn-ghost" href="${base}">${esc(t('backExhibition'))}</a></div>`;
  }
}
main();
