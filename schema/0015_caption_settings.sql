-- Caption design per exhibition (JSON). Also applied by migrate.js.
ALTER TABLE exhibitions ADD COLUMN caption_settings TEXT NOT NULL DEFAULT '';
