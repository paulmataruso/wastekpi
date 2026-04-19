const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // GET /api/routes
  // ?all=true returns every route including excluded ones (for management page)
  // default returns only active + non-excluded (for data entry dropdowns)
  router.get('/', async (req, res) => {
    try {
      const showAll = req.query.all === 'true';
      const query = showAll
        ? 'SELECT * FROM routes ORDER BY route_name'
        : 'SELECT * FROM routes WHERE active = TRUE ORDER BY route_name';
      const result = await pool.query(query);
      res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/', async (req, res) => {
    const { route_name, description, area, excluded } = req.body;
    try {
      const result = await pool.query(
        'INSERT INTO routes (route_name, description, area, excluded) VALUES ($1,$2,$3,$4) RETURNING *',
        [route_name, description, area, excluded || false]
      );
      res.status(201).json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.put('/:id', async (req, res) => {
    const { route_name, description, area, active, excluded } = req.body;
    try {
      const result = await pool.query(
        'UPDATE routes SET route_name=$1, description=$2, area=$3, active=$4, excluded=$5 WHERE id=$6 RETURNING *',
        [route_name, description, area, active, excluded === true, req.params.id]
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
