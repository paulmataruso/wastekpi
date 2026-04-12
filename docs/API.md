# API Reference

All endpoints are prefixed with `/api`. All endpoints except `POST /auth/login` and `GET /dashboard/summary` require a valid JWT in the `Authorization: Bearer <token>` header.

---

## Authentication

### POST /api/auth/login

Authenticate and receive a JWT token.

**Request body:**
```json
{ "username": "admin", "password": "yourpassword" }
```

**Response:**
```json
{
  "token": "eyJ...",
  "username": "admin",
  "role": "admin"
}
```

**Error responses:** `400 Missing fields`, `401 Invalid credentials`

---

## Employees

### GET /api/employees
Returns all employees.

### POST /api/employees
**Body:** `{ "name", "employee_number"?, "position"?, "active"? }`

### PUT /api/employees/:id
**Body:** any subset of employee fields.

### DELETE /api/employees/:id

---

## Routes

### GET /api/routes
Returns all routes.

### POST /api/routes
**Body:** `{ "route_name", "description"?, "area"?, "active"? }`

### PUT /api/routes/:id
**Body:** any subset of route fields.

### DELETE /api/routes/:id

---

## Route Logs

One record per employee per calendar day.

### GET /api/route-logs?date=YYYY-MM-DD
Returns all logs for the given date. Each log includes an attached `pack_outs` array and `route_area` from the joined routes table.

**Response row shape:**
```json
{
  "id": 1,
  "employee_id": 3,
  "employee_name": "Justin",
  "log_date": "2026-04-08",
  "route_number": "Route 1",
  "route_area": "North",
  "punch_in": "06:00:00",
  "first_stop_time": "06:18:00",
  "route_complete_time": "14:32:00",
  "punch_out": "14:45:00",
  "notes": "Truck 4 check engine light",
  "pack_outs": [
    { "id": 1, "seq": 1, "pack_out_time": "10:15:00", "back_on_route_time": "11:05:00" }
  ],
  "avg_route_mins_7d": "492.3"
}
```

### POST /api/route-logs
**Body:**
```json
{
  "employee_id": 3,
  "log_date": "2026-04-08",
  "route_number": "Route 1",
  "punch_in": "06:00",
  "first_stop_time": "06:18",
  "route_complete_time": "14:32",
  "punch_out": "14:45",
  "notes": "",
  "pack_outs": [
    { "pack_out_time": "10:15", "back_on_route_time": "11:05" }
  ]
}
```

Pack-outs are managed in the same transaction — pass the full array on every create/update.

### PUT /api/route-logs/:id
Same body shape as POST (minus `log_date`).

### DELETE /api/route-logs/:id

---

## Pack-Out Logs

Standalone endpoints for pack-outs if needed outside of route log transactions.

### GET /api/pack-outs?route_log_id=:id
### POST /api/pack-outs
**Body:** `{ "route_log_id", "seq", "pack_out_time"?, "back_on_route_time"? }`
### PUT /api/pack-outs/:id
### DELETE /api/pack-outs/:id

---

## Dashboard

### GET /api/dashboard/summary?date=YYYY-MM-DD

**No auth required** (display board uses this endpoint unauthenticated).

Returns a single object:
```json
{
  "stats": {
    "routes_completed": 8,
    "total_drivers": 12,
    "punched_in": 10,
    "punched_out": 3,
    "avg_day_length_hours": "8.5",
    "avg_route_duration_hours": "7.2"
  },
  "route_logs": [ ...full log rows with pack_outs and avg_route_mins_7d... ],
  "week_routes": [ { "log_date": "2026-04-02", "routes_completed": 11 }, ... ],
  "top_routes": {
    "route_7d": "Route 6",
    "avg_hours_7d": "8.3",
    "runs_7d": "7",
    "route_30d": "Route 6",
    "avg_hours_30d": "8.1",
    "runs_30d": "28"
  },
  "clock_avgs": {
    "avg_clock_in_7d": "06:02 AM",
    "avg_clock_out_7d": "02:48 PM",
    "avg_clock_in_30d": "06:05 AM",
    "avg_clock_out_30d": "02:51 PM"
  },
  "first_stop_avgs": {
    "avg_to_first_stop_mins_7d": "18.2",
    "avg_to_first_stop_mins_30d": "17.8"
  }
}
```

---

## Import

### POST /api/import

Bulk import route logs from a parsed CSV array. Upserts on `(employee_id, log_date)`.

**Body:**
```json
{
  "rows": [
    {
      "employee_name": "Justin",
      "log_date": "2026-04-08",
      "route_number": "Route 1",
      "punch_in": "06:00",
      "punch_out": "14:45",
      "pack_out_1": "10:15",
      "back_on_route_1": "11:05"
    }
  ]
}
```

The import route resolves employee names to IDs automatically. Pack-out columns are auto-detected (`pack_out_N`, `back_on_route_N`).

---

## Backup

### GET /api/backup

Returns a JSON file download (all operational tables, no passwords).

**Response:** JSON file with `Content-Disposition: attachment` header.

### POST /api/backup/restore

Restores all data from a backup. Runs in a single transaction.

**Body:** `{ "backup": { ...the parsed JSON backup object... } }`

**Response:** `{ "success": true, "restored": { "employees": 12, "routes": 8, ... } }`

### POST /api/backup/erase

**Admin only.** Permanently deletes all route_logs, pack_out_logs, and clock_logs. Resets sequences.

**Response:** `{ "success": true, "message": "All route log data erased" }`

---

## Users

All user endpoints are **admin only**.

### GET /api/users
Returns all users (no password hashes).

### POST /api/users
**Body:** `{ "username", "password", "role"? }` — role defaults to `"user"`.

### PUT /api/users/:id
**Body:** any subset of `{ "username"?, "password"?, "role"? }`. Password is only updated if provided.

**Guards:**
- Cannot remove your own admin role
- Cannot set role to anything other than `"admin"` or `"user"`

### DELETE /api/users/:id

**Guards:**
- Cannot delete your own account
- Cannot delete the last admin account

---

## Error Responses

All errors return:
```json
{ "error": "Human-readable error message" }
```

Common HTTP status codes: `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `500 Internal Server Error`
