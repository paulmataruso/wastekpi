# Architecture

## Overview

Waste KPI Tracker is a fully containerized, self-hosted application composed of five Docker services communicating over a private bridge network. All external traffic enters through a single Nginx reverse proxy on port 3300.

```
External Request (port 3300)
        │
        ▼
   ┌─────────┐
   │  Nginx  │  ← reverse proxy + gzip + asset cache
   └────┬────┘
        │
        ├──/api/*──────────────► api:4000   (Node.js/Express)
        │                              │
        ├──/admin/*────────────► admin-ui:3000  (React/Vite → Nginx)
        │                         
        └──/display/*──────────► display-ui:3001 (React/Vite → Nginx)
                                       
   api:4000 ──────────────────► postgres:5432 (PostgreSQL 16)
```

## Services

| Service | Container | Internal Port | Image |
|---|---|---|---|
| Reverse proxy | `waste-kpi-nginx` | 3300 (external) | nginx:alpine |
| Admin UI | `waste-kpi-admin-ui` | 3000 | node:20-alpine → nginx:alpine |
| Display UI | `waste-kpi-display-ui` | 3001 | node:20-alpine → nginx:alpine |
| REST API | `waste-kpi-api` | 4000 | node:20-alpine |
| Database | `waste-kpi-postgres` | 5432 | postgres:16-alpine |

All services share the `waste-kpi-net` bridge network (`172.30.0.0/24`). No database port is exposed to the host.

## Network Flow

```
Browser ──► nginx:3300
              ├── /api/*     proxy_pass → api:4000
              ├── /admin/*   proxy_pass → admin-ui:3000
              └── /display/* proxy_pass → display-ui:3001

api:4000 ──► postgres:5432 (internal only)
```

The `REAL_HOST` environment variable is injected into the nginx config at startup via `envsubst`. This allows the proxy to issue correct redirects when sitting behind an upstream reverse proxy (e.g. Nginx Proxy Manager or Traefik).

## Authentication

- JWT tokens are issued on login (`POST /api/auth/login`)
- Tokens are signed with `JWT_SECRET`, expire after 24 hours
- Every API request (except the display dashboard summary) requires `Authorization: Bearer <token>`
- The middleware decodes the token and attaches `req.user = { id, username, role }`
- **Admin role** — full access to all endpoints including user management, backup/restore, erase
- **User role** — can read/write all operational data (route logs, employees, routes) but cannot access admin-only endpoints

## Database Schema

```
users
  id, username, password_hash, role, created_at

employees
  id, name, employee_number, position, active, created_at

routes
  id, route_name, description, area, active, created_at

route_logs                          ← one row per driver per day
  id, employee_id, log_date
  route_number, punch_in, first_stop_time
  route_complete_time, punch_out, notes
  created_at, updated_at
  UNIQUE(employee_id, log_date)

pack_out_logs                       ← multiple per route_log
  id, route_log_id, seq
  pack_out_time, back_on_route_time
  created_at

clock_logs                          ← non-driving staff only
  id, employee_id, log_date
  clock_in, clock_out, notes
  created_at, updated_at
```

## Build Process

The React apps are compiled at image build time using a multi-stage Docker build:

1. **Stage 1** — `node:20-alpine`: runs `npm install` and `npm run build`, produces `/app/dist`
2. **Stage 2** — `nginx:alpine`: copies `/app/dist` into the nginx html root, serves static files

This means the built images contain no Node.js runtime — only Nginx serving pre-compiled static assets.

## Data Persistence

PostgreSQL data is stored in the `postgres_data` named Docker volume. This volume persists across container restarts and `docker compose down` calls. It is only destroyed with:

```bash
docker compose down -v   # ← destroys the volume
```

Use the built-in **Backup & Restore** feature (Admin Settings → 💾 Backup & Restore) to export data before any destructive operations.
