# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.2.1] — 2026-05-14

### Added

#### Dynamic Pack-Out Locations
- New `pack_out_locations` table (migration `006_add_pack_out_locations.sql`) — stores dump site names, seeded with Alva, Naughton, Casella
- New API `/api/pack-out-locations` — GET all active, POST create new, DELETE soft-delete (sets `active=FALSE` to preserve historical references)
- New `LocationSelect.jsx` component — dropdown with all active locations plus `＋ Add New Location` option at the bottom; selecting it expands an inline card where the user types a name and saves; new location is persisted to DB and auto-selected immediately; Enter saves, Escape cancels
- `packOuts.js` — location validation now queries `pack_out_locations` table instead of hardcoded array
- `api.js` — added `api.packOutLocations` with `list`, `create`, `delete`
- Both the form modal and inline popover use `LocationSelect` — no more hardcoded locations anywhere

### Fixed

#### Spurious Logout Bug
- Users were being logged out 3-4 times a day despite having a valid token
- Root cause: any network error or 5xx response from the API (e.g. during a container restart after a `57P01` pool crash) was being treated as a 401 and immediately nuking the session
- `api.js` — replaced instant logout on first 401 with exponential backoff retry: attempts at 0s, 2s, 7s, 17s, 27s (5 total). Only logs out after 3 consecutive 401 responses, confirming the token is genuinely invalid
- Network errors and 5xx responses retry the same schedule without ever logging out — the container restart window (~8-15s) is fully covered by attempt 3 at 7s cumulative
- `auth.js` — JWT expiry extended from 24 hours to 7 days; a daily-operations app should not force re-login every day

---

## [1.2.0] — 2026-04-20

### Added

#### Multiple Route Assignments per Driver
- New `additional_route_logs` table (migration `005`) — multiple extra routes per driver per day, each with `route_number`, `first_stop_time`, `route_complete_time`, notes
- `routeLogs.js` API — `additional_routes[]` in all GET/POST/PUT; upserted atomically in same transaction as pack-outs
- `RouteLogs.jsx` — AdditionalRoutesCard in form modal; RouteCell shows amber `+Route N` badges; Extras column shows both dump count and additional route count
- Backup/Restore includes `additional_route_logs`

#### Route Duration Report
- New `GET /api/reports/route-duration` — `UNION ALL` query covers primary + additional route assignments
- Per-route: avg/fastest/slowest duration, expandable per-run detail rows, bar chart column
- Date range presets, route filter, CSV export

#### Write-Ahead Log (Crash Safety)
- `api/src/wal.js` — NDJSON intent log in `wal_data` Docker volume at `/app/data/wal.log`
- `walAppend` before DB write, `walCommit` after success, `walRecover` on startup
- `walCompact` prunes entries older than 7 days
- `routeLogs.js` POST/PUT WAL-protected; `additional_routes` included in replay payload
- Startup sequence: `runMigrations → walRecover → seedAdmin → listen`

#### Pool Crash Fix
- `pool.on('error', ...)` prevents pg error `57P01` from crashing the Node.js process
- Pool: `keepAlive: true`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`

### Fixed
- Backup restore: all current columns included for all tables — previously column mismatch silently rolled back the entire restore
- Dashboard API: `e.exclude_from_next_up` added to routeList SELECT — Next Up filter now actually works on display boards

---

## [1.1.1] — 2026-04-20

### Added
- Migration `004_add_exclude_from_next_up.sql`
- `EmployeesMgmt.jsx` — Exclude from Next Up checkbox + Included/Excluded pill column
- Both display boards filter excluded drivers from `computeNextUp()`

### Fixed
- Dashboard API: `exclude_from_next_up` missing from SELECT
- Nginx `map` directive moved to `http` block
- Nginx dynamic `set $upstream` variables removed

---

## [1.1.0] — 2026-04-19

### Added
- `to_yard_time`, pack-out `location`, route `excluded`, employee `driver_id`
- Auto-migration runner (`migrate.js`)
- Slim display board (`/slimdisplay/`)
- Reports: Friday Hours + Report Builder
- Route exclusion toggle
- Driver ID (admin-only)

### Changed
- nginx: `sed` + `REAL_HOST_VALUE` placeholder; `$real_scheme` from `X-Forwarded-Proto`

### Fixed
- Route entry dropdowns no longer filter excluded routes

---

## [1.0.0] — 2026-04-12

### Initial release
- Daily route log entry (Form + Inline modes)
- Pack-out event tracking
- Driver and Route management
- CSV import/export, Backup/Restore/Erase
- Full display board, User management, JWT auth
- PostgreSQL 16, Docker Compose
