-- Art Gallery Platform: one database for every exhibition.
-- Every exhibition-owned row carries exhibition_id; queries must always filter by it.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- people
CREATE TABLE IF NOT EXISTS users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  email                TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name                 TEXT NOT NULL DEFAULT '',
  role                 TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  password_hash        TEXT NOT NULL,
  password_salt        TEXT NOT NULL,
  password_iters       INTEGER NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  active               INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at        TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Fixed-window counters for login attempts, uploads and public submissions.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket        TEXT PRIMARY KEY,
  window_start  INTEGER NOT NULL,
  hits          INTEGER NOT NULL DEFAULT 0,
  locked_until  INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------- exhibitions
CREATE TABLE IF NOT EXISTS exhibitions (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  slug                   TEXT NOT NULL UNIQUE,
  title_th               TEXT NOT NULL,
  title_en               TEXT NOT NULL DEFAULT '',
  subtitle_th            TEXT NOT NULL DEFAULT '',
  subtitle_en            TEXT NOT NULL DEFAULT '',
  statement_th           TEXT NOT NULL DEFAULT '',
  statement_en           TEXT NOT NULL DEFAULT '',
  venue                  TEXT NOT NULL DEFAULT '',
  -- draft: hidden; open: public page + submissions per dates; closed: public, no submissions;
  -- archived: read-only in the archive list
  status                 TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'open', 'closed', 'archived')),
  starts_on              TEXT,            -- exhibition dates (display)
  ends_on                TEXT,
  submission_opens_at    TEXT,            -- ISO 8601, Asia/Bangkok offset written by the UI
  submission_closes_at   TEXT,
  max_works_per_artist   INTEGER NOT NULL DEFAULT 3,
  -- look
  theme_preset           TEXT NOT NULL DEFAULT 'white-cube',
  layout                 TEXT NOT NULL DEFAULT 'grid' CHECK (layout IN ('grid', 'masonry', 'salon')),
  theme_overrides        TEXT NOT NULL DEFAULT '{}',   -- JSON: accent, headingFont, ornament
  hero_url               TEXT NOT NULL DEFAULT '',
  hero_file_id           TEXT NOT NULL DEFAULT '',
  -- image storage: one ImageKit account per exhibition
  imagekit_url_endpoint  TEXT NOT NULL DEFAULT '',
  imagekit_public_key    TEXT NOT NULL DEFAULT '',
  imagekit_private_enc   TEXT NOT NULL DEFAULT '',     -- AES-GCM, key = APP_ENCRYPTION_KEY secret
  storage_bytes          INTEGER NOT NULL DEFAULT 0,
  storage_quota_bytes    INTEGER NOT NULL DEFAULT 4500000000,
  -- expert review (phase 2): works that reach the threshold get the badge
  review_open            INTEGER NOT NULL DEFAULT 0,
  review_deadline        TEXT,
  review_threshold       INTEGER NOT NULL DEFAULT 3,
  review_panel_size      INTEGER NOT NULL DEFAULT 5,
  review_blind           INTEGER NOT NULL DEFAULT 0,
  badge_label_th         TEXT NOT NULL DEFAULT 'ผ่านการคัดเลือกจากผู้ทรงคุณวุฒิ',
  badge_label_en         TEXT NOT NULL DEFAULT 'Selected by the Expert Panel',
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Old slugs keep working after a rename.
CREATE TABLE IF NOT EXISTS slug_redirects (
  old_slug       TEXT PRIMARY KEY,
  exhibition_id  INTEGER NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE
);

-- Which staff user looks after which exhibition (admins see everything).
CREATE TABLE IF NOT EXISTS exhibition_members (
  exhibition_id  INTEGER NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (exhibition_id, user_id)
);

-- ------------------------------------------------------- artists, works
CREATE TABLE IF NOT EXISTS artists (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  exhibition_id      INTEGER NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  name_th            TEXT NOT NULL,
  name_en            TEXT NOT NULL DEFAULT '',
  academic_title_th  TEXT NOT NULL DEFAULT '',
  academic_title_en  TEXT NOT NULL DEFAULT '',
  email              TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
  phone              TEXT NOT NULL DEFAULT '',          -- never returned publicly
  nationality        TEXT NOT NULL DEFAULT 'Thailand',
  affiliation        TEXT NOT NULL DEFAULT '',
  bio_th             TEXT NOT NULL DEFAULT '',
  bio_en             TEXT NOT NULL DEFAULT '',
  avatar_url         TEXT NOT NULL DEFAULT '',
  avatar_file_id     TEXT NOT NULL DEFAULT '',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_artists_exh ON artists(exhibition_id);
CREATE INDEX IF NOT EXISTS idx_artists_email ON artists(exhibition_id, email);

CREATE TABLE IF NOT EXISTS works (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  exhibition_id     INTEGER NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  artist_id         INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  title_th          TEXT NOT NULL,
  title_en          TEXT NOT NULL DEFAULT '',
  technique_th      TEXT NOT NULL DEFAULT '',
  technique_en      TEXT NOT NULL DEFAULT '',
  dimensions        TEXT NOT NULL DEFAULT '',
  year_created      TEXT NOT NULL DEFAULT '',
  concept_th        TEXT NOT NULL DEFAULT '',
  concept_en        TEXT NOT NULL DEFAULT '',
  price             TEXT NOT NULL DEFAULT '',
  image_url         TEXT NOT NULL,
  image_file_id     TEXT NOT NULL DEFAULT '',
  image_width       INTEGER NOT NULL DEFAULT 0,
  image_height      INTEGER NOT NULL DEFAULT 0,
  image_bytes       INTEGER NOT NULL DEFAULT 0,
  zone              TEXT NOT NULL DEFAULT '',
  display_order     INTEGER NOT NULL DEFAULT 0,
  -- phase 1: curator screening. Only 'shown' works are public and go to the expert panel.
  status            TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'shown', 'rejected')),
  -- phase 2: expert panel result, recomputed on every vote.
  review_result     TEXT NOT NULL DEFAULT 'pending'
                    CHECK (review_result IN ('pending', 'endorsed', 'not_endorsed', 'needs_curator')),
  badge_override    TEXT CHECK (badge_override IN ('endorsed', 'not_endorsed')),
  endorsed          INTEGER NOT NULL DEFAULT 0,   -- final badge flag shown to the public
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_works_exh_status ON works(exhibition_id, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_works_artist ON works(artist_id);

-- --------------------------------------------------------- expert panel
CREATE TABLE IF NOT EXISTS reviewers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  exhibition_id  INTEGER NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  title          TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL DEFAULT '',
  token_hash     TEXT NOT NULL UNIQUE,      -- SHA-256 of the personal link token
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_reviewers_exh ON reviewers(exhibition_id);

CREATE TABLE IF NOT EXISTS votes (
  work_id        INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  reviewer_id    INTEGER NOT NULL REFERENCES reviewers(id) ON DELETE CASCADE,
  exhibition_id  INTEGER NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  decision       TEXT NOT NULL CHECK (decision IN ('approve', 'reject', 'abstain')),
  comment        TEXT NOT NULL DEFAULT '',
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (work_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS idx_votes_exh ON votes(exhibition_id);

-- ------------------------------------------------------------ audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  exhibition_id  INTEGER,
  actor          TEXT NOT NULL,          -- 'user:12', 'reviewer:4', 'public'
  action         TEXT NOT NULL,
  detail         TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_exh ON audit_log(exhibition_id, created_at);
