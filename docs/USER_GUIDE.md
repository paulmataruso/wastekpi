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
| 📊 Reports | Friday Hours report + custom report builder |
| ⚙ Admin Settings | Backup, restore, erase data, user accounts (admin only) |

---

## Route Logs — Data Entry

Select a date using the ← / → arrows at the top right.

### Form Mode (default)

Click **+ Add Entry**. Fill in:

- **Driver** — select from the dropdown
- **Route #** — optional
- **Times** — Punch In, 1st Stop, Route Complete, **To Yard**, Punch Out (Day Length calculates automatically)
- **Pack Out Events** — click "+ Add Pack Out" for each dump run; enter Pack Out time, Back On Route time, and **Location** (Alva / Naughton / Casella)
- **Notes** — free text

### Inline Mode (Excel-style)

Click **⊞ Inline**. The table switches to direct in-place editing:

- **New row at top** (green) — select driver, fill times with the time picker, click **✓ Add** or press Enter
- **Edit existing rows** — click any row to edit in-place; Enter saves, Escape cancels
- **Pack-out events** — click **+ Dumps** button to open popover (Pack Out / Back On Route / Location)
- **Time picker** — clicking any time field opens a dropdown with Hour, Minute, AM/PM columns

---

## Routes Management

Go to **🗺 Routes**.

- **Active toggle** — inactive routes are hidden from data entry dropdowns
- **Included / Excluded toggle** — click the pill badge to flip. When **Excluded**, the route is hidden from all display board stats, dashboard averages, and reports. Data entry still works normally for excluded routes — exclusion is analytics-only.
- The modal's Visibility section has checkboxes for both Active and Exclude from reports, with a description of what each does.

---

## Employees Management

Go to **👷 Employees**.

- **Driver ID** (admin only) — an internal identifier for payroll or dispatch systems. The field and column are only visible to admin users. Regular users cannot see or set it.
- Inactive employees are hidden from data entry dropdowns; historical data is preserved.

---

## Reports

Go to **📊 Reports**.

### Friday Hours tab

Shows Mon–Thu accumulated hours for each driver for any selected week, sorted most hours first. Use this on Fridays to decide which drivers to dispatch first (those with the most hours accumulated already).

- The date picker defaults to the current week — change it to view any other week
- The week span label updates automatically
- Top 3 drivers get medal emojis 🥇🥈🥉
- Drivers with no entries that week appear greyed at the bottom
- **Export CSV** downloads the result set

### Report Builder tab

Build a custom query in four steps:

1. **Columns** — click pill buttons to select which fields to include; Select All / Clear shortcuts
2. **Date range** — preset buttons (Today, This Week, Last Week, Last 30 Days, Last 90 Days) or custom date pickers
3. **Filters** — optional driver multi-select, route multi-select, completion status (All / Complete / Incomplete)
4. **Run** — renders results in a scrollable table with row count; **Export CSV** appears after running

---

## Display Boards

### Full board — `/display/`

Includes stat tiles, insight cards, Next Up recommendation, and full Driver KPI table.

### Slim board — `/slimdisplay/`

Shows only the **Route Assignment Recommendation** (Next Up) and **Driver KPI table**. Designed for smaller screens or a dedicated assignment monitor.

Both boards:
- No login required
- Auto-refresh every 60 seconds
- Excluded routes are filtered from all stats and averages
- Notes display as always-visible amber bars beneath each driver row

---

## Admin Settings (Admin role only)

### 💾 Backup & Restore tab

**Download Backup** — JSON snapshot of all operational data (no passwords).

**Restore from Backup** — upload a backup file; shows record counts before committing; irreversible.

**Erase All Data** — three-step confirmation including typing `ERASE`; permanently deletes all route logs, pack-outs, and clock logs; employees, routes, and users are kept.

### 👤 Users tab

| Role | Access |
|---|---|
| **Admin** | Full access including Reports, Admin Settings, Driver ID |
| **User** | Route log data entry, dashboard, routes, employees |

Guards: cannot delete own account, cannot delete last admin, cannot remove own admin role.
