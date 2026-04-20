/**
 * migrate.js — automatic migration runner
 *
 * Creates a `schema_migrations` table on first run, then checks which
 * migration files in this directory haven't been applied yet and runs them
 * in filename order. Each migration runs in its own connection and transaction
 * so a failure rolls back cleanly without affecting other migrations.
 *
 * Migration files must match the pattern:  NNN_description.sql
 * To add a migration: drop a new .sql file in this directory with the next
 * sequential number prefix. It will run automatically on next startup.
 */

const fs   = require('fs');
const path = require('path');

const MIGRATIONS_DIR = __dirname;

module.exports = async function runMigrations(pool) {

  // ── 1. Ensure tracking table exists (no open transaction) ────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         SERIAL PRIMARY KEY,
      filename   VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── 2. Find all numbered .sql files, sorted by filename ──────────────────
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d+.*\.sql$/.test(f))
    .sort();

  if (files.length === 0) {
    console.log('[migrations] No migration files found.');
    return;
  }

  // ── 3. Determine which are pending ───────────────────────────────────────
  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  const appliedSet = new Set(rows.map(r => r.filename));
  const pending = files.filter(f => !appliedSet.has(f));

  if (pending.length === 0) {
    console.log('[migrations] All migrations already applied.');
    return;
  }

  console.log(`[migrations] ${pending.length} pending migration(s) to apply.`);

  // ── 4. Run each pending migration in its own connection + transaction ─────
  for (const filename of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
    console.log(`[migrations] Applying: ${filename}`);

    const client = await pool.connect();
    let success = false;
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
      await client.query('COMMIT');
      success = true;
      console.log(`[migrations] Applied:  ${filename} ✓`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`[migrations] FAILED:   ${filename} — ${err.message}`);
      client.release();
      throw err; // server will not start — error visible in docker logs
    }
    if (success) client.release();
  }

  console.log('[migrations] All migrations applied successfully.');
};
