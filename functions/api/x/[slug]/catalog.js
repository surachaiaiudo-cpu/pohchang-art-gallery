import { handle, publicJson } from '../../../_lib/http.js';
import { loadPublicExhibition } from '../../../_lib/exhibitions.js';
import { catalogPayload, requirePublished } from '../../../_lib/catalog.js';

// GET /api/x/:slug/catalog - the published catalogue (public). Not found until the curator publishes it.
export const onRequestGet = handle(async ({ env, params }) => {
  const ex = await loadPublicExhibition(env.DB, params.slug);
  requirePublished(ex);
  return publicJson({ ok: true, ...(await catalogPayload(env.DB, ex)) }, 60);
});
