-- Migration v2: Collection centres, shop assignment, time-based collection, correct formula
-- Run in Supabase SQL Editor

-- 1. farmers table: add centre_name + supplier_rate
ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS centre_name    VARCHAR(150),
  ADD COLUMN IF NOT EXISTS supplier_rate  NUMERIC(8,4) DEFAULT 0;

-- Update centre_name from name for existing records
UPDATE farmers SET centre_name = name WHERE centre_name IS NULL;

-- 2. milk_records: add collection_time, shop_id, drop shift dependency
ALTER TABLE milk_records
  ADD COLUMN IF NOT EXISTS collection_time  TIMESTAMPTZ  DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS shop_id          BIGINT       REFERENCES shops(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lactometer_reading NUMERIC(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ts_value           NUMERIC(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS standardised_ts    NUMERIC(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS snf_computed       NUMERIC(10,4) DEFAULT 0;

-- Increase precision
ALTER TABLE milk_records
  ALTER COLUMN computed_rate TYPE NUMERIC(10,4),
  ALTER COLUMN total_amount  TYPE NUMERIC(14,4);

-- Make shift optional (nullable) — we use collection_time now
ALTER TABLE milk_records
  ALTER COLUMN shift DROP NOT NULL,
  ALTER COLUMN shift SET DEFAULT NULL;

-- 3. Seed pricing config
INSERT INTO settings (key, value, updated_at) VALUES
  ('target_ts',       '13.00',  NOW()),
  ('base_rate',       '0',      NOW()),
  ('constant_c1',     '0.22',   NOW()),
  ('constant_c2',     '0.72',   NOW()),
  ('constant_c3',     '4.00',   NOW()),
  ('constant_scale',  '200.00', NOW())
ON CONFLICT (key) DO NOTHING;

-- 4. Index for shop lookups
CREATE INDEX IF NOT EXISTS idx_milk_shop    ON milk_records(shop_id);
CREATE INDEX IF NOT EXISTS idx_milk_centre  ON milk_records(farmer_id, collection_date);

-- v2 patch: add shop_id to receipts for per-shop stock tracking
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS shop_id BIGINT REFERENCES shops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_receipts_shop ON receipts(shop_id);

-- Add department and permissions columns to users table (required for staff portal access)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS department   VARCHAR(50)  DEFAULT 'sales',
  ADD COLUMN IF NOT EXISTS permissions  JSONB        DEFAULT '[]'::jsonb;

-- Add shop_id to employees — every employee belongs to one shop
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS shop_id BIGINT REFERENCES shops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_shop ON employees(shop_id);

-- Also store shop_id on users table for fast JWT-less lookups
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS shop_id BIGINT REFERENCES shops(id) ON DELETE SET NULL;
