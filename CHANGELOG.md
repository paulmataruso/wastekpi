# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.2.0] — 2026-04-20

### Added

#### Multiple Route Assignments per Driver
- New `additional_route_logs` table — links to a `route_log` and stores one row per extra route a driver ran that day, each with its own `route_number`, `first_stop_time`, `route_complete_time`, and `notes`
- Migration `005_add_additional_routes.sql` — picked up automatically on next startup
- `routeLogs.js` API — all GET/POST/PUT responses now include `additional_routes[]`; upsert transaction handles them atomically alongside pack-outs
- WAL crash recovery updated to replay `additional_route_logs` as part of `route_log.upsert`
- `RouteLogs.jsx` — new **Additional Routes** card in the form modal (amber-accented, with route select, 1st stop, route complete, notes per row); `RouteCell` now shows amber `+Route N` badges; "Extras" column shows both dump count and additional route count
- Backup/Restore updated to include `additional_route_logs` in both download and restore; erase also resets its sequence

#### Route Duration Report
- New **🛣 Route Duration** tab in Reports (between Friday Hours and Report Builder)
- Calculates `first_stop_time → route_complete_time` per route across a date range
- Combines primary `route_logs` AND `additional_route_logs` in a single `UNION ALL` query so drivers who helped with extra routes are counted correctly
- Results table: Route | Runs | Avg Duration | Visual bar chart | Fastest | Slowest
- Click any row to expand a per-run detail sub-table showing date, driver, times, and duration
- Date range presets (Today / This Week / Last Week / Last 30 / Last 90 / Custom)
- Optional route filter (multi-select)
- CSV export flattens to one row per run

#### Write-Ahead Log (Crash Safety)
- New `api/src/wal.js` — append-only intent log stored in Docker named volume `wal_data` at `/app/data/wal.log`
- `walAppend()` writes a `pending` entry synchronously before the DB write starts
- `walCommit()` marks the entry `committed` after the transaction succeeds
- `walRecover()` runs at every startup, replays any `pending` entries older than 60 seconds that were never committed (i.e. lost to a crash), marks them `replayed`
- `walCompact()` prunes committed/replayed entries older than 7 days to keep the file small
- `routeLogs.js` POST and PUT both wrap DB writes with WAL; PUT does a quick lookup first to get `employee_id`/`log_date` for idempotent `ON CONFLICT` replay
- `docker-compose.yml` — adds `wal_data` named volume mounted to API container at `/app/data`
- Startup sequence: `runMigrations → walRecover → seedAdmin → listen`

#### Pool Crash Fix
- `api/src/index.js` — `pool.on('error', ...)` handler prevents unhandled error events (pg error `57P01` — "terminating connection due to administrator command") from crashing the Node.js process
- Pool configured with `keepAlive: true`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`

### Fixed
- Backup restore transaction now includes all columns for all tables including newer fields (`excluded`, `to_yard_time`, `location`, `driver_id`, `exclude_from_next_up`) — previously a column mismatch caused the transaction to silently roll back and restore nothing
- Dashboard API now includes `e.exclude_from_next_up` in the routeList SELECT — previously the field was saved to the DB but never returned to display boards, so the Next Up filter never worked

---

## [1.1.1] — 2026-04-20

### Added
- Migration `004_add_exclude_from_next_up.sql` — `exclude_from_next_up BOOLEAN DEFAULT FALSE` on employees
- `EmployeesMgmt.jsx` — "Exclude from Route Assignment Recommendation" checkbox in modal, Included/Excluded pill column in table
- Both display boards filter `exclude_from_next_up = true` drivers out of `computeNextUp()`

### Fixed
- Dashboard API: `e.exclude_from_next_up` was missing from the routeList SELECT — the flag was saved but never reached the display boards
- Nginx `map` directive moved from `server` block to `http` block (nginx error `"map" directive is not allowed here`)
- Nginx `set $upstream` dynamic variables removed; direct `proxy_pass` with static hostnames used instead

---

## [1.1.0] — 2026-04-19

### Added

#### Data Model
- `to_yard_time` TIME on route_logs
- `location` VARCHAR(20) on pack_out_logs — Alva | Naughton | Casella
- `excluded` BOOLEAN on routes
- `driver_id` VARCHAR(50) on employees — admin-only

#### Auto-Migration System
- `api/src/db/migrate.js` — runs on every API startup; applies pending `NNN_*.sql` files; server exits if a migration fails
- `001_add_packout_table.sql`, `002_v1_1_new_columns.sql`, `003_add_driver_id.sql`

#### Slim Display Board (`/slimdisplay/`)
- New `slim-display-ui` container, port 3002, React/Vite
- Next Up card + Driver KPI table only

#### Reports Section
- **📅 Friday Hours** — Mon–Thu accumulated hours per driver, sorted most first
- **🔧 Report Builder** — flexible query with column picker, date presets, driver/route/status filters, inline results, CSV export

#### Route Exclusion
- Pill toggle in Routes management table — click to flip Included/Excluded
- Excluded routes filtered from dashboard stats, display boards, and report averages
- Data entry dropdowns unaffected (exclusion is analytics-only)

#### Driver ID
- Admin-only field + badge in employee modal
- API enforces role on read and write

### Changed
- `nginx/entrypoint.sh` — `envsubst` replaced with `sed` + literal `REAL_HOST_VALUE` placeholder
- Nginx `$real_scheme` derived from `X-Forwarded-Proto` for correct redirects behind HTTPS proxies
- API startup: `runMigrations → seedAdmin → listen`

### Fixed
- Route entry dropdowns no longer filter out excluded routes

---

## [1.0.0] — 2026-04-12

### Initial release
- Daily route log entry — Form mode and Inline (Excel-style) mode
- Pack-out event tracking (multiple dump runs per driver)
- Driver and Route management with area tags
- CSV import/export
- Full display board — stat tiles, Next Up, Driver KPI table
- Backup/Restore/Erase
- User management with Admin/User roles
- JWT authentication
- PostgreSQL 16, Docker Compose, 6-container architecture
