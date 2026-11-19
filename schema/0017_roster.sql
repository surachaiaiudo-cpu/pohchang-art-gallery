-- Artist roster (owner's workshop process, 2026-11-14). Also applied by migrate.js.
-- channel: 0 not set, 1 invited, 2 committee, 3 MOU, 4 self-applied.
-- roster: '' | candidate | selected | not_selected. artist_no: เลขที่ศิลปิน (kept when withdrawn).
ALTER TABLE artists ADD COLUMN channel INTEGER NOT NULL DEFAULT 0;
ALTER TABLE artists ADD COLUMN roster TEXT NOT NULL DEFAULT '';
ALTER TABLE artists ADD COLUMN artist_no INTEGER;
ALTER TABLE artists ADD COLUMN withdrawn INTEGER NOT NULL DEFAULT 0;
ALTER TABLE artists ADD COLUMN roster_note TEXT NOT NULL DEFAULT '';
-- works.stage: 'exhibit' (normal) | 'selection' (selection-round samples, never public).
ALTER TABLE works ADD COLUMN stage TEXT NOT NULL DEFAULT 'exhibit';
-- Stage given to works sent through the public form of this exhibition.
ALTER TABLE exhibitions ADD COLUMN submit_stage TEXT NOT NULL DEFAULT 'exhibit';
CREATE INDEX IF NOT EXISTS idx_artists_no ON artists(exhibition_id, artist_no);
