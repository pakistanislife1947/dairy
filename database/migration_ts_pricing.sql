-- Migration: TS-based pricing engine
-- Run once on your database

-- 1. Add new columns to milk_records (safe — IF NOT EXISTS)
ALTER TABLE milk_records
  ADD COLUMN IF NOT EXISTS lactometer_reading NUMERIC(6,2)    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ts_value           NUMERIC(10,4)   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS standardised_ts    NUMERIC(10,4)   DEFAULT 0;

-- Increase precision on existing numeric columns
ALTER TABLE milk_records
  ALTER COLUMN computed_rate  TYPE NUMERIC(10,4),
  ALTER COLUMN total_amount   TYPE NUMERIC(14,4);

-- 2. Seed pricing config into settings table
INSERT INTO settings (key, value, updated_at) VALUES
  ('target_ts',       '13.00',  NOW()),
  ('base_rate',       '0',      NOW()),
  ('constant_c1',     '0.22',   NOW()),
  ('constant_c2',     '0.72',   NOW()),
  ('constant_c3',     '4.00',   NOW()),
  ('constant_scale',  '200.00', NOW())
ON CONFLICT (key) DO NOTHING;
