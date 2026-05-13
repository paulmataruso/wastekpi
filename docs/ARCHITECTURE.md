# Architecture

## Overview

Waste KPI Tracker is a fully containerized, self-hosted application composed of six Docker services communicating over a private bridge network. All external traffic enters through a single Nginx reverse proxy on port 3300.

```
External Request (port 3300)
        │
        ▼
   ┌─────────┐
   │  Nginx  │  ← reverse proxy, gzip, sed-based REAL_HOST injection
   └────┬────┘
        │
        ├──/api/*──────────────► api:4000          (Node.js/Express)
        │                              │
        ├──/admin/*────────────► admin-ui:3000      (React/Vite → Nginx)
        ├──/display/*──────────► display-ui:3001    (React/Vite → Nginx)
        └──/slimdisplay/*──────► slim-display-ui:3002 (React/Vite → Nginx)

   api:4000 ──────────────────► postgres:5432 (PostgreSQL 16)
   api:4000 ──────────────────► /app/data/wal.log (wal_data volume)
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

## Volumes

| Volume | Contents |
|---|---|
| `postgres_data` | All PostgreSQL data files |
| `wal_data` | Write-Ahead Log at `/app/data/wal.log` |

Both named volumes persist across `docker compose down` and container rebuilds. Only destroyed with `docker compose down -v`.

## Database Schema

```
users
  id, username, password_hash, role, created_at

employees
  id, name, employee_number, driver_id, position, active,
  exclude_from_next_up, created_at
  driver_id — internal identifier, admin-only via API
  exclude_from_next_up — removes driver from Next Up recommendation

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

additional_route_logs               ← multiple per route_log (extra routes)
  id, route_log_id, seq
  route_number, first_stop_time, route_complete_time, notes
  created_at

clock_logs                          ← non-driving staff only
  id, employee_id, log_date
  clock_in, clock_out, notes
  created_at, updated_at

schema_migrations                   ← migration tracking
  id, filename, applied_at
```

## Auto-Migration System

`api/src/db/migrate.js` runs before the HTTP server starts:

1. Creates `schema_migrations` table if absent
2. Reads all `NNN_*.sql` files from `api/src/db/`, sorted by filename
3. Skips files already recorded in `schema_migrations`
4. Runs each pending file in its own connection + `BEGIN/COMMIT` transaction
5. If a migration fails: rolls back, logs the error, and exits with code 1

To add a new migration: create `api/src/db/006_description.sql`. It runs automatically on next startup.

## Write-Ahead Log (WAL)

`api/src/wal.js` provides crash-safe writes for route log saves:

1. `walAppend(operation, payload)` — synchronous `appendFileSync` before the DB write. Entry is `pending`.
2. DB write executes in a transaction.
3. `walCommit(id)` — marks entry `committed` after the transaction succeeds.
4. On crash: the entry stays `pending`. At next startup, `walRecover(pool)` replays all `pending` entries older than 60 seconds.
5. Replay is idempotent — `ON CONFLICT (employee_id, log_date) DO UPDATE` makes double-applying safe.
6. `walCompact()` prunes old committed/replayed entries (>7 days) at startup.

The WAL log lives in the `wal_data` named Docker volume so it survives container restarts and rebuilds.

## API Startup Sequence

```
runMigrations(pool)   →  apply pending schema migrations
walRecover(pool)      →  replay any unacknowledged writes from last crash
seedAdmin()           →  create ADMIN_USERNAME if it doesn't exist
app.listen(PORT)      →  begin accepting requests
```

## Nginx REAL_HOST Injection

`nginx/entrypoint.sh` uses `sed` to inject the external hostname at container startup:

```sh
sed "s|REAL_HOST_VALUE|${REAL_HOST}|g" \
    /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
nginx -t && nginx -g 'daemon off;'
```

`sed` is used instead of `envsubst` because `envsubst` would replace nginx's own `$variables` (`$host`, `$scheme`, `$remote_addr`, etc.). The `nginx -t` test surfaces config errors immediately in `docker logs`.

The `map` directive that derives `$real_scheme` from `X-Forwarded-Proto` lives in the `http` block — nginx does not allow `map` inside a `server` block.

## Build Process

Multi-stage Docker builds for all three React apps:

1. **Stage 1** — `node:20-alpine`: `npm install` + `npm run build` → `/app/dist`
2. **Stage 2** — `nginx:alpine`: copies `/app/dist` to nginx html root

Built images contain no Node.js runtime. Only nginx serves the pre-compiled static assets.
