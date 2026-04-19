# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
- **Stat tiles row:** Routes Complete, In Progress, Punched In, Longest Avg Route (7d/30d), Avg Day Length, Avg Route Time
- **Avg Clock Times card** — fleet-wide average clock-in and clock-out over 7 and 30 days
- **Avg Punch In → 1st Stop card** — measures dispatch efficiency over 7 and 30 days
- **Route Assignment Recommendation (Next Up)** — 25% left panel ranking available drivers by least time on clock; primary pick highlighted in amber with pulse indicator
- **Driver Route KPI table** — 75% right panel, all drivers logged today sorted fastest → slowest by 7-day average route time; columns: rank, driver, route+area badge, punch in, 1st stop, route done, punch out, day length, 7d avg, status
- Always-visible amber notes bar beneath each driver row when a note exists
- Route area badges (blue pill) on all route displays

#### Admin Settings (admin role only)
- **Backup & Restore tab:**
  - Download full JSON snapshot of all operational data (no passwords)
  - Restore from backup with record count preview before committing
  - Erase All Data — three-step double confirmation with typed "ERASE" verification
- **Users tab:**
  - Create, edit, and delete user accounts
  - Roles: Admin (full access) and User (operational data entry only)
  - Cannot delete own account or last admin; cannot remove own admin role

#### API & Infrastructure
- JWT authentication — 24-hour tokens, role embedded in payload
- Role-based access control — admin-only guards on user management, backup/erase endpoints
- Display dashboard summary endpoint is auth-exempt (display board read access)
- Fully Dockerized — five containers: nginx, api, admin-ui, display-ui, postgres
- PostgreSQL 16 with named volume persistence
- Nginx reverse proxy with `REAL_HOST` envsubst support for upstream proxy compatibility
- Gzip compression on the proxy; long-term asset caching (`immutable`) on compiled static builds
- JSON backup strategy — portable across PostgreSQL versions, no pg_dump dependency
- Schema auto-initializes on first run with 12 seeded drivers and 8 seeded routes
