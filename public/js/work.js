import { api, esc, img, applyTheme, paras, badgeHtml, icons, slugFromPath } from './core.js';

const slug = slugFromPath(1);
const id = slugFromPath(3);
const base = `/e/${encodeURIComponent(slug)}`;

function fact(label, value) {
  return value ? `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>` : '';
}

async function main() {
  const el = document.getElementById('work');
  try {
    const d = await api(`/api/x/${encodeURIComponent(slug)}/works/${encodeURIComponent(id)}`);
    const { exhibition: ex, work: w } = d;
    applyTheme(ex);
    document.title = `${w.title_th} — ${ex.title_th}`;
    const back = document.getElementById('back');
    back.href = base;
    back.textContent = `← ${ex.title_th}`;
    document.getElementById('pos').textContent = `${d.position} / ${d.total}`;
    const artist = [w.academic_title_th, w.artist_name_th].filter(Boolean).join(' ');
    el.innerHTML = `
      <figure class="work-figure" style="margin:0">
        <img id="main-img" src="${esc(img(w.image_url, 1600))}" alt="${esc(w.title_th)} โดย ${esc(w.artist_name_th)}">
      </figure>
      <article>
        ${w.endorsed ? `<p style="margin:0 0 14px">${badgeHtml(ex.badge_label_th)}</p>` : ''}
        <h1 style="font-size:clamp(1.6rem,3.4vw,2.4rem)">${esc(w.title_th)}</h1>
        ${w.title_en ? `<p class="muted" style="margin-top:-4px">${esc(w.title_en)}</p>` : ''}
        <dl class="facts">
          ${fact('ศิลปิน', artist)}
          ${fact('เทคนิค', w.technique_th)}
          ${fact('ขนาด', w.dimensions)}
          ${fact('ปีที่สร้าง', w.year_created)}
          ${fact('สังกัด', w.affiliation)}
        </dl>
        ${w.concept_th ? `<h2 style="font-size:1.15rem">แนวคิด</h2>${paras(w.concept_th)}` : ''}
        ${w.bio_th || w.avatar_url ? `
          <div class="artist-box">
            ${w.avatar_url ? `<img src="${esc(img(w.avatar_url, 160))}" alt="">` : ''}
            <div><strong>${esc(artist)}</strong>${w.artist_name_en ? `<div class="muted">${esc(w.artist_name_en)}</div>` : ''}</div>
          </div>
          ${w.bio_th ? `<div class="muted">${paras(w.bio_th)}</div>` : ''}` : ''}
        <nav class="pager" aria-label="ผลงานก่อนหน้าและถัดไป">
          ${d.prev ? `<a class="btn btn-ghost" href="${base}/work/${d.prev}">${icons.arrowLeft} ก่อนหน้า</a>` : '<span></span>'}
          ${d.next ? `<a class="btn btn-ghost" href="${base}/work/${d.next}">ถัดไป ${icons.arrowRight}</a>` : ''}
        </nav>
      </article>`;
    const lb = document.getElementById('lightbox');
    document.getElementById('main-img').addEventListener('click', () => {
      lb.querySelector('img').src = img(w.image_url, 2400);
      lb.querySelector('img').alt = w.title_th;
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
    el.innerHTML = `<div><h1>ไม่พบผลงาน</h1><p class="muted">${esc(e.message)}</p><a class="btn btn-ghost" href="${base}">กลับนิทรรศการ</a></div>`;
  }
}
main();
