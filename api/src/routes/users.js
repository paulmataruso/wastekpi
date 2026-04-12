const express = require('express');
const bcrypt = require('bcryptjs');

module.exports = (pool) => {
  const router = express.Router();

  // ── Admin-only guard ───────────────────────────────────────────────────────
  function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin role required' });
    }
    next();
  }

  // ── GET /api/users — list all users (no password hashes) ─────────────────
  router.get('/', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, username, role, created_at FROM users ORDER BY created_at'
      );
      res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── POST /api/users — create a new user ───────────────────────────────────
  router.post('/', requireAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const validRole = ['admin', 'user'].includes(role) ? role : 'user';

    try {
      const hash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        `INSERT INTO users (username, password_hash, role)
         VALUES ($1, $2, $3)
         RETURNING id, username, role, created_at`,
        [username.trim(), hash, validRole]
      );
      res.status(201).json(result.rows[0]);
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: `Username "${username}" is already taken` });
      res.status(500).json({ error: e.message });
    }
  });

  // ── PUT /api/users/:id — update username, role, and/or password ───────────
  router.put('/:id', requireAdmin, async (req, res) => {
    const { username, role, password } = req.body;
    const { id } = req.params;

    // Prevent an admin from demoting themselves
    if (String(req.user.id) === String(id) && role && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove your own admin role' });
    }

    try {
      // Build update dynamically based on what was sent
      const setClauses = [];
      const values = [];
      let n = 1;

      if (username) { setClauses.push(`username=$${n++}`); values.push(username.trim()); }
      if (role && ['admin', 'user'].includes(role)) { setClauses.push(`role=$${n++}`); values.push(role); }
      if (password) {
        if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
        const hash = await bcrypt.hash(password, 10);
        setClauses.push(`password_hash=$${n++}`);
        values.push(hash);
      }

      if (setClauses.length === 0) return res.status(400).json({ error: 'Nothing to update' });

      values.push(id);
      const result = await pool.query(
        `UPDATE users SET ${setClauses.join(', ')} WHERE id=$${n} RETURNING id, username, role, created_at`,
        values
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      res.json(result.rows[0]);
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: `Username is already taken` });
      res.status(500).json({ error: e.message });
    }
  });

  // ── DELETE /api/users/:id — delete a user ─────────────────────────────────
  router.delete('/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;

    // Prevent deleting yourself
    if (String(req.user.id) === String(id)) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    // Ensure at least one admin always remains
    try {
      const target = await pool.query('SELECT role FROM users WHERE id=$1', [id]);
      if (target.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      if (target.rows[0].role === 'admin') {
        const adminCount = await pool.query("SELECT COUNT(*) FROM users WHERE role='admin'");
        if (parseInt(adminCount.rows[0].count) <= 1) {
          return res.status(400).json({ error: 'Cannot delete the last admin account' });
        }
      }

      await pool.query('DELETE FROM users WHERE id=$1', [id]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
