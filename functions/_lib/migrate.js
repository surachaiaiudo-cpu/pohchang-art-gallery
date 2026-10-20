// Small schema upgrades applied automatically, once per Worker isolate, so a deploy never
// depends on someone remembering to run a SQL file. Each step must be safe to retry.
import { DEFAULT_CATEGORIES } from './categories.js';

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
