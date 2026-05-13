const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // GET /api/pack-out-locations — returns all active locations
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM pack_out_locations WHERE active = TRUE ORDER BY name'
      );
      res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/pack-out-locations — add a new location
  router.post('/', async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Location name is required' });
    }
    try {
      const result = await pool.query(
        `INSERT INTO pack_out_locations (name)
         VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET active = TRUE
         RETURNING *`,
        [name.trim()]
      );
      res.status(201).json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // DELETE /api/pack-out-locations/:id — soft delete (set active = false)
  router.delete('/:id', async (req, res) => {
    try {
      await pool.query(
        'UPDATE pack_out_locations SET active = FALSE WHERE id = $1',
        [req.params.id]
      );
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
