// Local development only (DEV_FAKE_IMAGEKIT=1): stands in for an uploaded image.
export async function onRequestGet({ env, request }) {
  if (env.DEV_FAKE_IMAGEKIT !== '1') return new Response('Not found', { status: 404 });
  const seed = new URL(request.url).searchParams.get('seed') || 'x';
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
<rect width="1600" height="1200" fill="hsl(${hue},45%,62%)"/>
<circle cx="${400 + (h % 800)}" cy="${300 + (h % 500)}" r="${200 + (h % 200)}" fill="hsl(${(hue + 140) % 360},55%,40%)"/>
<rect x="${200 + (h % 300)}" y="700" width="700" height="260" fill="hsl(${(hue + 60) % 360},40%,85%)"/>
</svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' } });
}
