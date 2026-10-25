// Small schema upgrades applied automatically, once per Worker isolate, so a deploy never
// depends on someone remembering to run a SQL file. Each step must be safe to retry.
import { DEFAULT_CATEGORIES, DEFAULT_CATEGORIES_V1 } from './categories.js';
import { DEFAULT_TECHNIQUES } from './techniques.js';
import { COUNTRY_ALIASES } from '../../public/js/countries.js';

const STEPS = [
  {
    // 0002_cloudinary.sql: image storage moved from ImageKit to Cloudinary.
    name: '0002_cloudinary',
    needed: async (db) => !!(await db.prepare(
      "SELECT 1 AS x FROM pragma_table_info('exhibitions') WHERE name = 'imagekit_private_enc'"
    ).first()),
    sql: [
      'ALTER TABLE exhibitions RENAME COLUMN imagekit_url_endpoint TO cloudinary_cloud_name',
      'ALTER TABLE exhibitions RENAME COLUMN imagekit_public_key TO cloudinary_api_key',
      'ALTER TABLE exhibitions RENAME COLUMN imagekit_private_enc TO cloudinary_api_secret_enc'
    ]
  },
  {
    // 0003_upload_preset.sql: support Cloudinary unsigned upload preset and default to uukpgvmz / 20workshop.
    name: '0003_upload_preset',
    needed: async (db) => !(await db.prepare(
      "SELECT 1 AS x FROM pragma_table_info('exhibitions') WHERE name = 'cloudinary_upload_preset'"
    ).first()),
    sql: [
      "ALTER TABLE exhibitions ADD COLUMN cloudinary_upload_preset TEXT NOT NULL DEFAULT '20workshop'",
      "UPDATE exhibitions SET cloudinary_cloud_name = 'uukpgvmz' WHERE cloudinary_cloud_name = ''",
      "UPDATE exhibitions SET cloudinary_upload_preset = '20workshop' WHERE cloudinary_upload_preset = ''"
    ]
  },
  {
    // 0004_categories.sql: work categories (กลุ่มงาน); existing exhibitions get the default list.
    name: '0004_categories',
    needed: async (db) => !(await db.prepare(
      "SELECT 1 AS x FROM pragma_table_info('works') WHERE name = 'video_url'"
    ).first()),
    sql: [
      "ALTER TABLE exhibitions ADD COLUMN categories TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE works ADD COLUMN category TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE works ADD COLUMN subcategory TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE works ADD COLUMN video_url TEXT NOT NULL DEFAULT ''",
      ["UPDATE exhibitions SET categories = ? WHERE categories = ''", DEFAULT_CATEGORIES]
    ]
  },
  {
    // 0005_languages.sql: Chinese content columns; the default categories gain EN/中文 labels.
    name: '0005_languages',
    needed: async (db) => !(await db.prepare(
      "SELECT 1 AS x FROM pragma_table_info('artists') WHERE name = 'bio_zh'"
    ).first()),
    sql: [
      "ALTER TABLE exhibitions ADD COLUMN title_zh TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE exhibitions ADD COLUMN subtitle_zh TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE exhibitions ADD COLUMN statement_zh TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE exhibitions ADD COLUMN badge_label_zh TEXT NOT NULL DEFAULT '经专家评审入选'",
      "ALTER TABLE works ADD COLUMN title_zh TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE works ADD COLUMN technique_zh TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE works ADD COLUMN concept_zh TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE artists ADD COLUMN name_zh TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE artists ADD COLUMN bio_zh TEXT NOT NULL DEFAULT ''",
      ["UPDATE exhibitions SET categories = ? WHERE categories = ?", DEFAULT_CATEGORIES, DEFAULT_CATEGORIES_V1]
    ]
  },
  {
    // 0007_site_settings.sql: gallery-wide settings (home page hero, footer).
    name: '0007_site_settings',
    needed: async (db) => !(await db.prepare(
      "SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'site_settings'"
    ).first()),
    sql: [
      "CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT (datetime('now')))"
    ]
  },
  {
    // 0008_techniques.sql: technique groups for the exhibition filter; existing exhibitions get the default list.
    // Old works keep only their free text until a curator confirms a group (suggested by guessTechnique).
    name: '0008_techniques',
    needed: async (db) => !(await db.prepare(
      "SELECT 1 AS x FROM pragma_table_info('works') WHERE name = 'technique_group'"
    ).first()),
    sql: [
      "ALTER TABLE exhibitions ADD COLUMN techniques TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE works ADD COLUMN technique_group TEXT NOT NULL DEFAULT ''",
      ["UPDATE exhibitions SET techniques = ? WHERE techniques = ''", DEFAULT_TECHNIQUES]
    ]
  },
  {
    // Nationality became a country code: turn the free text typed so far ("Thailand", "ไทย") into codes.
    // Text that matches no known spelling is kept as typed for the curator to fix.
    name: '0006_nationality_codes',
    needed: async (db) => !!(await db.prepare(
      "SELECT 1 AS x FROM artists WHERE nationality != '' AND nationality NOT GLOB '[A-Z][A-Z]' LIMIT 1"
    ).first()),
    sql: Object.entries(COUNTRY_ALIASES).map(([code, names]) => [
      `UPDATE artists SET nationality = ? WHERE nationality NOT GLOB '[A-Z][A-Z]'
          AND lower(trim(nationality)) IN (${names.map(() => '?').join(',')})`, code, ...names
    ])
  },
  {
    // Status model of 2026-10-21: 'closed' used to mean "on view, not accepting work" and now means
    // ซ่อน (hidden). Those exhibitions stay on view as 'open'; their dates decide submissions.
    // Runs once (marker row), so exhibitions hidden later are never turned back.
    name: '0009_status_model',
    needed: async (db) => !(await db.prepare(
      "SELECT 1 AS x FROM site_settings WHERE key = 'migration:0009_status_model'"
    ).first()),
    sql: [
      "UPDATE exhibitions SET status = 'open' WHERE status = 'closed'",
      "INSERT OR IGNORE INTO site_settings (key, value) VALUES ('migration:0009_status_model', '{}')"
    ]
  },
  {
    // Home page card style per exhibition (2026-10-21); '' follows the exhibition's theme.
    name: '0010_card_style',
    needed: async (db) => !(await db.prepare(
      "SELECT 1 AS x FROM pragma_table_info('exhibitions') WHERE name = 'card_style'"
    ).first()),
    sql: ["ALTER TABLE exhibitions ADD COLUMN card_style TEXT NOT NULL DEFAULT ''"]
  },
  {
    // Owner's request 2026-10-25: "on view" and "open call" are separate. Two switches on an open
    // (เปิด) exhibition: on_view = จัดแสดง (listed under "on view"), accepting = เปิดรับ (the call
    // for work, still only inside its dates). Open exhibitions keep accepting as before; they are on
    // view when they already have shown works (owner's choice).
    name: '0013_view_and_call',
    needed: async (db) => !(await db.prepare(
      "SELECT 1 AS x FROM pragma_table_info('exhibitions') WHERE name = 'accepting'"
    ).first()),
    sql: [
      'ALTER TABLE exhibitions ADD COLUMN on_view INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE exhibitions ADD COLUMN accepting INTEGER NOT NULL DEFAULT 0',
      `UPDATE exhibitions SET accepting = 1 WHERE status = 'open'`,
      `UPDATE exhibitions SET on_view = 1 WHERE status = 'open' AND EXISTS
         (SELECT 1 FROM works w WHERE w.exhibition_id = exhibitions.id AND w.status = 'shown' AND w.deleted_at IS NULL)`
    ]
  }
];

let done = null;

async function run(db) {
  for (const step of STEPS) {
    if (!(await step.needed(db))) continue;
    try {
      // An entry is SQL text, or [sql, ...bound values].
      await db.batch(step.sql.map((s) => (Array.isArray(s) ? db.prepare(s[0]).bind(...s.slice(1)) : db.prepare(s))));
    } catch (err) {
      // Another isolate may have applied it at the same moment; only fail if it is still needed.
      if (await step.needed(db)) throw err;
    }
  }
}

export function ensureSchema(env) {
  if (!env.DB) return Promise.resolve();
  if (!done) done = run(env.DB).catch((err) => { done = null; throw err; });
  return done;
}
