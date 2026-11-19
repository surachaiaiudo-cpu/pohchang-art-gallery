-- Coordinators (owner, 2026-11-19). Also applied by migrate.js.
-- exhibition_members.member_role: 'manager' (curator / ผู้ดูแลนิทรรศการ, as before) | 'coordinator' (ผู้ประสานงาน).
ALTER TABLE exhibition_members ADD COLUMN member_role TEXT NOT NULL DEFAULT 'manager';
-- One coordinator per artist (a user id); when the artist was told to sign (and by whom); when they signed.
ALTER TABLE artists ADD COLUMN coordinator_id INTEGER;
ALTER TABLE artists ADD COLUMN notified_at TEXT;
ALTER TABLE artists ADD COLUMN notified_by INTEGER;
ALTER TABLE artists ADD COLUMN accepted_at TEXT;
ALTER TABLE artists ADD COLUMN accepted_by TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_artists_coord ON artists(exhibition_id, coordinator_id);
