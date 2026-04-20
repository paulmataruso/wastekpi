-- Migration 004: Add exclude_from_next_up to employees
-- When TRUE, this employee is excluded from the Route Assignment
-- Recommendation (Next Up) calculation on the display boards.
-- Readable and writable by all authenticated users (not admin-only).

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS exclude_from_next_up BOOLEAN DEFAULT FALSE;
