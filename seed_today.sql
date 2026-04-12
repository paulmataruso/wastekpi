-- ============================================================
-- Dummy data for TODAY: 2026-04-08 (Wednesday)
-- 10 of 12 drivers logged (Paige and Syd have day off)
-- Run:
--   docker exec -i waste-kpi-postgres psql -U waste_user -d waste_kpi < seed_today.sql
-- ============================================================

INSERT INTO route_logs (employee_id, log_date, route_number, punch_in, first_stop_time, route_complete_time, punch_out, notes)
VALUES

-- Justin (ID 1) — Route 1, early start, clean day
(1,  '2026-04-08', 'Route 1', '05:47:00', '06:18:00', '12:34:00', '13:02:00', NULL),

-- Brent (ID 2) — Route 3, on time
(2,  '2026-04-08', 'Route 3', '05:52:00', '06:27:00', '12:55:00', '13:21:00', NULL),

-- Chuck (ID 3) — Route 4, slight traffic delay
(3,  '2026-04-08', 'Route 4', '06:38:00', '07:11:00', '14:48:00', '15:19:00', 'Traffic delay on main street'),

-- Bryan SR (ID 4) — Route 6, long route, extra stops
(4,  '2026-04-08', 'Route 6', '06:44:00', '07:22:00', '16:05:00', '16:31:00', 'Extra stops added'),

-- George (ID 5) — Route 7, long route, on time
(5,  '2026-04-08', 'Route 7', '07:03:00', '07:38:00', '15:47:00', '16:14:00', NULL),

-- Mike (ID 6) — Route 3, early bird
(6,  '2026-04-08', 'Route 3', '05:29:00', '05:54:00', '12:11:00', '12:44:00', NULL),

-- Bryan JR (ID 7) — Route 2, quick day
(7,  '2026-04-08', 'Route 2', '05:55:00', '06:24:00', '12:08:00', '12:29:00', 'Light traffic, fast day'),

-- Marcel (ID 8) — Route 4, truck issue mid-route
(8,  '2026-04-08', 'Route 4', '06:57:00', '07:33:00', '15:22:00', '15:58:00', 'Truck maintenance stop'),

-- Jake (ID 9) — Route 5, normal day
(9,  '2026-04-08', 'Route 5', '06:31:00', '07:04:00', '14:37:00', '15:08:00', NULL),

-- Chloe (ID 10) — Route 7, on time
(10, '2026-04-08', 'Route 7', '06:48:00', '07:19:00', '15:53:00', '16:22:00', NULL)

-- Paige (ID 11) — day off, no entry
-- Syd (ID 12)   — day off, no entry

ON CONFLICT (employee_id, log_date) DO NOTHING;
