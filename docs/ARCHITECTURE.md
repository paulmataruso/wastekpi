# Architecture

## Overview

Waste KPI Tracker is a fully containerized, self-hosted application composed of six Docker services communicating over a private bridge network. All external traffic enters through a single Nginx reverse proxy on port 3300.

```
External Request (port 3300)
        │
        ▼
   ┌─────────┐
   │  Nginx  │  ← reverse proxy + gzip + sed-based REAL_HOST injection
   └────┬────┘
        │
        ├──/api/*──────────────► api:4000          (Node.js/Express)
        │                              │
        ├──/admin/*────────────► admin-ui:3000      (React/Vite → Nginx)
        ├──/display/*──────────► display-ui:3001    (React/Vite → Nginx)
        └──/slimdisplay/*──────► slim-display-ui:3002 (React/Vite → Nginx)

   api:4000 ──────────────────► postgres:5432 (PostgreSQL 16)
```

## Services

| Service | Container | Internal Port | Image |
|---|---|---|---|
| Reverse proxy | `waste-kpi-nginx` | 3300 (external) | nginx:alpine |
| Admin UI | `waste-kpi-admin-ui` | 3000 | node:20-alpine → nginx:alpine |
| Display UI | `waste-kpi-display-ui` | 3001 | node:20-alpine → nginx:alpine |
| Slim Display UI | `waste-kpi-slim-display-ui` | 3002 | node:20-alpine → nginx:alpine |
| REST API | `waste-kpi-api` | 4000 | node:20-alpine |
| Database | `waste-kpi-postgres` | 5432 | postgres:16-alpine |

All services share the `waste-kpi-net` bridge network (`172.30.0.0/24`). No database port is exposed to the host.

## Network Flow

```
Browser ──► nginx:3300
              ├── /api/*          proxy_pass → api:4000
              ├── /admin/*        proxy_pass → admin-ui:3000
              ├── /display/*      proxy_pass → display-ui:3001
              └── /slimdisplay/*  proxy_pass → slim-display-ui:3002

api:4000 ──► postgres:5432 (internal only)
```

## Nginx REAL_HOST Injection

The nginx config template uses a unique literal placeholder `REAL_HOST_VALUE` which is replaced at container startup by `nginx/entrypoint.sh` using `sed`:

```sh
sed "s|REAL_HOST_VALUE|${REAL_HOST}|g" \
    /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
nginx -t && nginx -g 'daemon off;'
```

`sed` is used instead of `envsubst` to avoid `envsubst` accidentally replacing nginx's own `$variables` (like `$host`, `$scheme`, `$remote_addr`). The `nginx -t` config test runs before startup so errors surface immediately in `docker logs`.

Redirects use `$real_scheme` (derived from the `X-Forwarded-Proto` header) so they work correctly when the app sits behind an HTTPS-terminating upstream proxy.

## Authentication

- JWT tokens are issued on login (`POST /api/auth/login`)
- Tokens are signed with `JWT_SECRET`, expire after 24 hours
- Every API request (except the display dashboard summary) requires `Authorization: Bearer <token>`
- The middleware decodes the token and attaches `req.user = { id, username, role }`
- **Admin role** — full access including user management, backup/restore/erase, driver_id field, reports
- **User role** — can read/write all operational data (route logs, employees, routes) but cannot access admin-only endpoints

## Auto-Migration System

The API runs `api/src/db/migrate.js` before starting the HTTP server. The runner:

1. Creates a `schema_migrations` table if it doesn't exist
2. Reads all `NNN_*.sql` files from `api/src/db/`, sorted by filename
3. Skips files already recorded in `schema_migrations`
4. Runs each pending file in its own connection + `BEGIN/COMMIT` transaction
5. If any migration fails, rolls back and exits with code 1 (server does not start)

To add a future migration: create `api/src/db/004_description.sql`. It runs automatically on next startup.

## Database Schema

```
users
  id, username, password_hash, role, created_at

employees
  id, name, employee_number, driver_id, position, active, created_at
  driver_id — internal identifier, admin-only via API

routes
  id, route_name, description, area, active, excluded, created_at
  excluded — when TRUE, route is filtered from all analytics/display/reports

route_logs                          ← one row per driver per day
  id, employee_id, log_date
  route_number, punch_in, first_stop_time
  route_complete_time, to_yard_time, punch_out, notes
  created_at, updated_at
  UNIQUE(employee_id, log_date)

pack_out_logs                       ← multiple per route_log
  id, route_log_id, seq
  pack_out_time, back_on_route_time
  location                          ← Alva | Naughton | Casella
  created_at

clock_logs                          ← non-driving staff only
  id, employee_id, log_date
  clock_in, clock_out, notes
  created_at, updated_at

schema_migrations                   ← migration tracking
  id, filename, applied_at
```

## Build Process

The React apps are compiled at image build time using a multi-stage Docker build:

1. **Stage 1** — `node:20-alpine`: runs `npm install` and `npm run build`, produces `/app/dist`
2. **Stage 2** — `nginx:alpine`: copies `/app/dist` into the nginx html root, serves static files

Built images contain no Node.js runtime — only Nginx serving pre-compiled static assets.

## Data Persistence

PostgreSQL data is stored in the `postgres_data` named Docker volume. It persists across container restarts and `docker compose down`. Only destroyed with:

```bash
docker compose down -v
```

Use **Admin Settings → 💾 Backup & Restore → Download Backup** before any destructive operations.
