-- Migration 003: Add driver_id to employees
-- Internal identifier for payroll/dispatch systems.
-- Not exposed to non-admin users via the API.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS driver_id VARCHAR(50);
