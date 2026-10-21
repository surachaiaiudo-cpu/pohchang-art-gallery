-- Gallery-wide settings edited by admins (home page hero, footer contact and links).
-- One row per key; the value is JSON. Applied automatically by functions/_lib/migrate.js.
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
