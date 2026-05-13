const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getMondayOfWeek(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
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

  router.get('/friday-hours', async (req, res) => {
    const weekOf = req.query.week_of || new Date().toISOString().split('T')[0];
    const fmt    = req.query.format;
    const monday    = getMondayOfWeek(weekOf);
    const tuesday   = addDays(monday, 1);
    const wednesday = addDays(monday, 2);
    const thursday  = addDays(monday, 3);

    try {
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

      const driverMap = {};
      for (const row of result.rows) {
        if (!driverMap[row.employee_id]) {
          driverMap[row.employee_id] = {
            employee_id: row.employee_id, employee_name: row.employee_name,
            monday_mins: null, tuesday_mins: null, wednesday_mins: null, thursday_mins: null,
            days_worked: 0, total_mins: 0,
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
        if (mins !== null) { d.days_worked++; d.total_mins += mins; }
      }

      const rows = Object.values(driverMap).sort((a, b) => {
        if (b.total_mins !== a.total_mins) return b.total_mins - a.total_mins;
        return a.employee_name.localeCompare(b.employee_name);
      });

      const formatted = rows.map(r => ({
        employee_name: r.employee_name,
        monday:        minsToHm(r.monday_mins),
        tuesday:       minsToHm(r.tuesday_mins),
        wednesday:     minsToHm(r.wednesday_mins),
        thursday:      minsToHm(r.thursday_mins),
        total_hours:   minsToHm(r.total_mins) || '—',
        total_mins:    r.total_mins,
        days_worked:   r.days_worked,
      }));

      if (fmt === 'csv') {
        const headers = ['employee_name', 'monday', 'tuesday', 'wednesday', 'thursday', 'total_hours', 'days_worked'];
        const csv = rowsToCsv(headers, formatted);
        res.setHeader('Content-Disposition', `attachment; filename="friday-hours-${monday}.csv"`);
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csv);
      }

      res.json({ week_of: weekOf, monday, tuesday, wednesday, thursday, rows: formatted });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── GET /api/reports/route-duration ───────────────────────────────────────
  // Calculates first_stop_time → route_complete_time for each route.
  // Combines primary route_logs AND additional_route_logs so drivers running
  // extra routes are counted correctly.
  // Query params:
  //   date_from, date_to  — YYYY-MM-DD (required)
  //   route_numbers[]     — optional filter
  //   format              — 'csv' for download

  router.get('/route-duration', async (req, res) => {
    const { date_from, date_to, format } = req.query;
    const routeNumbers = req.query['route_numbers[]']
      ? [].concat(req.query['route_numbers[]'])
      : [];

    if (!date_from || !date_to) {
      return res.status(400).json({ error: 'date_from and date_to are required' });
    }

    try {
      // Build union of primary + additional route durations
      // Primary: first_stop_time / route_complete_time from route_logs
      // Additional: first_stop_time / route_complete_time from additional_route_logs
      const params = [date_from, date_to];
      let routeFilter = '';
      if (routeNumbers.length > 0) {
        params.push(routeNumbers);
        routeFilter = `AND route_number = ANY($${params.length})`;
      }

      const result = await pool.query(`
        WITH all_runs AS (
          -- Primary route assignments
          SELECT
            rl.log_date,
            rl.route_number,
            e.name AS employee_name,
            rl.first_stop_time,
            rl.route_complete_time,
            CASE
              WHEN rl.first_stop_time IS NOT NULL AND rl.route_complete_time IS NOT NULL
              THEN ROUND(EXTRACT(EPOCH FROM (rl.route_complete_time - rl.first_stop_time)) / 60.0)
              ELSE NULL
            END AS duration_mins
          FROM route_logs rl
          JOIN employees e ON e.id = rl.employee_id
          WHERE rl.log_date BETWEEN $1 AND $2
            AND rl.route_number IS NOT NULL
            ${routeFilter}

          UNION ALL

          -- Additional route assignments
          SELECT
            rl.log_date,
            ar.route_number,
            e.name AS employee_name,
            ar.first_stop_time,
            ar.route_complete_time,
            CASE
              WHEN ar.first_stop_time IS NOT NULL AND ar.route_complete_time IS NOT NULL
              THEN ROUND(EXTRACT(EPOCH FROM (ar.route_complete_time - ar.first_stop_time)) / 60.0)
              ELSE NULL
            END AS duration_mins
          FROM additional_route_logs ar
          JOIN route_logs rl ON rl.id = ar.route_log_id
          JOIN employees e ON e.id = rl.employee_id
          WHERE rl.log_date BETWEEN $1 AND $2
            AND ar.route_number IS NOT NULL
            ${routeFilter}
        )
        SELECT
          route_number,
          COUNT(*) AS total_runs,
          COUNT(duration_mins) AS timed_runs,
          ROUND(AVG(duration_mins)::numeric, 1) AS avg_mins,
          MIN(duration_mins) AS fastest_mins,
          MAX(duration_mins) AS slowest_mins,
          -- Per-driver breakdown as JSON array
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'employee_name', employee_name,
              'log_date',      log_date,
              'first_stop',    first_stop_time,
              'route_complete', route_complete_time,
              'duration_mins', duration_mins
            ) ORDER BY log_date, employee_name
          ) AS runs
        FROM all_runs
        GROUP BY route_number
        ORDER BY avg_mins DESC NULLS LAST, route_number
      `, params);

      const rows = result.rows.map(r => ({
        route_number:  r.route_number,
        total_runs:    parseInt(r.total_runs),
        timed_runs:    parseInt(r.timed_runs),
        avg_duration:  minsToHm(r.avg_mins),
        avg_mins:      r.avg_mins ? parseFloat(r.avg_mins) : null,
        fastest:       minsToHm(r.fastest_mins),
        fastest_mins:  r.fastest_mins ? parseFloat(r.fastest_mins) : null,
        slowest:       minsToHm(r.slowest_mins),
        slowest_mins:  r.slowest_mins ? parseFloat(r.slowest_mins) : null,
        runs:          r.runs || [],
      }));

      if (format === 'csv') {
        // Flatten for CSV — one row per run
        const csvRows = [];
        for (const route of rows) {
          for (const run of route.runs) {
            csvRows.push({
              route_number:   route.route_number,
              log_date:       run.log_date ? String(run.log_date).slice(0, 10) : '',
              employee_name:  run.employee_name,
              first_stop:     run.first_stop ? String(run.first_stop).slice(0, 5) : '',
              route_complete: run.route_complete ? String(run.route_complete).slice(0, 5) : '',
              duration:       minsToHm(run.duration_mins) || '',
              duration_mins:  run.duration_mins || '',
            });
          }
        }
        const headers = ['route_number', 'log_date', 'employee_name', 'first_stop', 'route_complete', 'duration', 'duration_mins'];
        const csv = rowsToCsv(headers, csvRows);
        res.setHeader('Content-Disposition', `attachment; filename="route-duration-${date_from}-to-${date_to}.csv"`);
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csv);
      }

      res.json({ date_from, date_to, row_count: rows.length, rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── POST /api/reports/custom ──────────────────────────────────────────────

  const ALLOWED_COLUMNS = [
    'employee_name', 'log_date', 'route_number', 'route_area',
    'punch_in', 'first_stop_time', 'route_complete_time', 'to_yard_time', 'punch_out',
    'day_length', 'pack_out_count', 'notes',
  ];

  router.post('/custom', async (req, res) => {
    const {
      columns       = ALLOWED_COLUMNS,
      date_from,
      date_to,
      driver_ids    = [],
      route_numbers = [],
      status        = 'all',
      format        = 'json',
    } = req.body;

    if (!date_from || !date_to)
      return res.status(400).json({ error: 'date_from and date_to are required' });

    const selectedCols = columns.filter(c => ALLOWED_COLUMNS.includes(c));
    if (selectedCols.length === 0)
      return res.status(400).json({ error: 'No valid columns selected' });

    try {
      const params = [date_from, date_to];
      const conditions = ['rl.log_date BETWEEN $1 AND $2'];

      if (driver_ids.length > 0) {
        params.push(driver_ids);
        conditions.push(`rl.employee_id = ANY($${params.length}::int[])`);
      }
      if (route_numbers.length > 0) {
        params.push(route_numbers);
        conditions.push(`rl.route_number = ANY($${params.length})`);
      }
      if (status === 'complete')   conditions.push('rl.punch_out IS NOT NULL');
      if (status === 'incomplete') conditions.push('rl.punch_out IS NULL');

      const result = await pool.query(`
        SELECT
          rl.id, e.name AS employee_name, rl.log_date,
          rl.route_number, rt.area AS route_area,
          rl.punch_in, rl.first_stop_time, rl.route_complete_time,
          rl.to_yard_time, rl.punch_out,
          CASE
            WHEN rl.punch_in IS NOT NULL AND rl.punch_out IS NOT NULL
            THEN ROUND(EXTRACT(EPOCH FROM (rl.punch_out - rl.punch_in)) / 3600.0, 2)
            ELSE NULL
          END AS day_length_hours,
          (SELECT COUNT(*) FROM pack_out_logs pol WHERE pol.route_log_id = rl.id) AS pack_out_count,
          rl.notes
        FROM route_logs rl
        JOIN employees e ON e.id = rl.employee_id
        LEFT JOIN routes rt ON rt.route_name = rl.route_number
        WHERE ${conditions.join(' AND ')}
        ORDER BY rl.log_date, e.name
      `, params);

      const fmtTime = (t) => {
        if (!t) return null;
        const s = String(t).slice(0, 5);
        const [h, m] = s.split(':').map(Number);
        return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
      };
      const fmtDate = (d) => d ? String(d).slice(0, 10) : null;
      const fmtDayLen = (hours) => {
        if (!hours) return null;
        const h = parseFloat(hours);
        return `${Math.floor(h)}h ${Math.round((h - Math.floor(h)) * 60)}m`;
      };

      const colMap = {
        employee_name:       r => r.employee_name,
        log_date:            r => fmtDate(r.log_date),
        route_number:        r => r.route_number || null,
        route_area:          r => r.route_area || null,
        punch_in:            r => fmtTime(r.punch_in),
        first_stop_time:     r => fmtTime(r.first_stop_time),
        route_complete_time: r => fmtTime(r.route_complete_time),
        to_yard_time:        r => fmtTime(r.to_yard_time),
        punch_out:           r => fmtTime(r.punch_out),
        day_length:          r => fmtDayLen(r.day_length_hours),
        pack_out_count:      r => parseInt(r.pack_out_count) || 0,
        notes:               r => r.notes || null,
      };

      const rows = result.rows.map(r => {
        const out = {};
        for (const col of selectedCols) out[col] = colMap[col]?.(r) ?? null;
        return out;
      });

      if (format === 'csv') {
        const csv = rowsToCsv(selectedCols, rows);
        res.setHeader('Content-Disposition', `attachment; filename="report-${date_from}-to-${date_to}.csv"`);
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csv);
      }

      res.json({ columns: selectedCols, date_from, date_to, row_count: rows.length, rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
