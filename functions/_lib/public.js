// Shapes for public responses: only what visitors may see (no email, no phone, no votes).
export const PUBLIC_WORK_SQL = `
  SELECT w.id, w.title_th, w.title_en, w.technique_th, w.technique_en, w.dimensions, w.year_created,
         w.concept_th, w.concept_en, w.price, w.image_url, w.image_width, w.image_height, w.zone,
         w.display_order, w.endorsed,
         a.id AS artist_id, a.name_th AS artist_name_th, a.name_en AS artist_name_en,
         a.academic_title_th, a.academic_title_en, a.nationality, a.affiliation,
         a.bio_th, a.bio_en, a.avatar_url
    FROM works w JOIN artists a ON a.id = w.artist_id
   WHERE w.exhibition_id = ? AND w.status = 'shown' AND w.deleted_at IS NULL`;
