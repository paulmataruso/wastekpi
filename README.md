# Waste Management KPI Tracker

A self-hosted, Docker-based operations dashboard for small waste management companies. Tracks daily driver KPIs — punch in/out times, route completion, first stop time, and pack-out (dump) events — and displays live metrics on a read-only TV display board.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Docker](https://img.shields.io/badge/docker-compose-blue)

---

## Features

### Admin Portal (`/admin/`)
- **Daily Route Log entry** — Form mode (modal) or Excel-style inline editing with custom time picker
- **Pack-out event tracking** — Multiple dump runs per driver per day
- **Driver & Route management** — Active/inactive status, route area tagging
- **CSV Import / Export** — Bulk data entry with pack-out column support
- **Dashboard** — Daily summary, 7-day trend, top routes
- **Backup & Restore** — Full JSON snapshot download + restore
- **Data Erase** — Double-confirmed wipe of all operational data
- **User Management** — Per-user logins with Admin/User role separation

### Display Board (`/display/`)
- Read-only TV dashboard, no login required
- Live clock, stat tiles, driver KPI table with notes
- Route assignment recommendation (Next Up card)
- Auto-refreshes every 60 seconds

### API (`/api/`)
- JWT-authenticated REST API
- Full CRUD for all entities
- Role-based access control (admin vs user)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Reverse proxy | Nginx (Alpine) |
| Frontend (Admin) | React 18 + Vite |
| Frontend (Display) | React 18 + Vite |
| API | Node.js 20 + Express |
| Database | PostgreSQL 16 |
| Auth | JWT (bcryptjs) |
| Container | Docker Compose |

---

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/YOUR_USERNAME/waste-kpi.git
cd waste-kpi
cp .env.example .env
```

Edit `.env` and set:
- `POSTGRES_PASSWORD` — a strong database password
- `JWT_SECRET` — a random string, minimum 32 characters
- `ADMIN_PASSWORD` — initial admin account password
- `REAL_HOST` — your hostname or `localhost:3300` for local use

### 2. Build and start

```bash
docker compose build
docker compose up -d
```

### 3. Access

| URL | Description |
|---|---|
| `http://localhost:3300/admin/` | Admin portal (default: admin / admin123) |
| `http://localhost:3300/display/` | Read-only display board |

> **Change the default admin password immediately** after first login via Admin Settings → Users.

---

## Documentation

See the [`docs/`](docs/) folder:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System design, container layout, data flow
- [`docs/API.md`](docs/API.md) — Full API reference with endpoints and request/response shapes
- [`docs/SETUP.md`](docs/SETUP.md) — Detailed installation and configuration guide
- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) — How to use the admin portal and display board
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — Local development setup, project structure

---

## Project Structure

```
waste-kpi/
├── api/                    # Node.js/Express REST API
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.sql          # Database schema + seed data
│   │   │   └── migration_packout.sql
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT verification middleware
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── employees.js
│   │   │   ├── routes.js
│   │   │   ├── routeLogs.js
│   │   │   ├── packOuts.js
│   │   │   ├── clockLogs.js
│   │   │   ├── dashboard.js
│   │   │   ├── import.js
│   │   │   ├── backup.js
│   │   │   └── users.js
│   │   └── index.js
│   ├── Dockerfile
│   └── package.json
├── admin-ui/               # React admin portal
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Toast.jsx
│   │   │   ├── DateNav.jsx
│   │   │   ├── TimePicker.jsx
│   │   │   ├── ExportModal.jsx
│   │   │   └── ImportModal.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── RouteLogs.jsx
│   │   │   ├── RoutesMgmt.jsx
│   │   │   ├── EmployeesMgmt.jsx
│   │   │   └── Admin.jsx
│   │   ├── api.js
│   │   └── App.jsx
│   └── Dockerfile
├── display-ui/             # React read-only display board
│   ├── src/
│   │   └── App.jsx
│   └── Dockerfile
├── nginx/                  # Reverse proxy
│   ├── nginx.conf.template
│   └── entrypoint.sh
├── docs/                   # Documentation
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Seed Data

The schema seeds 12 drivers and 8 routes on first run. To load additional test data:

```bash
# Load full-year 2026 seed data (2,976 rows)
docker exec -i waste-kpi-postgres psql -U waste_user -d waste_kpi < seed_2026.sql
```

---

## Updating

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

---

## License

MIT — see [LICENSE](LICENSE)
