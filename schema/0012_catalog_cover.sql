-- Catalogue cover = an uploaded image (owner, 2026-10-23). Also applied automatically by functions/_lib/migrate.js.
ALTER TABLE exhibitions ADD COLUMN catalog_cover_url TEXT NOT NULL DEFAULT '';
ALTER TABLE exhibitions ADD COLUMN catalog_cover_file_id TEXT NOT NULL DEFAULT '';
ALTER TABLE exhibitions ADD COLUMN catalog_cover_width INTEGER NOT NULL DEFAULT 0;
ALTER TABLE exhibitions ADD COLUMN catalog_cover_height INTEGER NOT NULL DEFAULT 0;
