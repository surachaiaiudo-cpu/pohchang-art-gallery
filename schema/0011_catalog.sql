-- Exhibition catalogue (สูจิบัตร), 2026-10-23. Also applied automatically by functions/_lib/migrate.js.
-- exhibitions.catalog: JSON settings (template, languages, fields, order, sections; see public/js/catalog-core.js).
-- exhibitions.catalog_published_at: NULL = not published (visitors cannot open it).
ALTER TABLE exhibitions ADD COLUMN catalog TEXT NOT NULL DEFAULT '';
ALTER TABLE exhibitions ADD COLUMN catalog_published_at TEXT;
-- Templates made by admins and exhibition staff, shared by every exhibition. Built-in templates live in code.
CREATE TABLE IF NOT EXISTS catalog_templates (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  layout       TEXT NOT NULL DEFAULT '{}',
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
