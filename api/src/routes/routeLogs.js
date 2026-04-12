const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function fetchPackOuts(routeLogIds) {
    if (!routeLogIds.length) return {};
    const result = await pool.query(
      `SELECT * FROM pack_out_logs
       WHERE route_log_id = ANY($1::int[])
       ORDER BY route_log_id, seq`,
      [routeLogIds]
    );
    const map = {};
    result.rows.forEach(r => {
      if (!map[r.route_log_id]) map[r.route_log_id] = [];
      map[r.route_log_id].push(r);
    });
    return map;
  }

  async function upsertPackOuts(client, routeLogId, packOuts) {
    await client.query('DELETE FROM pack_out_logs WHERE route_log_id = $1', [routeLogId]);
    if (!Array.isArray(packOuts) || packOuts.length === 0) return;
    for (let i = 0; i < packOuts.length; i++) {
      const { pack_out_time, back_on_route_time } = packOuts[i];
      await client.query(
        `INSERT INTO pack_out_logs (route_log_id, seq, pack_out_time, back_on_route_time)
         VALUES ($1, $2, $3, $4)`,
        [routeLogId, i + 1, pack_out_time || null, back_on_route_time || null]
      );
    }
  }

  // ── GET ────────────────────────────────────────────────────────────────────

  router.get('/', async (req, res) => {
    const { date, from, to, employee_id } = req.query;
    try {
      let query, params;
      const empFilter = employee_id ? ' AND rl.employee_id = $2' : '';

      // Join routes table to pull in the area for the assigned route_number
      const routeAreaJoin = `LEFT JOIN routes rt ON rt.route_name = rl.route_number`;
      const routeAreaSelect = `, rt.area as route_area`;

      if (date) {
        query = `
          SELECT rl.*, e.name as employee_name, e.position,
            CASE
              WHEN rl.punch_in IS NOT NULL AND rl.punch_out IS NOT NULL
              THEN ROUND(EXTRACT(EPOCH FROM (rl.punch_out - rl.punch_in))/3600.0, 2)
              ELSE NULL
            END as day_length_hours
            ${routeAreaSelect}
          FROM route_logs rl
          JOIN employees e ON e.id = rl.employee_id
          ${routeAreaJoin}
          WHERE rl.log_date = $1${empFilter}
          ORDER BY e.name`;
        params = employee_id ? [date, employee_id] : [date];
      } else if (from && to) {
        query = `
          SELECT rl.*, e.name as employee_name, e.position,
            CASE
              WHEN rl.punch_in IS NOT NULL AND rl.punch_out IS NOT NULL
              THEN ROUND(EXTRACT(EPOCH FROM (rl.punch_out - rl.punch_in))/3600.0, 2)
              ELSE NULL
            END as day_length_hours
            ${routeAreaSelect}
          FROM route_logs rl
          JOIN employees e ON e.id = rl.employee_id
          ${routeAreaJoin}
          WHERE rl.log_date BETWEEN $1 AND $2
          ORDER BY rl.log_date DESC, e.name`;
        params = [from, to];
      } else {
        query = `
          SELECT rl.*, e.name as employee_name, e.position,
            CASE
              WHEN rl.punch_in IS NOT NULL AND rl.punch_out IS NOT NULL
              THEN ROUND(EXTRACT(EPOCH FROM (rl.punch_out - rl.punch_in))/3600.0, 2)
              ELSE NULL
            END as day_length_hours
            ${routeAreaSelect}
          FROM route_logs rl
          JOIN employees e ON e.id = rl.employee_id
          ${routeAreaJoin}
          ORDER BY rl.log_date DESC, e.name
          LIMIT 100`;
        params = [];
      }

      const result = await pool.query(query, params);
      const rows = result.rows;

      const packOutMap = await fetchPackOuts(rows.map(r => r.id));
      rows.forEach(r => { r.pack_outs = packOutMap[r.id] || []; });

      res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── POST ───────────────────────────────────────────────────────────────────

  router.post('/', async (req, res) => {
    const {
      employee_id, log_date, route_number,
      punch_in, first_stop_time, route_complete_time, punch_out,
      notes, pack_outs
    } = req.body;

    if (!employee_id || !log_date)
      return res.status(400).json({ error: 'employee_id and log_date are required' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO route_logs
           (employee_id, log_date, route_number, punch_in, first_stop_time, route_complete_time, punch_out, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (employee_id, log_date) DO UPDATE SET
           route_number=EXCLUDED.route_number,
           punch_in=EXCLUDED.punch_in,
           first_stop_time=EXCLUDED.first_stop_time,
           route_complete_time=EXCLUDED.route_complete_time,
           punch_out=EXCLUDED.punch_out,
           notes=EXCLUDED.notes,
           updated_at=NOW()
         RETURNING *`,
        [
          employee_id, log_date,
          route_number || null,
          punch_in || null,
          first_stop_time || null,
          route_complete_time || null,
          punch_out || null,
          notes || null
        ]
      );

      const row = result.rows[0];
      await upsertPackOuts(client, row.id, pack_outs);
      await client.query('COMMIT');

      // Fetch area for the returned row
      const areaResult = await pool.query(
        'SELECT area FROM routes WHERE route_name=$1 LIMIT 1',
        [row.route_number]
      );
      row.route_area = areaResult.rows[0]?.area || null;

      const packOutResult = await pool.query(
        'SELECT * FROM pack_out_logs WHERE route_log_id=$1 ORDER BY seq',
        [row.id]
      );
      row.pack_outs = packOutResult.rows;
      res.status(201).json(row);
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ── PUT ────────────────────────────────────────────────────────────────────

  router.put('/:id', async (req, res) => {
    const {
      route_number, punch_in, first_stop_time,
      route_complete_time, punch_out, notes, pack_outs
    } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE route_logs SET
           route_number=$1, punch_in=$2, first_stop_time=$3,
           route_complete_time=$4, punch_out=$5, notes=$6, updated_at=NOW()
         WHERE id=$7 RETURNING *`,
        [
          route_number || null,
          punch_in || null,
          first_stop_time || null,
          route_complete_time || null,
          punch_out || null,
          notes || null,
          req.params.id
        ]
      );

      const row = result.rows[0];
      await upsertPackOuts(client, row.id, pack_outs);
      await client.query('COMMIT');

      const areaResult = await pool.query(
        'SELECT area FROM routes WHERE route_name=$1 LIMIT 1',
        [row.route_number]
      );
      row.route_area = areaResult.rows[0]?.area || null;

      const packOutResult = await pool.query(
        'SELECT * FROM pack_out_logs WHERE route_log_id=$1 ORDER BY seq',
        [row.id]
      );
      row.pack_outs = packOutResult.rows;
      res.json(row);
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ── DELETE ─────────────────────────────────────────────────────────────────

  router.delete('/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM route_logs WHERE id=$1', [req.params.id]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
