-- Caption background pictures (logo part / details part). Also applied by migrate.js.
ALTER TABLE exhibitions ADD COLUMN caption_bg_logo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE exhibitions ADD COLUMN caption_bg_logo_file_id TEXT NOT NULL DEFAULT '';
ALTER TABLE exhibitions ADD COLUMN caption_bg_body_url TEXT NOT NULL DEFAULT '';
ALTER TABLE exhibitions ADD COLUMN caption_bg_body_file_id TEXT NOT NULL DEFAULT '';
