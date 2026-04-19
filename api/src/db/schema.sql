-- Waste KPI Tracker Schema — v1.1.0

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    employee_number VARCHAR(50) UNIQUE,
    position VARCHAR(100),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routes (
    id SERIAL PRIMARY KEY,
    route_name VARCHAR(150) NOT NULL,
    description TEXT,
    area VARCHAR(150),
    active BOOLEAN DEFAULT TRUE,
    excluded BOOLEAN DEFAULT FALSE,    -- when TRUE, route is hidden from all reports/display
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Primary daily KPI table: one record per employee per day
CREATE TABLE IF NOT EXISTS route_logs (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    route_number VARCHAR(100),
    punch_in TIME,
    first_stop_time TIME,
    route_complete_time TIME,
    to_yard_time TIME,                 -- time driver departed for yard at end of day
    punch_out TIME,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, log_date)
);

-- Pack-out events: driver leaves to dump full truck, then returns
-- Multiple per route_log (seq 1, 2, 3...)
CREATE TABLE IF NOT EXISTS pack_out_logs (
    id                 SERIAL PRIMARY KEY,
    route_log_id       INTEGER NOT NULL REFERENCES route_logs(id) ON DELETE CASCADE,
    seq                INTEGER NOT NULL DEFAULT 1,
    pack_out_time      TIME,
    back_on_route_time TIME,
    location           VARCHAR(20),    -- dump site: Alva | Naughton | Casella
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pack_out_logs_route_log_id ON pack_out_logs(route_log_id);

-- Kept for non-driving staff who don't run routes
CREATE TABLE IF NOT EXISTS clock_logs (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    clock_in TIME,
    clock_out TIME,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, log_date)
);

-- Seed routes
INSERT INTO routes (route_name, description, area) VALUES
    ('Route 1', 'Route 1', ''),
    ('Route 2', 'Route 2', ''),
    ('Route 3', 'Route 3', ''),
    ('Route 4', 'Route 4', ''),
    ('Route 5', 'Route 5', ''),
    ('Route 6', 'Route 6', ''),
    ('Route 7', 'Route 7', ''),
    ('Route 8', 'Route 8', '')
ON CONFLICT DO NOTHING;

-- Seed actual employees
INSERT INTO employees (name, position) VALUES
    ('Justin', 'Driver'),
    ('Brent', 'Driver'),
    ('Chuck', 'Driver'),
    ('Bryan SR', 'Driver'),
    ('George', 'Driver'),
    ('Mike', 'Driver'),
    ('Bryan JR', 'Driver'),
    ('Marcel', 'Driver'),
    ('Jake', 'Driver'),
    ('Chloe', 'Driver'),
    ('Paige', 'Driver'),
    ('Syd', 'Driver')
ON CONFLICT DO NOTHING;
