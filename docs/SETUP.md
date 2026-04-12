# Setup & Installation

## Requirements

- Docker Engine 24+ and Docker Compose v2
- A Linux host (bare metal, VM, or VPS) — works on Ubuntu 22.04/24.04, Debian 12, RHEL 9
- Port 3300 accessible (or configure your upstream proxy to forward to it)
- 512 MB RAM minimum; 1 GB+ recommended

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/waste-kpi.git
cd waste-kpi
```

### 2. Configure environment

```bash
cp .env.example .env
nano .env
```

Required settings:

| Variable | Description | Example |
|---|---|---|
| `POSTGRES_DB` | Database name | `waste_kpi` |
| `POSTGRES_USER` | Database user | `waste_user` |
| `POSTGRES_PASSWORD` | **Strong password** | `MyStr0ngP@ss!` |
| `JWT_SECRET` | Random string ≥ 32 chars | `a8f3...` (use `openssl rand -hex 32`) |
| `ADMIN_USERNAME` | Initial admin username | `admin` |
| `ADMIN_PASSWORD` | Initial admin password | `ChangeMe!123` |
| `REAL_HOST` | External hostname | `wastekpi.example.com` or `localhost:3300` |

Generate a secure JWT secret:
```bash
openssl rand -hex 32
```

### 3. Build images

```bash
docker compose build
```

This compiles both React apps and packages the Node.js API. First build takes 2–5 minutes.

### 4. Start services

```bash
docker compose up -d
```

### 5. Verify

```bash
docker compose ps          # all services should show "running"
docker compose logs api    # should show "API listening on port 4000"
curl http://localhost:3300/api/health   # should return {"status":"ok"}
```

### 6. First login

Navigate to `http://localhost:3300/admin/` and log in with your `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

**Immediately change the admin password:** Admin Settings → 👤 Users → Edit your account.

---

## Reverse Proxy Setup (Nginx Proxy Manager / Traefik)

If you're placing this behind an upstream reverse proxy:

1. Set `REAL_HOST` in `.env` to your public domain name, e.g. `wastekpi.example.com`
2. Point your proxy to `http://your-server-ip:3300`
3. The inner Nginx will issue redirects using the `REAL_HOST` value so URLs remain correct

**Example NPM configuration:**
- Forward hostname/IP: `your-server-ip`
- Forward port: `3300`
- No Websocket support needed
- SSL can be terminated at NPM

---

## Database Initialization

The schema (`api/src/db/schema.sql`) runs automatically on first start via PostgreSQL's `docker-entrypoint-initdb.d/` mechanism. It creates all tables and seeds:

- 8 routes (Route 1 through Route 8, with blank area fields)
- 12 employees (Justin, Brent, Chuck, Bryan SR, George, Mike, Bryan JR, Marcel, Jake, Chloe, Paige, Syd)

To populate route area fields, go to Admin Portal → Routes and edit each route.

### Pack-out migration (existing installations only)

If upgrading from a version before pack-out support was added:

```bash
docker exec -i waste-kpi-postgres psql -U waste_user -d waste_kpi \
  < api/src/db/migration_packout.sql
```

---

## Updating

```bash
git pull
docker compose build --no-cache api admin-ui display-ui
docker compose up -d
```

> Always take a backup before updating: Admin Settings → 💾 Backup & Restore → Download Backup

---

## Stopping and Removing

```bash
# Stop containers, keep data
docker compose down

# Stop containers and DESTROY all data (irreversible)
docker compose down -v
```

---

## Common Issues

**Port 3300 already in use:**
Change the host port in `docker-compose.yml`:
```yaml
ports:
  - "3400:3300"   # use 3400 on the host instead
```

**Database not initializing:**
The schema only runs if the `postgres_data` volume does not exist. If you need to re-initialize:
```bash
docker compose down -v   # destroys data
docker compose up -d
```

**Admin password forgotten:**
Connect to the database directly and reset:
```bash
docker exec -it waste-kpi-postgres psql -U waste_user -d waste_kpi
```
```sql
UPDATE users SET password_hash = '$2a$10$...' WHERE username = 'admin';
```
Or use `bcrypt-cli` to generate a new hash, or delete the user and let the seeder recreate it on next startup if `ADMIN_USERNAME`/`ADMIN_PASSWORD` are set.

**Containers restart looping:**
```bash
docker compose logs api      # check for database connection errors
docker compose logs postgres # check for init errors
```
