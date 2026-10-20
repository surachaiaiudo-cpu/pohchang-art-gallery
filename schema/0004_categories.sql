-- Work categories (กลุ่มงาน). Applied automatically by functions/_lib/migrate.js; existing
-- exhibitions get the default list from functions/_lib/categories.js.
ALTER TABLE exhibitions ADD COLUMN categories TEXT NOT NULL DEFAULT '';
ALTER TABLE works ADD COLUMN category TEXT NOT NULL DEFAULT '';
ALTER TABLE works ADD COLUMN subcategory TEXT NOT NULL DEFAULT '';
ALTER TABLE works ADD COLUMN video_url TEXT NOT NULL DEFAULT '';
