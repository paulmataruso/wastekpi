-- Migration: Add pack_out_logs table
-- Run once against the live database:
--   docker exec -i waste-kpi-postgres psql -U waste_user -d waste_kpi < api/src/db/migration_packout.sql

CREATE TABLE IF NOT EXISTS pack_out_logs (
    id                SERIAL PRIMARY KEY,
    route_log_id      INTEGER NOT NULL REFERENCES route_logs(id) ON DELETE CASCADE,
    seq               INTEGER NOT NULL DEFAULT 1,   -- ordering: 1st dump run, 2nd, etc.
    pack_out_time     TIME,
    back_on_route_time TIME,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pack_out_logs_route_log_id ON pack_out_logs(route_log_id);
