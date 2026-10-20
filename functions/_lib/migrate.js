// Small schema upgrades applied automatically, once per Worker isolate, so a deploy never
// depends on someone remembering to run a SQL file. Each step must be safe to retry.
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
  }
];

let done = null;

async function run(db) {
  for (const step of STEPS) {
    if (!(await step.needed(db))) continue;
    try {
      await db.batch(step.sql.map((s) => db.prepare(s)));
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
