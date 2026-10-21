-- Technique groups (เทคนิค) for the exhibition filter. Applied automatically by
-- functions/_lib/migrate.js; existing exhibitions get the default list from functions/_lib/techniques.js.
-- works.technique_group holds the chosen group (its Thai label); technique_th/en/zh stay as free-text detail.
ALTER TABLE exhibitions ADD COLUMN techniques TEXT NOT NULL DEFAULT '';
ALTER TABLE works ADD COLUMN technique_group TEXT NOT NULL DEFAULT '';
