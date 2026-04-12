const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM employees ORDER BY name');
      res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/', async (req, res) => {
    const { name, employee_number, position } = req.body;
    try {
      const result = await pool.query(
        'INSERT INTO employees (name, employee_number, position) VALUES ($1,$2,$3) RETURNING *',
        [name, employee_number, position]
      );
      res.status(201).json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.put('/:id', async (req, res) => {
    const { name, employee_number, position, active } = req.body;
    try {
      const result = await pool.query(
        'UPDATE employees SET name=$1, employee_number=$2, position=$3, active=$4 WHERE id=$5 RETURNING *',
        [name, employee_number, position, active, req.params.id]
      );
      res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM employees WHERE id=$1', [req.params.id]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
