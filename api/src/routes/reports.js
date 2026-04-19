const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Get Monday of the week containing the given date string (YYYY-MM-DD)
  function getMondayOfWeek(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay(); // 0=Sun, 1=Mon...
    const diff = day === 0 ? -6 : 1 - day; // adjust so Mon=0
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }

  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  }

  function minsToHm(mins) {
    if (mins === null || mins === undefined) return null;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}m`;
  }

  function rowsToCsv(headers, rows) {
    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.map(escape).join(','),
      ...rows.map(r => headers.map(h => escape(r[h])).join(','))
    ];
    return lines.join('\r\n');
  }

  // ── GET /api/reports/friday-hours ─────────────────────────────────────────
  // Returns Mon–Thu hours for each driver for the week containing week_of.
  // Sorted by total_mins DESC (most hours worked first).
  // Query param: week_of=YYYY-MM-DD (any date in the target week)
  // Query param: format=csv for CSV download

  router.get('/friday-hours', async (req, res) => {
    const weekOf = req.query.week_of || new Date().toISOString().split('T')[0];
    const fmt = req.query.format; // 'csv' or omit for json

    const monday = getMondayOfWeek(weekOf);
    const tuesday  = addDays(monday, 1);
    const wednesday = addDays(monday, 2);
    const thursday  = addDays(monday, 3);

    try {
      // Pull Mon–Thu logs for all active employees
      const result = await pool.query(`
        SELECT
          e.id           AS employee_id,
          e.name         AS employee_name,
          rl.log_date,
          CASE
            WHEN rl.punch_in IS NOT NULL AND rl.punch_out IS NOT NULL
            THEN ROUND(EXTRACT(EPOCH FROM (rl.punch_out - rl.punch_in)) / 60.0)
            ELSE NULL
          END AS day_mins,
          rl.punch_in,
          rl.punch_out
        FROM employees e
        LEFT JOIN route_logs rl
          ON rl.employee_id = e.id
         AND rl.log_date IN ($1, $2, $3, $4)
        WHERE e.active = TRUE
        ORDER BY e.name, rl.log_date
      `, [monday, tuesday, wednesday, thursday]);

      // Pivot into per-driver rows
      const driverMap = {};
      for (const row of result.rows) {
        if (!driverMap[row.employee_id]) {
          driverMap[row.employee_id] = {
            employee_id:   row.employee_id,
            employee_name: row.employee_name,
            monday_mins:    null,
            tuesday_mins:   null,
            wednesday_mins: null,
            thursday_mins:  null,
            days_worked:    0,
            total_mins:     0,
          };
        }
        const d = driverMap[row.employee_id];
        if (!row.log_date) continue;
        const dateStr = row.log_date.toISOString
          ? row.log_date.toISOString().split('T')[0]
          : String(row.log_date).slice(0, 10);
        const mins = row.day_mins !== null ? parseFloat(row.day_mins) : null;

        if (dateStr === monday)     d.monday_mins    = mins;
        if (dateStr === tuesday)    d.tuesday_mins   = mins;
        if (dateStr === wednesday)  d.wednesday_mins = mins;
        if (dateStr === thursday)   d.thursday_mins  = mins;

        if (mins !== null) {
          d.days_worked++;
          d.total_mins += mins;
        }
      }

      // Sort: most total_mins first, then alpha
      const rows = Object.values(driverMap).sort((a, b) => {
        if (b.total_mins !== a.total_mins) return b.total_mins - a.total_mins;
        return a.employee_name.localeCompare(b.employee_name);
      });

      // Attach formatted strings
      const formatted = rows.map(r => ({
        employee_name:  r.employee_name,
        monday:         minsToHm(r.monday_mins),
        tuesday:        minsToHm(r.tuesday_mins),
        wednesday:      minsToHm(r.wednesday_mins),
        thursday:       minsToHm(r.thursday_mins),
        total_hours:    minsToHm(r.total_mins) || '—',
        total_mins:     r.total_mins,
        days_worked:    r.days_worked,
      }));

      if (fmt === 'csv') {
        const headers = ['employee_name', 'monday', 'tuesday', 'wednesday', 'thursday', 'total_hours', 'days_worked'];
        const csv = rowsToCsv(headers, formatted);
        const filename = `friday-hours-${monday}.csv`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csv);
      }

      res.json({
        week_of:    weekOf,
        monday,
        tuesday,
        wednesday,
        thursday,
        rows:       formatted,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── POST /api/reports/custom ──────────────────────────────────────────────
  // Flexible report builder.
  // Body: {
  //   columns:        string[]   — which fields to include
  //   date_from:      YYYY-MM-DD
  //   date_to:        YYYY-MM-DD
  //   driver_ids:     number[]   — empty = all
  //   route_numbers:  string[]   — empty = all
  //   status:         'all' | 'complete' | 'incomplete'
  //   format:         'json' | 'csv'
  // }

  const ALLOWED_COLUMNS = [
    'employee_name',
    'log_date',
    'route_number',
    'route_area',
    'punch_in',
    'first_stop_time',
    'route_complete_time',
    'to_yard_time',
    'punch_out',
    'day_length',
    'pack_out_count',
    'notes',
  ];

  router.post('/custom', async (req, res) => {
    const {
      columns     = ALLOWED_COLUMNS,
      date_from,
      date_to,
      driver_ids  = [],
      route_numbers = [],
      status      = 'all',
      format      = 'json',
    } = req.body;

    if (!date_from || !date_to) {
      return res.status(400).json({ error: 'date_from and date_to are required' });
    }

    // Sanitise column list — only allow known column names
    const selectedCols = columns.filter(c => ALLOWED_COLUMNS.includes(c));
    if (selectedCols.length === 0) {
      return res.status(400).json({ error: 'No valid columns selected' });
    }

    try {
      const params = [date_from, date_to];
      const conditions = ['rl.log_date BETWEEN $1 AND $2'];

      // Driver filter
      if (driver_ids.length > 0) {
        params.push(driver_ids);
        conditions.push(`rl.employee_id = ANY($${params.length}::int[])`);
      }

      // Route filter
      if (route_numbers.length > 0) {
        params.push(route_numbers);
        conditions.push(`rl.route_number = ANY($${params.length})`);
      }

      // Status filter
      if (status === 'complete') {
        conditions.push('rl.punch_out IS NOT NULL');
      } else if (status === 'incomplete') {
        conditions.push('rl.punch_out IS NULL');
      }

      const whereClause = conditions.join(' AND ');

      const result = await pool.query(`
        SELECT
          rl.id,
          e.name            AS employee_name,
          rl.log_date,
          rl.route_number,
          rt.area           AS route_area,
          rl.punch_in,
          rl.first_stop_time,
          rl.route_complete_time,
          rl.to_yard_time,
          rl.punch_out,
          CASE
            WHEN rl.punch_in IS NOT NULL AND rl.punch_out IS NOT NULL
            THEN ROUND(EXTRACT(EPOCH FROM (rl.punch_out - rl.punch_in)) / 3600.0, 2)
            ELSE NULL
          END AS day_length_hours,
          CASE
            WHEN rl.punch_in IS NOT NULL AND rl.punch_out IS NOT NULL
            THEN (
              EXTRACT(EPOCH FROM (rl.punch_out - rl.punch_in)) / 3600.0
            )::text
            ELSE NULL
          END AS day_length_raw,
          (SELECT COUNT(*) FROM pack_out_logs pol WHERE pol.route_log_id = rl.id) AS pack_out_count,
          rl.notes
        FROM route_logs rl
        JOIN employees e ON e.id = rl.employee_id
        LEFT JOIN routes rt ON rt.route_name = rl.route_number
        WHERE ${whereClause}
        ORDER BY rl.log_date, e.name
      `, params);

      // Format each row — convert times to readable strings and pick selected columns
      const fmt = (t) => {
        if (!t) return null;
        const s = String(t).slice(0, 5);
        const [h, m] = s.split(':').map(Number);
        return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
      };

      const fmtDate = (d) => {
        if (!d) return null;
        return String(d).slice(0, 10);
      };

      const fmtDayLen = (hours) => {
        if (hours === null || hours === undefined) return null;
        const h = parseFloat(hours);
        const hh = Math.floor(h);
        const mm = Math.round((h - hh) * 60);
        return `${hh}h ${mm}m`;
      };

      const colMap = {
        employee_name:       r => r.employee_name,
        log_date:            r => fmtDate(r.log_date),
        route_number:        r => r.route_number || null,
        route_area:          r => r.route_area || null,
        punch_in:            r => fmt(r.punch_in),
        first_stop_time:     r => fmt(r.first_stop_time),
        route_complete_time: r => fmt(r.route_complete_time),
        to_yard_time:        r => fmt(r.to_yard_time),
        punch_out:           r => fmt(r.punch_out),
        day_length:          r => fmtDayLen(r.day_length_hours),
        pack_out_count:      r => parseInt(r.pack_out_count) || 0,
        notes:               r => r.notes || null,
      };

      const rows = result.rows.map(r => {
        const out = {};
        for (const col of selectedCols) {
          out[col] = colMap[col] ? colMap[col](r) : null;
        }
        return out;
      });

      if (format === 'csv') {
        const csv = rowsToCsv(selectedCols, rows);
        const filename = `report-${date_from}-to-${date_to}.csv`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csv);
      }

      res.json({
        columns:   selectedCols,
        date_from,
        date_to,
        row_count: rows.length,
        rows,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
