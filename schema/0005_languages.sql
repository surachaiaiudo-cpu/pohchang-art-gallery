-- Chinese content (optional; pages fall back to English, then Thai). Applied automatically by
-- functions/_lib/migrate.js, which also adds English/Chinese labels to the default categories.
ALTER TABLE exhibitions ADD COLUMN title_zh TEXT NOT NULL DEFAULT '';
ALTER TABLE exhibitions ADD COLUMN subtitle_zh TEXT NOT NULL DEFAULT '';
ALTER TABLE exhibitions ADD COLUMN statement_zh TEXT NOT NULL DEFAULT '';
ALTER TABLE exhibitions ADD COLUMN badge_label_zh TEXT NOT NULL DEFAULT '经专家评审入选';
ALTER TABLE works ADD COLUMN title_zh TEXT NOT NULL DEFAULT '';
ALTER TABLE works ADD COLUMN technique_zh TEXT NOT NULL DEFAULT '';
ALTER TABLE works ADD COLUMN concept_zh TEXT NOT NULL DEFAULT '';
ALTER TABLE artists ADD COLUMN name_zh TEXT NOT NULL DEFAULT '';
ALTER TABLE artists ADD COLUMN bio_zh TEXT NOT NULL DEFAULT '';
