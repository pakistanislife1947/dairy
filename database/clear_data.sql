-- ============================================================
-- SAFE DATA CLEAR — skips tables that don't exist
-- Run in Supabase SQL Editor after migration_v2.sql
-- Admin accounts (role = 'admin') are preserved.
-- ============================================================

-- Milk purchase records
TRUNCATE TABLE milk_records RESTART IDENTITY CASCADE;

-- Sales data (only if tables exist)
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'milk_sales') THEN
    EXECUTE 'TRUNCATE TABLE milk_sales RESTART IDENTITY CASCADE';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'walkin_sales') THEN
    EXECUTE 'TRUNCATE TABLE walkin_sales RESTART IDENTITY CASCADE';
  END IF;
END $$;

-- Expenses
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'expenses') THEN
    EXECUTE 'TRUNCATE TABLE expenses RESTART IDENTITY CASCADE';
  END IF;
END $$;

-- Audit logs
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    EXECUTE 'TRUNCATE TABLE audit_logs RESTART IDENTITY CASCADE';
  END IF;
END $$;

-- Non-admin users only
DELETE FROM users WHERE role != 'admin';

-- Farmers / collection centres
TRUNCATE TABLE farmers RESTART IDENTITY CASCADE;

SELECT 'Done. Admin accounts preserved.' AS result;
