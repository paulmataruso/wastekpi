const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // GET /api/pack-outs?route_log_id=X
  router.get('/', async (req, res) => {
    const { route_log_id } = req.query;
    if (!route_log_id) return res.status(400).json({ error: 'route_log_id required' });
    try {
      const result = await pool.query(
        'SELECT * FROM pack_out_logs WHERE route_log_id=$1 ORDER BY seq',
        [route_log_id]
      );
      res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/pack-outs
  router.post('/', async (req, res) => {
    const { route_log_id, seq, pack_out_time, back_on_route_time } = req.body;
    if (!route_log_id) return res.status(400).json({ error: 'route_log_id required' });
    try {
      const result = await pool.query(
        `INSERT INTO pack_out_logs (route_log_id, seq, pack_out_time, back_on_route_time)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [route_log_id, seq || 1, pack_out_time || null, back_on_route_time || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // PUT /api/pack-outs/:id
  router.put('/:id', async (req, res) => {
    const { pack_out_time, back_on_route_time } = req.body;
    try {
      const result = await pool.query(
        `UPDATE pack_out_logs SET pack_out_time=$1, back_on_route_time=$2
         WHERE id=$3 RETURNING *`,
        [pack_out_time || null, back_on_route_time || null, req.params.id]
      );
      res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // DELETE /api/pack-outs/:id
  router.delete('/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM pack_out_logs WHERE id=$1', [req.params.id]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
