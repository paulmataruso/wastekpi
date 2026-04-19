-- Migration 001: Add pack_out_logs table
-- Safe to run on a DB that already has this table (uses IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS pack_out_logs (
    id                 SERIAL PRIMARY KEY,
    route_log_id       INTEGER NOT NULL REFERENCES route_logs(id) ON DELETE CASCADE,
    seq                INTEGER NOT NULL DEFAULT 1,
    pack_out_time      TIME,
    back_on_route_time TIME,
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pack_out_logs_route_log_id ON pack_out_logs(route_log_id);
