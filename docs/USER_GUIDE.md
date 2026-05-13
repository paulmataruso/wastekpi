# User Guide

## Logging In

Navigate to `http://your-host/admin/` and enter your username and password.

---

## Admin Portal Overview

| Link | Purpose |
|---|---|
| ⬡ Dashboard | Daily and weekly summary stats |
| 🚛 Route Logs | Main data entry page |
| 🗺 Routes | Manage route names, areas, and exclusions |
| 👷 Employees | Manage driver roster |
| 📊 Reports | Friday Hours, Route Duration, and custom report builder |
| ⚙ Admin Settings | Backup, restore, erase data, user accounts (admin only) |

---

## Route Logs — Data Entry

Select a date using the ← / → arrows at the top right.

### Form Mode (default)

Click **+ Add Entry**. Fill in:

- **Driver** — select from the dropdown
- **Primary Route** — the main route assigned for the day
- **Times** — Punch In, 1st Stop, Route Complete, To Yard, Punch Out (Day Length calculates automatically)
- **Additional Routes** — click **+ Add Route** to record extra routes the driver helped with or was assigned to. Each additional route has its own Route, 1st Stop, and Route Complete time, plus optional notes.
- **Pack Out Events** — click **+ Add Pack Out** for each dump run; enter Pack Out time, Back On Route time, and Location (Alva / Naughton / Casella)
- **Notes** — free text for the primary route

### Inline Mode (Excel-style)

Click **⊞ Inline**. The table switches to direct in-place editing:

- **New row at top** (green) — select driver, fill times, click **✓ Add** or press Enter
- **Edit existing rows** — click any row to edit in-place; Enter saves, Escape cancels
- **Pack-out events** — click **+ Dumps** button to open popover
- **Additional routes** — shown as an amber count badge (e.g. `+2 routes`). To add or edit additional routes, use the ✏️ form edit button instead — the inline editor doesn't include the full additional routes card

---

## Routes Management

Go to **🗺 Routes**.

- **Active toggle** — inactive routes are hidden from data entry dropdowns
- **Included / Excluded toggle** — click the pill badge to flip. When **Excluded**, the route is hidden from all display board stats, dashboard averages, and reports. Data entry still works normally — exclusion is analytics-only.

---

## Employees Management

Go to **👷 Employees**.

- **Driver ID** (admin only) — an internal identifier for payroll or dispatch systems. Only visible to admin users.
- **Exclude from Route Assignment Recommendation** — when checked, this driver is removed from the Next Up calculation on both display boards. The driver still appears in the KPI table and can still have logs entered; only the recommendation card is affected.
- Inactive employees are hidden from data entry dropdowns; historical data is preserved.

---

## Reports

Go to **📊 Reports**.

### 📅 Friday Hours tab

Shows Mon–Thu accumulated hours for each driver for any selected week, sorted most hours first. Use this on Fridays to decide which drivers to dispatch first.

- Date picker defaults to the current week
- Top 3 drivers get medal emojis 🥇🥈🥉
- Drivers with no entries that week appear greyed at the bottom
- **Export CSV** downloads the result set

### 🛣 Route Duration tab

Calculates the time from first stop pick-up to route complete for each route across a selected date range. Both primary route assignments and additional route assignments are included, so if a driver helped finish a second route it counts toward that route's stats.

- Date range presets or custom pickers
- Optional route filter (multi-select)
- Results table sorted slowest → fastest with a visual bar chart column
- Click any route row to expand a detail sub-table showing every individual run with driver, date, times, and duration
- **Export CSV** flattens to one row per run

### 🔧 Report Builder tab

Build a custom query in four steps:

1. **Columns** — pill buttons to select which fields to include
2. **Date range** — presets or custom date pickers
3. **Filters** — optional driver multi-select, route multi-select, completion status
4. **Run** — renders results inline with row count; **Export CSV** appears after running

---

## Display Boards

### Full board — `/display/`

Stat tiles, insight cards, Next Up recommendation, and full Driver KPI table.

### Slim board — `/slimdisplay/`

Shows only the **Route Assignment Recommendation** (Next Up) and **Driver KPI table**. Designed for a dedicated assignment monitor or smaller screen.

Both boards:
- No login required, auto-refresh every 60 seconds
- Excluded routes filtered from all stats and averages
- Drivers with **Exclude from Next Up** checked are hidden from the Next Up card
- Notes display as always-visible amber bars beneath each driver row

---

## Admin Settings (Admin role only)

### 💾 Backup & Restore tab

**Download Backup** — JSON snapshot of all operational data (no passwords). Includes `additional_route_logs`.

**Restore from Backup** — upload a backup file; shows record counts before committing.

**Erase All Data** — three-step confirmation; permanently deletes all route logs, pack-outs, additional routes, and clock logs; employees, routes, and users are kept.

### 👤 Users tab

| Role | Access |
|---|---|
| **Admin** | Full access including Reports, Admin Settings, Driver ID |
| **User** | Route log data entry, dashboard, routes, employees |

Guards: cannot delete own account, cannot delete last admin, cannot remove own admin role.
