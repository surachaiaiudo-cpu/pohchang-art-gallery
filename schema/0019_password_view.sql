-- Admin can view passwords (owner's choice, 2026-11-19, option 3 after the risks were explained).
-- AES-GCM with APP_ENCRYPTION_KEY (encryptSecret); '' = not stored (set before this, or the key was missing).
ALTER TABLE users ADD COLUMN password_enc TEXT NOT NULL DEFAULT '';
