const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // ── GET /api/backup ───────────────────────────────────────────────────────
  router.get('/', async (req, res) => {
    try {
      const [employees, routes, routeLogs, packOuts, additionalRoutes, clockLogs] = await Promise.all([
        pool.query('SELECT * FROM employees ORDER BY id'),
        pool.query('SELECT * FROM routes ORDER BY id'),
        pool.query('SELECT * FROM route_logs ORDER BY id'),
        pool.query('SELECT * FROM pack_out_logs ORDER BY id'),
        pool.query('SELECT * FROM additional_route_logs ORDER BY id'),
        pool.query('SELECT * FROM clock_logs ORDER BY id'),
      ]);

      const backup = {
        version: 1,
        created_at: new Date().toISOString(),
        tables: {
          employees:            employees.rows,
          routes:               routes.rows,
          route_logs:           routeLogs.rows,
          pack_out_logs:        packOuts.rows,
          additional_route_logs: additionalRoutes.rows,
          clock_logs:           clockLogs.rows,
        }
      };

      const filename = `wastekpi-backup-${new Date().toISOString().slice(0, 10)}.json`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/json');
      res.json(backup);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── POST /api/backup/restore ──────────────────────────────────────────────
  router.post('/restore', async (req, res) => {
    const { backup } = req.body;
    if (!backup || backup.version !== 1 || !backup.tables)
      return res.status(400).json({ error: 'Invalid backup file format' });

    const { employees, routes, route_logs, pack_out_logs, additional_route_logs, clock_logs } = backup.tables;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // FK-safe delete order
      await client.query('DELETE FROM additional_route_logs');
      await client.query('DELETE FROM pack_out_logs');
      await client.query('DELETE FROM clock_logs');
      await client.query('DELETE FROM route_logs');
      await client.query('DELETE FROM employees');
      await client.query('DELETE FROM routes');

      // ── employees ──────────────────────────────────────────────────────────
      if (employees?.length) {
        for (const r of employees) {
          await client.query(
            `INSERT INTO employees
               (id, name, employee_number, driver_id, position, active, exclude_from_next_up, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (id) DO UPDATE SET
               name=EXCLUDED.name, employee_number=EXCLUDED.employee_number,
               driver_id=EXCLUDED.driver_id, position=EXCLUDED.position,
               active=EXCLUDED.active, exclude_from_next_up=EXCLUDED.exclude_from_next_up`,
            [r.id, r.name, r.employee_number||null, r.driver_id||null,
             r.position||null, r.active!==false, r.exclude_from_next_up===true, r.created_at||new Date()]
          );
        }
        await client.query(`SELECT setval('employees_id_seq', $1)`, [Math.max(...employees.map(r=>r.id))]);
      }

      // ── routes ─────────────────────────────────────────────────────────────
      if (routes?.length) {
        for (const r of routes) {
          await client.query(
            `INSERT INTO routes (id, route_name, description, area, active, excluded, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (id) DO UPDATE SET
               route_name=EXCLUDED.route_name, description=EXCLUDED.description,
               area=EXCLUDED.area, active=EXCLUDED.active, excluded=EXCLUDED.excluded`,
            [r.id, r.route_name, r.description||null, r.area||null,
             r.active!==false, r.excluded===true, r.created_at||new Date()]
          );
        }
        await client.query(`SELECT setval('routes_id_seq', $1)`, [Math.max(...routes.map(r=>r.id))]);
      }

      // ── route_logs ─────────────────────────────────────────────────────────
      if (route_logs?.length) {
        for (const r of route_logs) {
          await client.query(
            `INSERT INTO route_logs
               (id, employee_id, log_date, route_number, punch_in, first_stop_time,
                route_complete_time, to_yard_time, punch_out, notes, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             ON CONFLICT (id) DO UPDATE SET
               employee_id=EXCLUDED.employee_id, log_date=EXCLUDED.log_date,
               route_number=EXCLUDED.route_number, punch_in=EXCLUDED.punch_in,
               first_stop_time=EXCLUDED.first_stop_time,
               route_complete_time=EXCLUDED.route_complete_time,
               to_yard_time=EXCLUDED.to_yard_time,
               punch_out=EXCLUDED.punch_out, notes=EXCLUDED.notes`,
            [r.id, r.employee_id, r.log_date, r.route_number||null,
             r.punch_in||null, r.first_stop_time||null, r.route_complete_time||null,
             r.to_yard_time||null, r.punch_out||null, r.notes||null,
             r.created_at||new Date(), r.updated_at||new Date()]
          );
        }
        await client.query(`SELECT setval('route_logs_id_seq', $1)`, [Math.max(...route_logs.map(r=>r.id))]);
      }

      // ── pack_out_logs ──────────────────────────────────────────────────────
      if (pack_out_logs?.length) {
        for (const r of pack_out_logs) {
          await client.query(
            `INSERT INTO pack_out_logs
               (id, route_log_id, seq, pack_out_time, back_on_route_time, location, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (id) DO UPDATE SET
               route_log_id=EXCLUDED.route_log_id, seq=EXCLUDED.seq,
               pack_out_time=EXCLUDED.pack_out_time,
               back_on_route_time=EXCLUDED.back_on_route_time, location=EXCLUDED.location`,
            [r.id, r.route_log_id, r.seq||1, r.pack_out_time||null,
             r.back_on_route_time||null, r.location||null, r.created_at||new Date()]
          );
        }
        await client.query(`SELECT setval('pack_out_logs_id_seq', $1)`, [Math.max(...pack_out_logs.map(r=>r.id))]);
      }

      // ── additional_route_logs ──────────────────────────────────────────────
      if (additional_route_logs?.length) {
        for (const r of additional_route_logs) {
          await client.query(
            `INSERT INTO additional_route_logs
               (id, route_log_id, seq, route_number, first_stop_time, route_complete_time, notes, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (id) DO UPDATE SET
               route_log_id=EXCLUDED.route_log_id, seq=EXCLUDED.seq,
               route_number=EXCLUDED.route_number,
               first_stop_time=EXCLUDED.first_stop_time,
               route_complete_time=EXCLUDED.route_complete_time,
               notes=EXCLUDED.notes`,
            [r.id, r.route_log_id, r.seq||1, r.route_number||null,
             r.first_stop_time||null, r.route_complete_time||null,
             r.notes||null, r.created_at||new Date()]
          );
        }
        await client.query(`SELECT setval('additional_route_logs_id_seq', $1)`, [Math.max(...additional_route_logs.map(r=>r.id))]);
      }

      // ── clock_logs ─────────────────────────────────────────────────────────
      if (clock_logs?.length) {
        for (const r of clock_logs) {
          await client.query(
            `INSERT INTO clock_logs
               (id, employee_id, log_date, clock_in, clock_out, notes, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (id) DO UPDATE SET
               employee_id=EXCLUDED.employee_id, log_date=EXCLUDED.log_date,
               clock_in=EXCLUDED.clock_in, clock_out=EXCLUDED.clock_out, notes=EXCLUDED.notes`,
            [r.id, r.employee_id, r.log_date, r.clock_in||null, r.clock_out||null,
             r.notes||null, r.created_at||new Date(), r.updated_at||new Date()]
          );
        }
        await client.query(`SELECT setval('clock_logs_id_seq', $1)`, [Math.max(...clock_logs.map(r=>r.id))]);
      }

      await client.query('COMMIT');
      res.json({
        success: true,
        restored: {
          employees:             employees?.length || 0,
          routes:                routes?.length || 0,
          route_logs:            route_logs?.length || 0,
          pack_out_logs:         pack_out_logs?.length || 0,
          additional_route_logs: additional_route_logs?.length || 0,
          clock_logs:            clock_logs?.length || 0,
        }
      });
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: e.message });
    } finally { client.release(); }
  });

  // ── POST /api/backup/erase ────────────────────────────────────────────────
  router.post('/erase', async (req, res) => {
    if (req.user?.role !== 'admin')
      return res.status(403).json({ error: 'Admin role required' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM additional_route_logs');
      await client.query('DELETE FROM pack_out_logs');
      await client.query('DELETE FROM clock_logs');
      await client.query('DELETE FROM route_logs');
      await client.query(`SELECT setval('route_logs_id_seq', 1, false)`);
      await client.query(`SELECT setval('pack_out_logs_id_seq', 1, false)`);
      await client.query(`SELECT setval('additional_route_logs_id_seq', 1, false)`);
      await client.query(`SELECT setval('clock_logs_id_seq', 1, false)`);
      await client.query('COMMIT');
      res.json({ success: true, message: 'All route log data erased' });
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: e.message });
    } finally { client.release(); }
  });

  return router;
};
