# API Reference

All endpoints are prefixed with `/api`. All require `Authorization: Bearer <token>` except `POST /auth/login` and `GET /dashboard/summary`.

---

## Authentication

### POST /api/auth/login
**Body:** `{ "username", "password" }`
**Response:** `{ "token", "username", "role" }`

---

## Employees

### GET /api/employees
Admin users receive `driver_id`; regular users do not. All users receive `exclude_from_next_up`.

### POST /api/employees
**Body:** `{ "name", "employee_number"?, "driver_id"?, "position"?, "active"?, "exclude_from_next_up"? }`

`driver_id` only stored if requester has `admin` role.

### PUT /api/employees/:id
Same fields. `driver_id` only updated by admins.

### DELETE /api/employees/:id

---

## Routes

### GET /api/routes
Returns active routes. Add `?all=true` to include excluded routes (used by the management page).

### POST /api/routes
**Body:** `{ "route_name", "description"?, "area"?, "active"?, "excluded"? }`

### PUT /api/routes/:id
### DELETE /api/routes/:id

---

## Route Logs

One record per employee per calendar day. Each record may have multiple `pack_outs` and `additional_routes`.

### GET /api/route-logs?date=YYYY-MM-DD

**Response row shape:**
```json
{
  "id": 1,
  "employee_id": 3,
  "employee_name": "Justin",
  "log_date": "2026-04-20",
  "route_number": "Route 1",
  "route_area": "North",
  "punch_in": "06:00:00",
  "first_stop_time": "06:18:00",
  "route_complete_time": "14:32:00",
  "to_yard_time": "14:38:00",
  "punch_out": "14:45:00",
  "notes": "",
  "pack_outs": [
    { "id": 1, "seq": 1, "pack_out_time": "10:15:00",
      "back_on_route_time": "11:05:00", "location": "Alva" }
  ],
  "additional_routes": [
    { "id": 1, "seq": 1, "route_number": "Route 3",
      "first_stop_time": "14:50:00", "route_complete_time": "17:30:00",
      "notes": "Helped finish" }
  ],
  "avg_route_mins_7d": "492.3"
}
```

### POST /api/route-logs
**Body:**
```json
{
  "employee_id": 3,
  "log_date": "2026-04-20",
  "route_number": "Route 1",
  "punch_in": "06:00",
  "first_stop_time": "06:18",
  "route_complete_time": "14:32",
  "to_yard_time": "14:38",
  "punch_out": "14:45",
  "notes": "",
  "pack_outs": [
    { "pack_out_time": "10:15", "back_on_route_time": "11:05", "location": "Alva" }
  ],
  "additional_routes": [
    { "route_number": "Route 3", "first_stop_time": "14:50",
      "route_complete_time": "17:30", "notes": "Helped finish" }
  ]
}
```

All three sub-arrays (`pack_outs`, `additional_routes`) are saved atomically in the same transaction.

### PUT /api/route-logs/:id
Same body shape (minus `log_date`).

### DELETE /api/route-logs/:id

---

## Pack-Out Logs

Usually managed via route-logs transactions. Standalone endpoints available.

### GET /api/pack-outs?route_log_id=:id
### POST /api/pack-outs
**Body:** `{ "route_log_id", "seq", "pack_out_time"?, "back_on_route_time"?, "location"? }`
`location` must be: `Alva`, `Naughton`, or `Casella`
### PUT /api/pack-outs/:id
### DELETE /api/pack-outs/:id

---

## Dashboard

### GET /api/dashboard/summary?date=YYYY-MM-DD

**No auth required.** Routes with `excluded=true` are filtered from all stats. Each row in `route_logs` includes `exclude_from_next_up` from the employee record.

Returns: `{ date, stats, route_logs, week_routes, top_routes, clock_avgs, first_stop_avgs }`

---

## Import

### POST /api/import
**Body:** `{ "rows": [...] }` — each row may include `to_yard`, `location_N`, `pack_out_N`, `back_on_route_N` columns.

---

## Backup

### GET /api/backup
JSON file download — all tables including `additional_route_logs`, no password hashes.

### POST /api/backup/restore
**Body:** `{ "backup": { ...parsed JSON... } }`
Full transaction restore. Handles old backups missing newer columns via `|| null` fallbacks.

### POST /api/backup/erase
**Admin only.** Deletes all route_logs, pack_out_logs, additional_route_logs, clock_logs. Resets sequences.

---

## Users

All **admin only**.

### GET /api/users
### POST /api/users — `{ "username", "password", "role"? }` (role defaults to `"user"`)
### PUT /api/users/:id — any subset of `{ "username"?, "password"?, "role"? }`
### DELETE /api/users/:id

---

## Reports

### GET /api/reports/friday-hours?week_of=YYYY-MM-DD

Returns Mon–Thu accumulated hours per driver for the week containing the given date.
Add `&format=csv` for a file download.

**Response:**
```json
{
  "week_of": "2026-04-20",
  "monday": "2026-04-13",
  "rows": [
    {
      "employee_name": "Justin",
      "monday": "8h 12m", "tuesday": "8h 45m",
      "wednesday": "9h 02m", "thursday": "8h 30m",
      "total_hours": "34h 29m", "total_mins": 2069, "days_worked": 4
    }
  ]
}
```

---

### GET /api/reports/route-duration

**Query params:** `date_from`, `date_to` (required), `route_numbers[]` (optional, repeatable), `format=csv`

Calculates `first_stop_time → route_complete_time` for each route. Combines primary route assignments and `additional_route_logs` via `UNION ALL`, so drivers who helped with extra routes are counted.

**Response:**
```json
{
  "date_from": "2026-03-20",
  "date_to": "2026-04-20",
  "row_count": 8,
  "rows": [
    {
      "route_number": "Route 2 - Monday",
      "total_runs": 4, "timed_runs": 4,
      "avg_duration": "7h 52m", "avg_mins": 472.0,
      "fastest": "7h 10m", "fastest_mins": 430.0,
      "slowest": "8h 30m", "slowest_mins": 510.0,
      "runs": [
        {
          "employee_name": "Justin",
          "log_date": "2026-04-14",
          "first_stop": "06:18:00",
          "route_complete": "14:10:00",
          "duration_mins": 472
        }
      ]
    }
  ]
}
```

CSV export flattens to one row per run.

---

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

`400` Bad Request · `401` Unauthorized · `403` Forbidden · `404` Not Found · `500` Internal Server Error
