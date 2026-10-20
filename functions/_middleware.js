// Runs before every request: CSRF guard for API writes and security headers on every response.
import { assertSameOrigin } from './_lib/auth.js';
import { errorResponse } from './_lib/http.js';

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://ik.imagekit.io",
  "connect-src 'self' https://upload.imagekit.io",
  "frame-src https://challenges.cloudflare.com",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

export async function onRequest(context) {
  const url = new URL(context.request.url);
  let response;
  try {
    if (url.pathname.startsWith('/api/')) assertSameOrigin(context.request);
    response = await context.next();
  } catch (err) {
    response = errorResponse(err);
  }
  response = new Response(response.body, response);
  const h = response.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if ((h.get('Content-Type') || '').includes('text/html')) {
    h.set('Content-Security-Policy', CSP);
    // Review links carry a secret token in the URL: never leak it in Referer headers.
    if (url.pathname.startsWith('/review')) h.set('Referrer-Policy', 'no-referrer');
  }
  return response;
}
