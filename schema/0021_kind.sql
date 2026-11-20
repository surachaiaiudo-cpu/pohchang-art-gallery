-- Kind of event (owner 2026-11-20): 'exhibition' (a gallery to view) or 'workshop' (artists are selected and invited,
-- then their works are exhibited). Workshop dates are the days of the workshop itself (not of the exhibition).
-- Also applied by migrate.js.
ALTER TABLE exhibitions ADD COLUMN workshop_starts_on TEXT;
ALTER TABLE exhibitions ADD COLUMN workshop_ends_on TEXT;
ALTER TABLE exhibitions ADD COLUMN kind TEXT NOT NULL DEFAULT 'exhibition';
