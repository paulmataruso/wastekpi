# User Guide

## Logging In

Navigate to `http://your-host/admin/` and enter your username and password. Contact your admin if you don't have an account.

---

## Admin Portal Overview

The sidebar has five sections:

| Link | Purpose |
|---|---|
| ⬡ Dashboard | Daily and weekly summary stats |
| 🚛 Route Logs | Main data entry page |
| 🗺 Routes | Manage route names and area tags |
| 👷 Employees | Manage driver roster |
| ⚙ Admin Settings | Backup, restore, erase data, user accounts (admin only) |

---

## Route Logs — Data Entry

This is the main daily workflow. Select a date using the ← / → navigation arrows at the top right.

### Form Mode (default)

Click **+ Add Entry** to open a modal form. Fill in:

- **Driver** — select from the dropdown (only shows drivers not yet logged for this date)
- **Route #** — optional, select from your configured routes
- **Times** — Punch In, 1st Stop, Route Complete, Punch Out (the Day Length calculates automatically)
- **Pack Out Events** — click "+ Add Pack Out" for each dump run; enter the time the driver left for the dump and the time they returned
- **Notes** — any free text notes about the route, delays, incidents, etc.

Click **Save**. To edit an entry later, click the ✏️ icon in the table row.

### Inline Mode (Excel-style)

Click the **⊞ Inline** toggle in the header toolbar. The table switches to direct editing:

- **New row at top** (green highlight) — select a driver from the dropdown, fill in times using the clock picker, click **✓ Add** or press Enter
- **Edit existing rows** — click anywhere on a row to open it for editing in-place; press Enter to save or Escape to cancel
- **Pack-out events** — click the **+ Dumps** button in any row to open a popover for adding/editing dump runs
- **Time picker** — clicking any time field opens a dropdown with scrollable Hour, Minute, and AM/PM columns; click a value to select it

---

## Time Picker

When using Inline mode, clicking any time field opens a custom time picker:

- **HR column** — click the hour (1–12)
- **MIN column** — click the minute in 5-minute increments (00, 05, 10, ... 55)
- **AM/PM column** — click AM or PM
- The selected values highlight in green
- Click the **×** button to clear the time
- Press **Escape** to close without saving a row

---

## Import / Export

### Export

Click **↓ Export** to download a `.csv` file of the currently displayed date's data. The CSV includes columns for all time fields plus pack-out event columns (`Pack Out 1`, `Back On Route 1`, `Pack Out 2`, etc.) dynamically sized to the maximum number of dump runs on that day.

### Import

Click **↑ Import** to upload a CSV file. The importer:

- Matches drivers by name (case-insensitive)
- Upserts on `(driver, date)` — existing records are updated, new ones are created
- Auto-detects `Pack Out N` / `Back On Route N` column pairs
- Shows a preview before committing

---

## Routes Management

Go to **🗺 Routes** to add, edit, or deactivate routes.

- **Route Name** — the identifier that appears in dropdowns and on the display board (e.g. "Route 1")
- **Area** — a short geographic label shown as a blue badge on both the admin table and display board (e.g. "North", "Hillside", "Industrial")
- Inactive routes are hidden from the data entry dropdown but their historical data is preserved

---

## Employees Management

Go to **👷 Employees** to manage the driver roster.

- Inactive employees are hidden from data entry dropdowns
- Historical data for inactive employees is preserved
- Employee Number and Position fields are optional

---

## Display Board

Navigate to `http://your-host/display/` on any screen, browser, or TV you want to use as a live display. No login is required.

The display board refreshes automatically every 60 seconds and shows:

- **Stat tiles row** — Routes Complete, In Progress, Punched In, Longest Avg Route (7d/30d), Avg Day Length, Avg Route Time
- **Avg Clock Times** and **Avg Punch In → 1st Stop** (7d and 30d averages)
- **Route Assignment Recommendation (Next Up)** — left panel showing which driver has the least time on the clock and is best positioned for a new route assignment
- **Driver Route KPIs table** — all drivers logged today, sorted fastest → slowest by 7-day average route time; notes display in an amber bar beneath each driver's row

---

## Admin Settings (Admin role only)

### 💾 Backup & Restore tab

**Download Backup** — creates a `wastekpi-backup-YYYY-MM-DD.json` file you can save to a safe location. Contains all operational data (employees, routes, logs) but not user passwords.

**Restore from Backup** — upload a backup `.json` file. A preview shows the record counts inside the file. Confirm to replace all current data. This is irreversible.

**Erase All Data** — permanently deletes all route logs, pack-out events, and clock logs across all dates. Employees, routes, and user accounts are kept. Requires two confirmations: a first "are you sure" step, then typing the word `ERASE` exactly before the final button activates.

### 👤 Users tab

Create, edit, and delete user accounts.

| Role | Access |
|---|---|
| **Admin** | Full access including Admin Settings |
| **User** | Route log data entry, dashboard, routes, employees — no admin settings |

Safety guards:
- You cannot delete your own account
- You cannot remove your own admin role
- The last admin account cannot be deleted
