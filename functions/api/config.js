import { publicJson } from '../_lib/http.js';

// GET /api/config - public, non-secret settings for the pages.
export async function onRequestGet({ env }) {
  return publicJson({
    ok: true,
    siteName: env.SITE_NAME || 'หอศิลป์ออนไลน์',
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || ''
  }, 300);
}
