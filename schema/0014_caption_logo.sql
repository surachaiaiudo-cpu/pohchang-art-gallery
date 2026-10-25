-- Printed wall captions: logo of the exhibition (left 30 % of each caption). Also applied by migrate.js.
ALTER TABLE exhibitions ADD COLUMN caption_logo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE exhibitions ADD COLUMN caption_logo_file_id TEXT NOT NULL DEFAULT '';
