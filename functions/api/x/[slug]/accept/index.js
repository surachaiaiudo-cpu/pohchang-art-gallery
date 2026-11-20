import { handle, json, clientIp, HttpError } from '../../../../_lib/http.js';
import { parseOverrides } from '../../../../_lib/exhibitions.js';
import { enforce } from '../../../../_lib/ratelimit.js';
import { loadAcceptExhibition, acceptWindow, normSearch, SIGNABLE } from '../../../../_lib/acceptance.js';

// GET /api/x/:slug/accept          -> the page's header (title, open or not, closing day)
// GET /api/x/:slug/accept?q=name   -> up to 8 artists (result ผ่าน) whose name contains q (min 2 characters)
export const onRequestGet = handle(async ({ request, env, params }) => {
  const db = env.DB;
  const ex = await loadAcceptExhibition(db, params.slug);
  const win = acceptWindow(ex);
  const url = new URL(request.url);
  const q = normSearch(url.searchParams.get('q')).slice(0, 100);
  const info = {
    slug: ex.slug, title_th: ex.title_th, title_en: ex.title_en, title_zh: ex.title_zh,
    theme_preset: ex.theme_preset, theme_overrides: parseOverrides(ex), closes_on: ex.accept_closes_on || '', open: win.open, closed: !!ex.accept_open && !win.open
  };
  if (!url.searchParams.has('q')) return json({ ok: true, exhibition: info });
  if (!win.open) throw new HttpError(409, win.reason);
  if (q.length < 2) return json({ ok: true, exhibition: info, results: [] });
  await enforce(db, `accept-q:${clientIp(request)}`, { limit: 300, windowSec: 3600 }, 'ค้นหาถี่เกินไป กรุณารอสักครู่');
  const { results } = await db.prepare(
    `SELECT a.id, a.name_th, a.name_en, a.nationality, (c.artist_id IS NOT NULL) AS signed
       FROM artists a LEFT JOIN acceptances c ON c.artist_id = a.id
      WHERE a.exhibition_id = ? AND ${SIGNABLE.replace(/(roster|withdrawn)/g, 'a.$1')}`
  ).bind(ex.id).all();
  const words = q.split(' ');
  const found = results
    .filter((a) => { const h = normSearch(`${a.name_th} ${a.name_en}`); return words.every((w) => h.includes(w)); })
    .slice(0, 8)
    .map((a) => ({ id: a.id, name_th: a.name_th, name_en: a.name_en, nationality: a.nationality, signed: !!a.signed }));
  return json({ ok: true, exhibition: info, results: found });
});
