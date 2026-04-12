# Development Guide

## Prerequisites

- Node.js 20+
- Docker and Docker Compose (for the database)
- Git

---

## Local Development Setup

The easiest approach is to run only PostgreSQL in Docker while running the API and frontend apps directly with Node.js for hot-reloading.

### 1. Start the database only

```bash
docker compose up -d postgres
```

### 2. API

```bash
cd api
npm install
```

Create a `.env` in the `api/` folder (or export these):
```bash
DATABASE_URL=postgresql://waste_user:changeme_db_password@localhost:5432/waste_kpi
JWT_SECRET=dev_secret_at_least_32_chars_long_here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
NODE_ENV=development
```

```bash
npm run dev     # starts with nodemon, auto-reloads on file changes
```

API runs at `http://localhost:4000`.

### 3. Admin UI

```bash
cd admin-ui
npm install
npm run dev     # Vite dev server with HMR
```

Admin UI runs at `http://localhost:5173`. Vite proxies `/api` requests to `localhost:4000` — check `vite.config.js` for the proxy config.

### 4. Display UI

```bash
cd display-ui
npm install
npm run dev
```

Display UI runs at `http://localhost:5174`.

---

## Project Structure

```
waste-kpi/
├── api/src/
│   ├── db/
│   │   ├── schema.sql              # DDL + seed data, auto-run on first postgres start
│   │   └── migration_packout.sql   # One-time migration for pack-out table
│   ├── middleware/
│   │   └── auth.js                 # JWT verification; whitelists display dashboard
│   ├── routes/
│   │   ├── auth.js                 # POST /api/auth/login
│   │   ├── employees.js            # CRUD /api/employees
│   │   ├── routes.js               # CRUD /api/routes
│   │   ├── routeLogs.js            # CRUD /api/route-logs (with pack_outs join)
│   │   ├── packOuts.js             # CRUD /api/pack-outs
│   │   ├── clockLogs.js            # CRUD /api/clock-logs
│   │   ├── dashboard.js            # GET /api/dashboard/summary
│   │   ├── import.js               # POST /api/import (bulk CSV row insert)
│   │   ├── backup.js               # GET /backup, POST /backup/restore, POST /backup/erase
│   │   └── users.js                # CRUD /api/users (admin only)
│   └── index.js                    # Express app setup, route registration
│
├── admin-ui/src/
│   ├── components/
│   │   ├── Layout.jsx              # Sidebar nav + main content wrapper
│   │   ├── Modal.jsx               # Reusable modal dialog
│   │   ├── Toast.jsx               # Notification toasts (success/error)
│   │   ├── DateNav.jsx             # ← date → navigation widget
│   │   ├── TimePicker.jsx          # Custom hour/minute/AM-PM dropdown picker
│   │   ├── ExportModal.jsx         # CSV export with dynamic pack-out columns
│   │   └── ImportModal.jsx         # CSV import with preview
│   ├── pages/
│   │   ├── Login.jsx               # Login form
│   │   ├── Dashboard.jsx           # Summary stats + charts
│   │   ├── RouteLogs.jsx           # Main data entry page (Form + Inline modes)
│   │   ├── RoutesMgmt.jsx          # Routes CRUD
│   │   ├── EmployeesMgmt.jsx       # Employees CRUD
│   │   └── Admin.jsx               # Combined admin: Backup/Restore + Users tabs
│   ├── api.js                      # Fetch wrapper + all API calls
│   └── App.jsx                     # React Router setup
│
├── display-ui/src/
│   └── App.jsx                     # Single-file display board (all components inline)
│
├── nginx/
│   ├── nginx.conf.template         # envsubst template — REAL_HOST injected at startup
│   └── entrypoint.sh               # Runs envsubst, then nginx
│
├── docs/                           # Documentation
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Key Design Decisions

### Pack-outs in route log transactions

Pack-outs are created/updated/deleted as part of the parent route log save. The API accepts a `pack_outs: []` array on `POST /route-logs` and `PUT /route-logs/:id` and handles them in a single transaction — it deletes all existing pack-outs for the log then inserts the new set. This simplifies client logic (no separate pack-out API calls needed).

### Display board auth bypass

`GET /api/dashboard/summary` is exempted from JWT auth in `middleware/auth.js`. This lets the display board load without credentials while keeping all other endpoints protected.

### `REAL_HOST` envsubst pattern

The nginx config is a `.template` file processed by `envsubst` at container startup (see `nginx/entrypoint.sh`). This allows the `REAL_HOST` value to be injected without rebuilding the nginx image.

### JSON backup strategy

Backup/restore is implemented as application-level JSON (querying tables via the API and re-inserting) rather than using `pg_dump`. This avoids needing `pg_dump` installed in the API container and makes backups portable across PostgreSQL versions.

---

## Building for Production

```bash
# Build all images
docker compose build --no-cache

# Start
docker compose up -d

# Check logs
docker compose logs -f
```

---

## Adding a New API Route

1. Create `api/src/routes/yourroute.js` — export a function `(pool) => router`
2. Register in `api/src/index.js`:
   ```js
   app.use('/api/yourroute', require('./middleware/auth'), require('./routes/yourroute')(pool));
   ```
3. Add to `admin-ui/src/api.js` under the appropriate key

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_DB` | Yes | PostgreSQL database name |
| `POSTGRES_USER` | Yes | PostgreSQL username |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `DATABASE_URL` | Yes (API) | Full postgres connection string |
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `ADMIN_USERNAME` | No | Seeds initial admin on first run |
| `ADMIN_PASSWORD` | No | Seeds initial admin on first run |
| `NODE_ENV` | No | `production` or `development` |
| `REAL_HOST` | Yes | External hostname for nginx redirects |

---

## Running Tests

No automated tests are included in v1.0. Suggested additions for future versions:

- API integration tests with Jest + supertest
- Component tests with React Testing Library
- E2E tests with Playwright
