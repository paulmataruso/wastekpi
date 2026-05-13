-- Migration 006: Pack-out locations table
-- Replaces the hardcoded ['Alva', 'Naughton', 'Casella'] array with a
-- user-manageable table. Seeded with the original three locations.

CREATE TABLE IF NOT EXISTS pack_out_locations (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    active     BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO pack_out_locations (name) VALUES
    ('Alva'),
    ('Naughton'),
    ('Casella')
ON CONFLICT (name) DO NOTHING;
