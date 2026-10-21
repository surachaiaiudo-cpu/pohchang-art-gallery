import { handle, publicJson } from '../_lib/http.js';
import { loadSite } from '../_lib/site.js';

// GET /api/site - home page hero text and footer details (public; edited at /admin).
export const onRequestGet = handle(async ({ env }) => publicJson({ ok: true, site: await loadSite(env.DB) }, 60));
