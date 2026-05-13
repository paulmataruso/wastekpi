# Setup & Installation

## Requirements

- Docker Engine 24+ and Docker Compose v2
- Linux host — Ubuntu 22.04/24.04, Debian 12, RHEL 9
- Port 3300 accessible (or configure an upstream proxy)
- 512 MB RAM minimum; 1 GB+ recommended

---

## Installation

### 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/waste-kpi.git
cd waste-kpi
```

### 2. Configure

```bash
cp .env.example .env
nano .env
```

| Variable | Description | Example |
|---|---|---|
| `POSTGRES_DB` | Database name | `waste_kpi` |
| `POSTGRES_USER` | Database user | `waste_user` |
| `POSTGRES_PASSWORD` | **Strong password** | `MyStr0ngP@ss!` |
| `JWT_SECRET` | Random string ≥ 32 chars | `openssl rand -hex 32` |
| `ADMIN_USERNAME` | Initial admin username | `admin` |
| `ADMIN_PASSWORD` | Initial admin password | `ChangeMe!123` |
| `REAL_HOST` | External hostname | `wastekpi.example.com` or `localhost:3300` |

### 3. Build and start

```bash
docker compose build
docker compose up -d
```

Database migrations and WAL recovery run automatically on first startup. No manual SQL needed.

### 4. Verify

```bash
docker compose ps
curl http://localhost:3300/api/health   # {"status":"ok"}
docker compose logs api                 # should show migrations applied + server listening
```

### 5. First login

`http://localhost:3300/admin/` — log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

**Change the admin password immediately:** Admin Settings → 👤 Users → Edit.

---

## Upstream Proxy Setup (Nginx Proxy Manager)

Point your proxy host at `http://your-server-ip:3300`. In the **Advanced** tab, add:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_http_version 1.1;
```

Set `REAL_HOST` in `.env` to your public domain (e.g. `wastekpi.example.com`).

---

## Migrations

Migrations run automatically every time the API container starts. The runner checks which `NNN_*.sql` files in `api/src/db/` have not yet been recorded in `schema_migrations` and applies them in order.

To add a new migration: create `api/src/db/006_description.sql`. It will be applied on next startup.

If a migration fails, the API exits immediately with an error visible in `docker logs waste-kpi-api`.

---

## Write-Ahead Log

The WAL file lives in the `wal_data` named Docker volume at `/app/data/wal.log`. It survives container restarts and rebuilds. On startup the API replays any writes that were in-flight when the previous instance crashed, then starts normally.

You can inspect the WAL file at any time:

```bash
docker exec waste-kpi-api cat /app/data/wal.log
```

---

## URLs

| URL | Description |
|---|---|
| `/admin/` | Admin portal |
| `/display/` | Full display board |
| `/slimdisplay/` | Slim display board (Next Up + KPI table only) |
| `/api/health` | Health check |

---

## Updating

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

Always take a backup first: Admin Settings → 💾 Backup & Restore → Download Backup.

---

## Stopping

```bash
docker compose down          # stop, keep data
docker compose down -v       # stop and DESTROY all data including WAL
```

---

## Common Issues

**502 Bad Gateway from upstream proxy** — add the proxy headers listed above in NPM's Advanced tab.

**Port 3300 in use** — change the host port in `docker-compose.yml`: `"3400:3300"`.

**Migration failed on startup** — run `docker logs waste-kpi-api` to see the exact SQL error.

**API keeps restarting** — run `docker logs waste-kpi-api` — if you see `57P01` errors, the pool crash fix in `index.js` should handle it; confirm you have the latest image built.

**Admin password forgotten:**
```bash
docker exec -it waste-kpi-postgres psql -U waste_user -d waste_kpi
# Then: DELETE FROM users WHERE username='admin';
# Restart the API — ADMIN_USERNAME/ADMIN_PASSWORD will be re-seeded.
```
