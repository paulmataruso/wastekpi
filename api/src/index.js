const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const runMigrations = require('./db/migrate');
const { walRecover } = require('./wal');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[pool] Idle client error — connection discarded:', err.message);
});

async function seedAdmin() {
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) return;
  try {
    const existing = await pool.query('SELECT id FROM users WHERE username=$1', [ADMIN_USERNAME]);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [ADMIN_USERNAME, hash, 'admin']);
      console.log(`[seed] Admin user '${ADMIN_USERNAME}' created.`);
    }
  } catch (e) {
    console.error('[seed] Admin seed error:', e.message);
  }
}

app.use('/api/auth',               require('./routes/auth')(pool));
app.use('/api/employees',          require('./middleware/auth'), require('./routes/employees')(pool));
app.use('/api/routes',             require('./middleware/auth'), require('./routes/routes')(pool));
app.use('/api/route-logs',         require('./middleware/auth'), require('./routes/routeLogs')(pool));
app.use('/api/pack-outs',          require('./middleware/auth'), require('./routes/packOuts')(pool));
app.use('/api/pack-out-locations', require('./middleware/auth'), require('./routes/packOutLocations')(pool));
app.use('/api/clock-logs',         require('./middleware/auth'), require('./routes/clockLogs')(pool));
app.use('/api/dashboard',          require('./middleware/auth'), require('./routes/dashboard')(pool));
app.use('/api/import',             require('./middleware/auth'), require('./routes/import')(pool));
app.use('/api/backup',             require('./middleware/auth'), require('./routes/backup')(pool));
app.use('/api/users',              require('./middleware/auth'), require('./routes/users')(pool));
app.use('/api/reports',            require('./middleware/auth'), require('./routes/reports')(pool));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.API_PORT || 4000;

async function start() {
  try {
    await runMigrations(pool);
  } catch (e) {
    console.error('[migrations] Fatal error — server will not start.', e.message);
    process.exit(1);
  }

  try {
    await walRecover(pool);
  } catch (e) {
    console.error('[wal] Recovery encountered errors (see above). Continuing startup.');
  }

  await seedAdmin();

  app.listen(PORT, () => {
    console.log(`[server] API listening on port ${PORT}`);
  });
}

start();
