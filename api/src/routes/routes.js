const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM routes ORDER BY route_name');
      res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/', async (req, res) => {
    const { route_name, description, area } = req.body;
    try {
      const result = await pool.query(
        'INSERT INTO routes (route_name, description, area) VALUES ($1,$2,$3) RETURNING *',
        [route_name, description, area]
      );
      res.status(201).json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.put('/:id', async (req, res) => {
    const { route_name, description, area, active } = req.body;
    try {
      const result = await pool.query(
        'UPDATE routes SET route_name=$1, description=$2, area=$3, active=$4 WHERE id=$5 RETURNING *',
        [route_name, description, area, active, req.params.id]
      );
      res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM routes WHERE id=$1', [req.params.id]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
