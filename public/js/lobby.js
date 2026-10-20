import { api, esc, img, thDate, loadFonts } from './core.js';

loadFonts(['IBM Plex Sans Thai']);

function card(e) {
  const live = e.submission && e.submission.open;
  const dates = e.starts_on ? `${thDate(e.starts_on)}${e.ends_on ? ` – ${thDate(e.ends_on)}` : ''}` : '';
  return `<a class="ex-card" href="/e/${encodeURIComponent(e.slug)}">
    <div class="cover">${e.cover_url ? `<img src="${esc(img(e.cover_url, 800))}" alt="" loading="lazy">` : ''}</div>
    <h3>${esc(e.title_th)}</h3>
    ${e.title_en ? `<p class="muted" style="margin:0">${esc(e.title_en)}</p>` : ''}
    <p class="muted" style="margin:6px 0 0;font-size:.92rem">
      ${live ? '<span class="pill live">เปิดรับผลงาน</span> ' : ''}${esc(dates)}
      ${e.work_count ? ` · ${e.work_count} ผลงาน` : ''}${e.endorsed_count ? ` · ผ่านผู้ทรงคุณวุฒิ ${e.endorsed_count}` : ''}
    </p>
  </a>`;
}

async function main() {
  try {
    const [{ exhibitions }, cfg] = await Promise.all([api('/api/exhibitions'), api('/api/config')]);
    document.getElementById('site-name').textContent = cfg.siteName;
    document.title = cfg.siteName;
    document.getElementById('foot').textContent = `© ${new Date().getFullYear() + 543} ${cfg.siteName}`;
    const now = exhibitions.filter((e) => e.status === 'open' || e.status === 'closed');
    const past = exhibitions.filter((e) => e.status === 'archived');
    document.getElementById('now-list').innerHTML = now.length ? now.map(card).join('') : '<p class="muted">ยังไม่มีนิทรรศการที่กำลังจัด</p>';
    document.getElementById('past-list').innerHTML = past.length ? past.map(card).join('') : '<p class="muted">ยังไม่มีนิทรรศการในคลัง</p>';
  } catch (e) {
    document.getElementById('now-list').innerHTML = `<p class="error-text">${esc(e.message)}</p>`;
  }
}
main();
