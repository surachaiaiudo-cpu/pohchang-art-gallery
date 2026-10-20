-- Add Cloudinary unsigned upload preset support and default to uukpgvmz / 20workshop.
ALTER TABLE exhibitions ADD COLUMN cloudinary_upload_preset TEXT NOT NULL DEFAULT '20workshop';
UPDATE exhibitions SET cloudinary_cloud_name = 'uukpgvmz' WHERE cloudinary_cloud_name = '';
UPDATE exhibitions SET cloudinary_upload_preset = '20workshop' WHERE cloudinary_upload_preset = '';
