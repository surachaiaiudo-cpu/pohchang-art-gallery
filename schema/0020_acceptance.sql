-- Acceptance page (ลงนามตอบรับ, owner 2026-11-20): the 20th "Invitation Reply Form" on the website.
-- Also applied by migrate.js.
ALTER TABLE exhibitions ADD COLUMN accept_open INTEGER NOT NULL DEFAULT 0;
ALTER TABLE exhibitions ADD COLUMN accept_closes_on TEXT;   -- 'YYYY-MM-DD', open until the end of that day (Bangkok)
CREATE TABLE IF NOT EXISTS acceptances (
  artist_id     INTEGER PRIMARY KEY REFERENCES artists(id) ON DELETE CASCADE,
  exhibition_id INTEGER NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  data          TEXT NOT NULL DEFAULT '{}',   -- the reply form (education, age, exhibitions, types, peer review, food, followers, ...)
  before        TEXT NOT NULL DEFAULT '{}',   -- the artist's details as staff had entered them, before the first reply
  changes       TEXT NOT NULL DEFAULT '[]',   -- [{ field, from, to, at }] what the artist corrected
  signed_name   TEXT NOT NULL DEFAULT '',
  filled_by     TEXT NOT NULL DEFAULT 'self', -- self | coordinator | friend
  times         INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_accept_ex ON acceptances(exhibition_id);
