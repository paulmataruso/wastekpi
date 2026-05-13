-- Migration 005: Additional route assignments per driver per day
-- Drivers sometimes help with or are assigned multiple routes in a day.
-- This table stores the extra routes beyond the primary one on route_logs.
-- Each row has its own first_stop/route_complete times for KPI calculation.

CREATE TABLE IF NOT EXISTS additional_route_logs (
    id                  SERIAL PRIMARY KEY,
    route_log_id        INTEGER NOT NULL REFERENCES route_logs(id) ON DELETE CASCADE,
    seq                 INTEGER NOT NULL DEFAULT 1,  -- ordering within the day
    route_number        VARCHAR(100),
    first_stop_time     TIME,
    route_complete_time TIME,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_additional_route_logs_route_log_id
    ON additional_route_logs(route_log_id);
