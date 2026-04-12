const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seedAdmin() {
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) return;
  try {
    const existing = await pool.query('SELECT id FROM users WHERE username=$1', [ADMIN_USERNAME]);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [ADMIN_USERNAME, hash, 'admin']);
      console.log(`Admin user '${ADMIN_USERNAME}' created.`);
    }
  } catch (e) {
    console.error('Seed admin error:', e.message);
  }
}

app.use('/api/auth',       require('./routes/auth')(pool));
app.use('/api/employees',  require('./middleware/auth'), require('./routes/employees')(pool));
app.use('/api/routes',     require('./middleware/auth'), require('./routes/routes')(pool));
app.use('/api/route-logs', require('./middleware/auth'), require('./routes/routeLogs')(pool));
app.use('/api/pack-outs',  require('./middleware/auth'), require('./routes/packOuts')(pool));
app.use('/api/clock-logs', require('./middleware/auth'), require('./routes/clockLogs')(pool));
app.use('/api/dashboard',  require('./middleware/auth'), require('./routes/dashboard')(pool));
app.use('/api/import',     require('./middleware/auth'), require('./routes/import')(pool));
app.use('/api/backup',     require('./middleware/auth'), require('./routes/backup')(pool));
app.use('/api/users',      require('./middleware/auth'), require('./routes/users')(pool));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.API_PORT || 4000;
app.listen(PORT, async () => {
  console.log(`API listening on port ${PORT}`);
  setTimeout(seedAdmin, 2000);
});
