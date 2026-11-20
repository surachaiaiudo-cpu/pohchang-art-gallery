-- Kind of event (owner 2026-11-20): 'exhibition' (a gallery to view) or 'workshop' (artists are selected and invited,
-- then their works are exhibited). Workshop dates are the days of the workshop itself (not of the exhibition).
-- Also applied by migrate.js.
ALTER TABLE exhibitions ADD COLUMN workshop_starts_on TEXT;
ALTER TABLE exhibitions ADD COLUMN workshop_ends_on TEXT;
ALTER TABLE exhibitions ADD COLUMN kind TEXT NOT NULL DEFAULT 'exhibition';

-- 0022 (owner 2026-11-20, run once by migrate.js): exhibitions already using the workshop tools become workshops.
UPDATE exhibitions SET kind = 'workshop' WHERE kind = 'exhibition' AND (
  id IN (SELECT exhibition_id FROM artists WHERE channel > 0 OR artist_no IS NOT NULL OR withdrawn = 1 OR coordinator_id IS NOT NULL)
  OR id IN (SELECT exhibition_id FROM exhibition_members WHERE member_role = 'coordinator')
  OR id IN (SELECT exhibition_id FROM acceptances));
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('migration:0022_kind_workshops', '{}');
