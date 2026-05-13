# Development Guide

## Prerequisites

- Node.js 20+
- Docker and Docker Compose (for the database)
- Git

---

## Local Development Setup

Run only PostgreSQL in Docker; run the API and frontends directly for hot-reloading.

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
```
DATABASE_URL=postgresql://waste_user:changeme@localhost:5432/waste_kpi
JWT_SECRET=dev_secret_at_least_32_chars_long
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
NODE_ENV=development
WAL_DIR=./data
```

```bash
npm run dev   # nodemon, auto-reloads on change
```

Migrations run automatically on startup. WAL log writes to `./data/wal.log` locally.

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
│   │   ├── migrate.js              # Migration runner (runs on every API startup)
│   │   ├── 001_add_packout_table.sql
│   │   ├── 002_v1_1_new_columns.sql
│   │   ├── 003_add_driver_id.sql
│   │   ├── 004_add_exclude_from_next_up.sql
│   │   └── 005_add_additional_routes.sql
│   ├── middleware/auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── employees.js       — driver_id filtered by role; exclude_from_next_up all users
│   │   ├── routes.js          — ?all=true for management page
│   │   ├── routeLogs.js       — WAL-protected POST/PUT; additional_routes[] in transactions
│   │   ├── packOuts.js        — location field
│   │   ├── clockLogs.js
│   │   ├── dashboard.js       — excluded route filter; exclude_from_next_up per row
│   │   ├── import.js
│   │   ├── backup.js          — includes additional_route_logs
│   │   ├── users.js
│   │   └── reports.js         — friday-hours, route-duration, custom
│   ├── wal.js                 — Write-Ahead Log (append, commit, recover, compact)
│   └── index.js               — runMigrations → walRecover → seedAdmin → listen
│
├── admin-ui/src/
│   ├── components/
│   │   ├── Layout.jsx          — sidebar nav including Reports
│   │   ├── Modal.jsx, Toast.jsx, DateNav.jsx
│   │   ├── TimePicker.jsx      — custom hour/minute/AMPM dropdown
│   │   ├── ExportModal.jsx, ImportModal.jsx
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── RouteLogs.jsx       — AdditionalRoutesCard; RouteCell with amber badges
│   │   ├── RoutesMgmt.jsx      — excluded toggle
│   │   ├── EmployeesMgmt.jsx   — driver_id (admin) + exclude_from_next_up
│   │   ├── Reports.jsx         — Friday Hours + Route Duration + Report Builder tabs
│   │   └── Admin.jsx
│   ├── api.js                  — reports.routeDuration(), reports.routeDurationCsv()
│   └── App.jsx
│
├── display-ui/src/App.jsx       — computeNextUp filters exclude_from_next_up
├── slim-display-ui/src/App.jsx  — same filter
│
├── nginx/
│   ├── nginx.conf.template      — REAL_HOST_VALUE placeholder; map in http block
│   └── entrypoint.sh            — sed replace + nginx -t
│
├── docker-compose.yml           — wal_data named volume added
└── .env.example
```

---

## Key Design Decisions

### Write-Ahead Log
`wal.js` uses `appendFileSync` (synchronous, atomic for single-line writes) before the DB write. The NDJSON format means the file is appendable without reads. On startup, `walRecover` replays `pending` entries older than 60 seconds — the age threshold prevents replaying entries from a previous instance that was still mid-flight. Replay is idempotent via `ON CONFLICT (employee_id, log_date) DO UPDATE`.

### Additional Routes
Stored in `additional_route_logs` rather than breaking the `UNIQUE(employee_id, log_date)` constraint on `route_logs`. This keeps the primary record as the owner of punch in/out and day-level KPIs while allowing unlimited secondary route assignments per day. The `upsertAdditionalRoutes` helper runs in the same transaction as the primary upsert and pack-outs, so all three are atomic.

### Route Duration Report
Uses a `WITH all_runs AS (primary UNION ALL additional)` CTE to count both primary and additional route assignments in one query. `JSON_AGG` produces the per-run detail array server-side, avoiding N+1 queries. The bar chart in the UI is calculated client-side as `(avg_mins / maxAvg) * 100`.

### Excluded Routes
Enforced in the dashboard API using a correlated `NOT EXISTS` subquery. Data entry dropdowns use `api.routes.list()` (active only, excluded not filtered) — exclusion is purely analytical.

### Driver ID / exclude_from_next_up Access Control
`employees.js` builds its `SELECT` column list and `SET` clause dynamically based on `req.user.role`. `driver_id` is admin-only. `exclude_from_next_up` is available to all authenticated users (operational, not sensitive).

### Nginx REAL_HOST
Uses `sed` with a unique literal placeholder `REAL_HOST_VALUE` instead of `envsubst` to avoid clobbering nginx's own `$variables`. The `map` directive derives `$real_scheme` from `X-Forwarded-Proto` and must live in the `http` block — not `server`.

---

## Adding a New Migration

1. Create `api/src/db/006_your_description.sql`
2. Write idempotent SQL (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, etc.)
3. Deploy — the runner applies it automatically on next startup

## Adding a New API Route

1. Create `api/src/routes/yourroute.js` exporting `(pool) => router`
2. Register in `api/src/index.js`
3. Add helpers to `admin-ui/src/api.js`
