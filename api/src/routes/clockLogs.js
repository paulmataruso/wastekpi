const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const { date, from, to } = req.query;
    try {
      let query, params;
      if (date) {
        query = `
          SELECT cl.*, e.name as employee_name, e.employee_number, e.position
          FROM clock_logs cl
          JOIN employees e ON e.id = cl.employee_id
          WHERE cl.log_date = $1
          ORDER BY e.name`;
        params = [date];
      } else if (from && to) {
        query = `
          SELECT cl.*, e.name as employee_name, e.employee_number, e.position
          FROM clock_logs cl
          JOIN employees e ON e.id = cl.employee_id
          WHERE cl.log_date BETWEEN $1 AND $2
          ORDER BY cl.log_date DESC, e.name`;
        params = [from, to];
      } else {
        query = `
          SELECT cl.*, e.name as employee_name, e.employee_number, e.position
          FROM clock_logs cl
          JOIN employees e ON e.id = cl.employee_id
          ORDER BY cl.log_date DESC, e.name
          LIMIT 100`;
        params = [];
      }
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/', async (req, res) => {
    const { employee_id, log_date, clock_in, clock_out, notes } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO clock_logs (employee_id, log_date, clock_in, clock_out, notes)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (employee_id, log_date) DO UPDATE SET
           clock_in=EXCLUDED.clock_in, clock_out=EXCLUDED.clock_out,
           notes=EXCLUDED.notes, updated_at=NOW()
         RETURNING *`,
        [employee_id, log_date, clock_in || null, clock_out || null, notes]
      );
      res.status(201).json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.put('/:id', async (req, res) => {
    const { clock_in, clock_out, notes } = req.body;
    try {
      const result = await pool.query(
        `UPDATE clock_logs SET clock_in=$1, clock_out=$2, notes=$3, updated_at=NOW()
         WHERE id=$4 RETURNING *`,
        [clock_in || null, clock_out || null, notes, req.params.id]
      );
      res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM clock_logs WHERE id=$1', [req.params.id]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
