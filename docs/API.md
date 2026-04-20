# API Reference

All endpoints are prefixed with `/api`. All endpoints except `POST /auth/login` and `GET /dashboard/summary` require a valid JWT in the `Authorization: Bearer <token>` header.

---

## Authentication

### POST /api/auth/login

**Body:** `{ "username", "password" }`

**Response:** `{ "token", "username", "role" }`

---

## Employees

### GET /api/employees
Returns all employees. Admin users receive `driver_id`; regular users do not.

### POST /api/employees
**Body:** `{ "name", "employee_number"?, "driver_id"?, "position"?, "active"? }`

`driver_id` is only stored if the requester has the `admin` role.

### PUT /api/employees/:id
Same fields as POST. `driver_id` is only updated by admins.

### DELETE /api/employees/:id

---

## Routes

### GET /api/routes
Returns active routes. Add `?all=true` to return all routes including excluded ones (used by the management page).

### POST /api/routes
**Body:** `{ "route_name", "description"?, "area"?, "active"?, "excluded"? }`

### PUT /api/routes/:id
**Body:** any subset including `excluded` boolean.

### DELETE /api/routes/:id

---

## Route Logs

One record per employee per calendar day.

### GET /api/route-logs?date=YYYY-MM-DD
Returns all logs for the given date with `pack_outs` array and `route_area` attached.

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
  "to_yard_time": "14:38:00",
  "punch_out": "14:45:00",
  "notes": "Truck 4 check engine light",
  "pack_outs": [
    {
      "id": 1, "seq": 1,
      "pack_out_time": "10:15:00",
      "back_on_route_time": "11:05:00",
      "location": "Alva"
    }
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
  "to_yard_time": "14:38",
  "punch_out": "14:45",
  "notes": "",
  "pack_outs": [
    { "pack_out_time": "10:15", "back_on_route_time": "11:05", "location": "Alva" }
  ]
}
```

### PUT /api/route-logs/:id
Same body shape (minus `log_date`).

### DELETE /api/route-logs/:id

---

## Pack-Out Logs

Standalone endpoints (pack-outs are usually managed via route-logs transactions).

### GET /api/pack-outs?route_log_id=:id
### POST /api/pack-outs
**Body:** `{ "route_log_id", "seq", "pack_out_time"?, "back_on_route_time"?, "location"? }`

`location` must be one of: `Alva`, `Naughton`, `Casella`

### PUT /api/pack-outs/:id
### DELETE /api/pack-outs/:id

---

## Dashboard

### GET /api/dashboard/summary?date=YYYY-MM-DD

**No auth required.** Routes marked `excluded=true` are filtered from all stats and averages.

Returns: `{ date, stats, route_logs, week_routes, top_routes, clock_avgs, first_stop_avgs }`

---

## Import

### POST /api/import

**Body:** `{ "rows": [...] }` — each row may include `to_yard`, `location_N` pack-out columns in addition to standard fields.

---

## Backup

### GET /api/backup
Returns a JSON file download (all operational tables, no passwords).

### POST /api/backup/restore
**Body:** `{ "backup": { ...parsed JSON... } }`

### POST /api/backup/erase
**Admin only.** Permanently deletes all route_logs, pack_out_logs, clock_logs.

---

## Users

All user endpoints are **admin only**.

### GET /api/users
### POST /api/users
**Body:** `{ "username", "password", "role"? }` — role defaults to `"user"`.
### PUT /api/users/:id
**Body:** any subset of `{ "username"?, "password"?, "role"? }`.
### DELETE /api/users/:id

---

## Reports

### GET /api/reports/friday-hours?week_of=YYYY-MM-DD

Returns Mon–Thu hours per driver for the week containing the given date, sorted most-hours-first.

Add `&format=csv` for a file download.

**Response:**
```json
{
  "week_of": "2026-04-19",
  "monday": "2026-04-13",
  "tuesday": "2026-04-14",
  "wednesday": "2026-04-15",
  "thursday": "2026-04-16",
  "rows": [
    {
      "employee_name": "Justin",
      "monday": "8h 12m",
      "tuesday": "8h 45m",
      "wednesday": "9h 02m",
      "thursday": "8h 30m",
      "total_hours": "34h 29m",
      "total_mins": 2069,
      "days_worked": 4
    }
  ]
}
```

### POST /api/reports/custom

**Body:**
```json
{
  "columns": ["employee_name", "log_date", "route_number", "punch_in", "punch_out", "day_length"],
  "date_from": "2026-04-01",
  "date_to": "2026-04-30",
  "driver_ids": [],
  "route_numbers": [],
  "status": "all",
  "format": "json"
}
```

`columns` — any subset of: `employee_name`, `log_date`, `route_number`, `route_area`, `punch_in`, `first_stop_time`, `route_complete_time`, `to_yard_time`, `punch_out`, `day_length`, `pack_out_count`, `notes`

`status` — `"all"` | `"complete"` | `"incomplete"`

`format` — `"json"` | `"csv"`

---

## Error Responses

```json
{ "error": "Human-readable message" }
```

`400` Bad Request · `401` Unauthorized · `403` Forbidden · `404` Not Found · `409` Conflict · `500` Internal Server Error
