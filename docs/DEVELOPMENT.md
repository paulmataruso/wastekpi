# Development Guide

## Prerequisites

- Node.js 20+
- Docker and Docker Compose (for the database)
- Git

---

## Local Development Setup

Run only PostgreSQL in Docker; run the API and frontend apps directly for hot-reloading.

### 1. Start the database

```bash
docker compose up -d postgres
```

### 2. API

```bash
cd api
npm install
```

Create `api/.env`:
```bash
DATABASE_URL=postgresql://waste_user:changeme_db_password@localhost:5432/waste_kpi
JWT_SECRET=dev_secret_at_least_32_chars_long_here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
NODE_ENV=development
```

```bash
npm run dev   # nodemon, auto-reloads
```

Migrations run on startup — `schema_migrations` table is created automatically.

### 3. Admin UI

```bash
cd admin-ui && npm install && npm run dev
```
Runs at `http://localhost:5173`. Vite proxies `/api` to `localhost:4000`.

### 4. Display UIs

```bash
cd display-ui && npm install && npm run dev       # http://localhost:5174
cd slim-display-ui && npm install && npm run dev  # http://localhost:5175
```

---

## Project Structure

```
waste-kpi/
├── api/src/
│   ├── db/
│   │   ├── schema.sql              # DDL + seed data (auto-run on first postgres start)
│   │   ├── migrate.js              # Migration runner — runs on every API startup
│   │   ├── 001_add_packout_table.sql
│   │   ├── 002_v1_1_new_columns.sql
│   │   └── 003_add_driver_id.sql
│   ├── middleware/
│   │   └── auth.js                 # JWT verification; whitelists display dashboard
│   ├── routes/
│   │   ├── auth.js                 # POST /api/auth/login
│   │   ├── employees.js            # CRUD — driver_id filtered by role
│   │   ├── routes.js               # CRUD — ?all=true for management page
│   │   ├── routeLogs.js            # CRUD with pack_outs transaction + to_yard_time
│   │   ├── packOuts.js             # CRUD with location field
│   │   ├── clockLogs.js            # CRUD /api/clock-logs
│   │   ├── dashboard.js            # GET /api/dashboard/summary (excluded route filter)
│   │   ├── import.js               # POST /api/import (to_yard + location columns)
│   │   ├── backup.js               # GET/POST backup, restore, erase
│   │   ├── users.js                # CRUD /api/users (admin only)
│   │   └── reports.js              # GET friday-hours, POST custom
│   └── index.js                    # runMigrations → seedAdmin → listen
│
├── admin-ui/src/
│   ├── components/
│   │   ├── Layout.jsx              # Sidebar: Dashboard, Route Logs, Routes, Employees, Reports, Admin Settings
│   │   ├── Modal.jsx
│   │   ├── Toast.jsx
│   │   ├── DateNav.jsx
│   │   ├── TimePicker.jsx          # Custom hour/minute/AMPM dropdown picker
│   │   ├── ExportModal.jsx
│   │   └── ImportModal.jsx
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── RouteLogs.jsx           # Form + Inline modes; to_yard_time; pack-out location
│   │   ├── RoutesMgmt.jsx          # Excluded toggle (pill + modal checkbox)
│   │   ├── EmployeesMgmt.jsx       # Driver ID field (admin-only)
│   │   ├── Reports.jsx             # Friday Hours tab + Report Builder tab
│   │   └── Admin.jsx               # Backup/Restore/Erase + Users tabs
│   ├── api.js                      # Includes routes.listAll(), reports.*
│   └── App.jsx
│
├── display-ui/src/App.jsx          # Full display board
├── slim-display-ui/src/App.jsx     # Slim board — NextUpCard + DriverTable only
│
├── nginx/
│   ├── nginx.conf.template         # sed placeholder REAL_HOST_VALUE; $real_scheme for redirects
│   └── entrypoint.sh               # sed replace + nginx -t + nginx -g 'daemon off;'
│
├── docs/
├── docker-compose.yml              # 6 services: nginx, api, admin-ui, display-ui, slim-display-ui, postgres
└── .env.example
```

---

## Key Design Decisions

### Migration runner
`migrate.js` uses a fresh pg client per migration to avoid transaction state leaking between files. The server exits (code 1) if any migration fails — a broken schema never results in a silently broken running server.

### Excluded routes
The `excluded` flag on routes is enforced in the dashboard API using a correlated `NOT EXISTS` subquery. This means: data entry is never affected, the daily log still shows all drivers, but all averages/stats/trends skip excluded route entries. The dashboard returns `route_excluded` per row so the display board could render excluded rows differently if needed.

### Driver ID access control
The `employees.js` route builds its `SELECT` column list and `SET` clause dynamically based on `req.user.role`. Non-admins cannot read or write `driver_id` even if they craft a direct API request.

### Nginx REAL_HOST injection
Uses `sed` with a unique literal placeholder instead of `envsubst` because `envsubst` without a strict variable list replaces ALL `$VAR` patterns, destroying nginx's own `$host`, `$scheme`, `$remote_addr` etc. The `nginx -t` test before start catches any config errors immediately.

### Reports API
Friday Hours: queries Mon–Thu in one LEFT JOIN sweep, pivots in Node.js rather than SQL for simplicity. Custom report: builds a parameterized WHERE clause dynamically; column selection happens in Node.js post-query to keep the SQL simple. Both support `?format=csv` / `"format": "csv"` for direct file download.

---

## Adding a New Migration

1. Create `api/src/db/004_your_description.sql`
2. Write idempotent SQL (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, etc.)
3. Deploy — the runner applies it automatically on next startup

## Adding a New API Route

1. Create `api/src/routes/yourroute.js` exporting `(pool) => router`
2. Register in `api/src/index.js`: `app.use('/api/yourroute', require('./middleware/auth'), require('./routes/yourroute')(pool));`
3. Add to `admin-ui/src/api.js`
