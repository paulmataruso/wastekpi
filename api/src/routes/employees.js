const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // GET /api/employees
  // Admin users receive driver_id; regular users do not.
  // exclude_from_next_up is returned to all users.
  router.get('/', async (req, res) => {
    try {
      const isAdmin = req.user?.role === 'admin';
      const cols = isAdmin
        ? 'id, name, employee_number, driver_id, position, active, exclude_from_next_up, created_at'
        : 'id, name, employee_number, position, active, exclude_from_next_up, created_at';
      const result = await pool.query(`SELECT ${cols} FROM employees ORDER BY name`);
      res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/employees
  router.post('/', async (req, res) => {
    const { name, employee_number, driver_id, position, exclude_from_next_up } = req.body;
    const isAdmin = req.user?.role === 'admin';
    try {
      const result = await pool.query(
        `INSERT INTO employees (name, employee_number, driver_id, position, exclude_from_next_up)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          name,
          employee_number || null,
          isAdmin ? (driver_id || null) : null,
          position || null,
          exclude_from_next_up === true,
        ]
      );
      const row = result.rows[0];
      if (!isAdmin) delete row.driver_id;
      res.status(201).json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // PUT /api/employees/:id
  router.put('/:id', async (req, res) => {
    const { name, employee_number, driver_id, position, active, exclude_from_next_up } = req.body;
    const isAdmin = req.user?.role === 'admin';
    try {
      // Build SET clause dynamically — driver_id only writable by admins
      const values = [
        name,
        employee_number || null,
        position || null,
        active !== false,
        exclude_from_next_up === true,
      ];
      const setClauses = [
        'name=$1',
        'employee_number=$2',
        'position=$3',
        'active=$4',
        'exclude_from_next_up=$5',
      ];

      if (isAdmin) {
        setClauses.push(`driver_id=$${values.length + 1}`);
        values.push(driver_id || null);
      }

      values.push(req.params.id);
      const result = await pool.query(
        `UPDATE employees SET ${setClauses.join(', ')} WHERE id=$${values.length} RETURNING *`,
        values
      );

      if (result.rows.length === 0) return res.status(404).json({ error: 'Employee not found' });
      const row = result.rows[0];
      if (!isAdmin) delete row.driver_id;
      res.json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // DELETE /api/employees/:id
  router.delete('/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM employees WHERE id=$1', [req.params.id]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
