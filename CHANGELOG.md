# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.1.0] — 2026-04-19

### Added

#### Data Model
- `to_yard_time` field on route logs — tracks when a driver departs for the yard at end of day
- `location` field on pack-out logs — dump site selector: Alva, Naughton, or Casella
- `excluded` boolean on routes — when enabled, route is hidden from all dashboard stats, display boards, and report averages (data entry still works normally)
- `driver_id` field on employees — internal identifier for payroll/dispatch systems; admin-only, not exposed to regular users

#### Auto-Migration System
- `api/src/db/migrate.js` — migration runner that creates a `schema_migrations` tracking table and applies any pending numbered `.sql` files in order on every startup
- `001_add_packout_table.sql`, `002_v1_1_new_columns.sql`, `003_add_driver_id.sql` — numbered migration files; no manual `docker exec` SQL needed ever again
- Failed migrations abort startup with a clear error log rather than running a broken server

#### Slim Display Board (`/slimdisplay/`)
- New `slim-display-ui` container on port 3002
- Shows only Next Up (Route Assignment Recommendation) and Driver Route KPI table
- Same data source and 60-second refresh as the full display board
- Subtitle: "ROUTE ASSIGNMENT BOARD"
- Added to `docker-compose.yml` and nginx proxy config

#### Reports Section
- New **📊 Reports** nav item in the admin sidebar
- **Friday Hours tab** — canned report showing Mon–Thu hours per driver for any selected week, sorted most hours first; medal emojis for top 3; zero-data drivers shown greyed at bottom; CSV export
- **Report Builder tab** — flexible query tool with column selection (pill toggles), date range presets (Today/This Week/Last Week/Last 30/Last 90/Custom), driver multi-select, route multi-select, completion status filter; results render inline; CSV export with row count

#### Route Exclusion
- Routes management page now shows an **Included/Excluded** pill toggle per route — click to flip without opening the modal
- Excluded routes: dimmed in the routes table, filtered from all dashboard API queries (stats, averages, trends, top routes), filtered from display board stats
- Excluded routes still appear in data entry dropdowns (exclusion affects analytics only)

#### Driver ID (Admin-only)
- `driver_id` field in employee create/edit modal with "Admin only" badge
- Admin-role users see a Driver ID column in the employees table
- API enforces role — non-admins cannot read or write `driver_id`

### Changed
- `nginx/entrypoint.sh` switched from `envsubst` to `sed` for REAL_HOST injection — prevents `envsubst` from inadvertently stripping nginx's own `$variables`
- `nginx/nginx.conf.template` uses `$real_scheme` (derived from `X-Forwarded-Proto` header) for redirects — fixes redirect loops when behind an HTTPS-terminating upstream proxy
- `api/src/index.js` — startup sequence is now `runMigrations → seedAdmin → listen`; server does not start if a migration fails
- Routes API `GET /api/routes` accepts `?all=true` to return all routes including excluded ones (used by the management page); default returns active-only (used by data entry)
- Pack-out popover in inline editor expanded to 3 columns: Pack Out time | Back On Route time | Location

### Fixed
- Route entry dropdowns no longer filter out excluded routes — exclusion is analytics-only

---

## [1.0.0] — 2026-04-12

### Initial release

#### Admin Portal
- Daily route log entry with **Form mode** (modal dialogs) and **Inline mode** (Excel-style direct table editing)
- Custom time picker dropdown component for inline editing — scrollable hour, minute, and AM/PM columns
- Pack-out event tracking — multiple dump runs per driver per day with pack-out time and back-on-route time
- Driver management — name, employee number, position, active/inactive status
- Route management — route name, description, area tag (shown as badge on display board)
- CSV import with automatic driver name resolution, pack-out column detection, and preview step
- CSV export with dynamic pack-out columns scaled to the maximum dump count for the date
- Daily progress bar showing how many of the full driver roster have been logged
- Date navigation (← / → arrows) with keyboard support

#### Display Board
- Read-only TV dashboard — no login required
- Live clock with full date display, auto-refreshes every 60 seconds
- Stat tiles row, Avg Clock Times card, Avg Punch In → 1st Stop card
- Route Assignment Recommendation (Next Up) — 25% left panel
- Driver Route KPI table — 75% right panel, sorted fastest → slowest by 7d avg
- Always-visible amber notes bar beneath each driver row

#### Admin Settings (admin role only)
- Backup & Restore tab — JSON snapshot download, restore with preview, Erase All Data (double-confirm)
- Users tab — create/edit/delete accounts, Admin and User roles, safety guards

#### API & Infrastructure
- JWT authentication, role-based access control
- Fully Dockerized — five containers: nginx, api, admin-ui, display-ui, postgres
- PostgreSQL 16 with named volume persistence
- Nginx reverse proxy with REAL_HOST support
- Auto-initializes with 12 seeded drivers and 8 seeded routes
