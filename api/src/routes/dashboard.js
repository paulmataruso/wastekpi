const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  router.get('/summary', async (req, res) => {
    const { date } = req.query;
    const target = date || new Date().toISOString().split('T')[0];
    try {
      const [routeStats, routeList, weekRoutes, topRoutes, clockAvgs, firstStopAvgs] = await Promise.all([

        // Daily summary stats
        pool.query(`
          SELECT
            COUNT(*) as total_drivers,
            COUNT(punch_in) as punched_in,
            COUNT(punch_out) as punched_out,
            COUNT(route_complete_time) as routes_completed,
            ROUND(AVG(CASE
              WHEN punch_in IS NOT NULL AND punch_out IS NOT NULL
              THEN EXTRACT(EPOCH FROM (punch_out - punch_in))/3600.0
            END)::numeric, 2) as avg_day_length_hours,
            ROUND(AVG(CASE
              WHEN punch_in IS NOT NULL AND route_complete_time IS NOT NULL
              THEN EXTRACT(EPOCH FROM (route_complete_time - punch_in))/3600.0
            END)::numeric, 2) as avg_route_duration_hours
          FROM route_logs WHERE log_date=$1`, [target]),

        // Full daily log — includes route area via LEFT JOIN on routes table
        pool.query(`
          SELECT rl.*,
            e.name as employee_name, e.position,
            rt.area as route_area,
            CASE
              WHEN rl.punch_in IS NOT NULL AND rl.punch_out IS NOT NULL
              THEN ROUND(EXTRACT(EPOCH FROM (rl.punch_out - rl.punch_in))/3600.0, 2)
              ELSE NULL
            END as day_length_hours,
            (
              SELECT ROUND(AVG(
                EXTRACT(EPOCH FROM (rl2.route_complete_time - rl2.first_stop_time))/60.0
              )::numeric, 1)
              FROM route_logs rl2
              WHERE rl2.employee_id = rl.employee_id
                AND rl2.first_stop_time IS NOT NULL
                AND rl2.route_complete_time IS NOT NULL
                AND rl2.log_date >= $1::date - INTERVAL '6 days'
                AND rl2.log_date <= $1::date
            ) AS avg_route_mins_7d
          FROM route_logs rl
          JOIN employees e ON e.id = rl.employee_id
          LEFT JOIN routes rt ON rt.route_name = rl.route_number
          WHERE rl.log_date = $1
          ORDER BY e.name`, [target]),

        // 7-day trend
        pool.query(`
          SELECT
            rl.log_date,
            COUNT(*) as total_logged,
            COUNT(route_complete_time) as routes_completed,
            ROUND(AVG(CASE
              WHEN punch_in IS NOT NULL AND punch_out IS NOT NULL
              THEN EXTRACT(EPOCH FROM (punch_out - punch_in))/3600.0
            END)::numeric, 2) as avg_day_length
          FROM route_logs rl
          WHERE rl.log_date >= $1::date - INTERVAL '6 days'
            AND rl.log_date <= $1::date
          GROUP BY rl.log_date
          ORDER BY rl.log_date`, [target]),

        // Top route by avg day length — 7d and 30d windows
        pool.query(`
          WITH window_7 AS (
            SELECT
              route_number,
              ROUND(AVG(EXTRACT(EPOCH FROM (punch_out - punch_in))/3600.0)::numeric, 2) AS avg_hours,
              COUNT(*) AS runs
            FROM route_logs
            WHERE log_date >= $1::date - INTERVAL '6 days'
              AND log_date <= $1::date
              AND route_number IS NOT NULL
              AND punch_in IS NOT NULL AND punch_out IS NOT NULL
            GROUP BY route_number ORDER BY avg_hours DESC LIMIT 1
          ),
          window_30 AS (
            SELECT
              route_number,
              ROUND(AVG(EXTRACT(EPOCH FROM (punch_out - punch_in))/3600.0)::numeric, 2) AS avg_hours,
              COUNT(*) AS runs
            FROM route_logs
            WHERE log_date >= $1::date - INTERVAL '29 days'
              AND log_date <= $1::date
              AND route_number IS NOT NULL
              AND punch_in IS NOT NULL AND punch_out IS NOT NULL
            GROUP BY route_number ORDER BY avg_hours DESC LIMIT 1
          )
          SELECT
            w7.route_number AS route_7d,  w7.avg_hours AS avg_hours_7d,  w7.runs AS runs_7d,
            w30.route_number AS route_30d, w30.avg_hours AS avg_hours_30d, w30.runs AS runs_30d
          FROM window_7 w7 FULL OUTER JOIN window_30 w30 ON true`, [target]),

        // Avg clock-in and clock-out times — 7d and 30d
        pool.query(`
          SELECT
            TO_CHAR(
              (INTERVAL '1 second' * ROUND(AVG(EXTRACT(EPOCH FROM punch_in)) FILTER (
                WHERE punch_in IS NOT NULL AND log_date >= $1::date - INTERVAL '6 days' AND log_date <= $1::date
              ))),
              'HH12:MI AM'
            ) AS avg_clock_in_7d,
            TO_CHAR(
              (INTERVAL '1 second' * ROUND(AVG(EXTRACT(EPOCH FROM punch_out)) FILTER (
                WHERE punch_out IS NOT NULL AND log_date >= $1::date - INTERVAL '6 days' AND log_date <= $1::date
              ))),
              'HH12:MI AM'
            ) AS avg_clock_out_7d,
            TO_CHAR(
              (INTERVAL '1 second' * ROUND(AVG(EXTRACT(EPOCH FROM punch_in)) FILTER (
                WHERE punch_in IS NOT NULL AND log_date >= $1::date - INTERVAL '29 days' AND log_date <= $1::date
              ))),
              'HH12:MI AM'
            ) AS avg_clock_in_30d,
            TO_CHAR(
              (INTERVAL '1 second' * ROUND(AVG(EXTRACT(EPOCH FROM punch_out)) FILTER (
                WHERE punch_out IS NOT NULL AND log_date >= $1::date - INTERVAL '29 days' AND log_date <= $1::date
              ))),
              'HH12:MI AM'
            ) AS avg_clock_out_30d
          FROM route_logs`, [target]),

        // Avg time from punch_in to first_stop — 7d and 30d
        pool.query(`
          SELECT
            ROUND(AVG(EXTRACT(EPOCH FROM (first_stop_time - punch_in))/60.0) FILTER (
              WHERE punch_in IS NOT NULL AND first_stop_time IS NOT NULL
                AND log_date >= $1::date - INTERVAL '6 days' AND log_date <= $1::date
            )::numeric, 1) AS avg_to_first_stop_mins_7d,
            ROUND(AVG(EXTRACT(EPOCH FROM (first_stop_time - punch_in))/60.0) FILTER (
              WHERE punch_in IS NOT NULL AND first_stop_time IS NOT NULL
                AND log_date >= $1::date - INTERVAL '29 days' AND log_date <= $1::date
            )::numeric, 1) AS avg_to_first_stop_mins_30d
          FROM route_logs`, [target])
      ]);

      // Attach pack_out_logs to each daily row
      const rows = routeList.rows;
      if (rows.length > 0) {
        const packOutResult = await pool.query(
          `SELECT * FROM pack_out_logs
           WHERE route_log_id = ANY($1::int[])
           ORDER BY route_log_id, seq`,
          [rows.map(r => r.id)]
        );
        const packOutMap = {};
        packOutResult.rows.forEach(p => {
          if (!packOutMap[p.route_log_id]) packOutMap[p.route_log_id] = [];
          packOutMap[p.route_log_id].push(p);
        });
        rows.forEach(r => { r.pack_outs = packOutMap[r.id] || []; });
      }

      res.json({
        date: target,
        stats: routeStats.rows[0],
        route_logs: rows,
        week_routes: weekRoutes.rows,
        top_routes: topRoutes.rows[0] || null,
        clock_avgs: clockAvgs.rows[0] || null,
        first_stop_avgs: firstStopAvgs.rows[0] || null
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
