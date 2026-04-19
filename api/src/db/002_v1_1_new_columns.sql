-- Migration 002: v1.1.0 new columns
-- Adds: to_yard_time to route_logs, location to pack_out_logs, excluded to routes
-- Uses ADD COLUMN IF NOT EXISTS so safe to run on a DB that already has these columns.

ALTER TABLE route_logs
  ADD COLUMN IF NOT EXISTS to_yard_time TIME;

ALTER TABLE pack_out_logs
  ADD COLUMN IF NOT EXISTS location VARCHAR(20);

ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS excluded BOOLEAN DEFAULT FALSE;
