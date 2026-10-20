-- Image storage moves from ImageKit to Cloudinary (2026-10-20).
-- Run once on databases created with 0001_init.sql.
ALTER TABLE exhibitions RENAME COLUMN imagekit_url_endpoint TO cloudinary_cloud_name;
ALTER TABLE exhibitions RENAME COLUMN imagekit_public_key TO cloudinary_api_key;
ALTER TABLE exhibitions RENAME COLUMN imagekit_private_enc TO cloudinary_api_secret_enc;
