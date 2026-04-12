const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // POST /api/import
  // Accepts rows array. Each row can include:
  //   date, driver, route_number, punch_in, first_stop, route_complete, punch_out, notes
  //   pack_out_1, back_on_route_1, pack_out_2, back_on_route_2, ... (up to N pairs)
  router.post('/', async (req, res) => {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows provided' });
    }

    try {
      const empResult = await pool.query('SELECT id, name FROM employees WHERE active = true');
      const employeeMap = {};
      empResult.rows.forEach(e => {
        employeeMap[e.name.toLowerCase().trim()] = e.id;
      });

      const results = { imported: 0, skipped: 0, errors: [] };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          const dateStr = parseDate(row.date);
          if (!dateStr) {
            results.errors.push(`Row ${rowNum}: invalid date "${row.date}"`);
            results.skipped++;
            await client.query('ROLLBACK');
            continue;
          }

          const driverKey = (row.driver || '').toLowerCase().trim();
          if (!driverKey) {
            results.errors.push(`Row ${rowNum}: missing driver name`);
            results.skipped++;
            await client.query('ROLLBACK');
            continue;
          }
          const employeeId = employeeMap[driverKey];
          if (!employeeId) {
            results.errors.push(`Row ${rowNum}: driver "${row.driver}" not found`);
            results.skipped++;
            await client.query('ROLLBACK');
            continue;
          }

          const punchIn       = parseTime(row.punch_in);
          const firstStop     = parseTime(row.first_stop);
          const routeComplete = parseTime(row.route_complete);
          const punchOut      = parseTime(row.punch_out);

          const rlResult = await client.query(
            `INSERT INTO route_logs
               (employee_id, log_date, route_number, punch_in, first_stop_time, route_complete_time, punch_out, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (employee_id, log_date) DO UPDATE SET
               route_number        = EXCLUDED.route_number,
               punch_in            = EXCLUDED.punch_in,
               first_stop_time     = EXCLUDED.first_stop_time,
               route_complete_time = EXCLUDED.route_complete_time,
               punch_out           = EXCLUDED.punch_out,
               notes               = EXCLUDED.notes,
               updated_at          = NOW()
             RETURNING id`,
            [
              employeeId, dateStr,
              row.route_number || null,
              punchIn, firstStop, routeComplete, punchOut,
              row.notes || null
            ]
          );

          const routeLogId = rlResult.rows[0].id;

          // Delete old pack-outs, insert new ones from numbered columns
          await client.query('DELETE FROM pack_out_logs WHERE route_log_id=$1', [routeLogId]);

          let seq = 1;
          while (true) {
            const poKey  = `pack_out_${seq}`;
            const borKey = `back_on_route_${seq}`;
            // Stop when neither column exists in this row
            if (!(poKey in row) && !(borKey in row)) break;
            const pot  = parseTime(row[poKey]);
            const bort = parseTime(row[borKey]);
            if (pot || bort) {
              await client.query(
                `INSERT INTO pack_out_logs (route_log_id, seq, pack_out_time, back_on_route_time)
                 VALUES ($1,$2,$3,$4)`,
                [routeLogId, seq, pot, bort]
              );
            }
            seq++;
            if (seq > 20) break; // safety cap
          }

          await client.query('COMMIT');
          results.imported++;
        } catch (rowErr) {
          await client.query('ROLLBACK');
          results.errors.push(`Row ${rowNum}: ${rowErr.message}`);
          results.skipped++;
        } finally {
          client.release();
        }
      }

      res.json(results);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    let [, m, d, y] = mdy;
    if (y.length === 2) y = parseInt(y) >= 50 ? `19${y}` : `20${y}`;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return null;
}

function parseTime(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (!s) return null;
  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const min = ampm[2];
    const period = ampm[3].toUpperCase();
    if (period === 'AM' && h === 12) h = 0;
    if (period === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2,'0')}:${min}:00`;
  }
  const hhmm = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hhmm) {
    return `${hhmm[1].padStart(2,'0')}:${hhmm[2]}:${hhmm[3] || '00'}`;
  }
  return null;
}
