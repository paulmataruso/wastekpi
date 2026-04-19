/**
 * migrate.js — automatic migration runner
 *
 * Creates a `schema_migrations` table on first run, then checks which
 * migration files in this directory haven't been applied yet and runs them
 * in filename order. Each migration is wrapped in a transaction so a failure
 * rolls back cleanly without leaving the DB in a half-applied state.
 *
 * Migration files must match the pattern:  NNN_description.sql
 * Examples:
 *   001_initial_schema.sql
 *   002_add_packout_table.sql
 *   003_v1_1_new_columns.sql
 *
 * To add a new migration: drop a new .sql file in this directory with the
 * next sequential number. It will be picked up automatically on next startup.
 */

const fs   = require('fs');
const path = require('path');

const MIGRATIONS_DIR = __dirname;

module.exports = async function runMigrations(pool) {
  const client = await pool.connect();
  try {
    // ── 1. Ensure the tracking table exists ───────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── 2. Find all numbered migration files, sorted by name ──────────────
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => /^\d+.*\.sql$/.test(f))
      .sort();

    if (files.length === 0) {
      console.log('[migrations] No migration files found.');
      return;
    }

    // ── 3. Check which have already been applied ──────────────────────────
    const applied = await client.query('SELECT filename FROM schema_migrations');
    const appliedSet = new Set(applied.rows.map(r => r.filename));

    const pending = files.filter(f => !appliedSet.has(f));
    if (pending.length === 0) {
      console.log('[migrations] All migrations already applied.');
      return;
    }

    console.log(`[migrations] ${pending.length} pending migration(s) to apply.`);

    // ── 4. Apply each pending migration in a transaction ──────────────────
    for (const filename of pending) {
      const filepath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filepath, 'utf8');

      console.log(`[migrations] Applying: ${filename}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log(`[migrations] Applied:  ${filename} ✓`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrations] FAILED:   ${filename} — ${err.message}`);
        throw err; // bubble up — server will not start if a migration fails
      }
    }

    console.log('[migrations] All migrations applied successfully.');
  } finally {
    client.release();
  }
};
