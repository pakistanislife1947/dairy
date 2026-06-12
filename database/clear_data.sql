-- ============================================================
-- CLEAR ALL NON-ADMIN DATA
-- Run this in Supabase SQL Editor
-- Admin users (role = 'admin') are preserved.
-- ============================================================

-- 1. Milk records (all purchase data)
TRUNCATE TABLE milk_records RESTART IDENTITY CASCADE;

-- 2. Sales data
TRUNCATE TABLE milk_sales    RESTART IDENTITY CASCADE;
TRUNCATE TABLE walkin_sales  RESTART IDENTITY CASCADE;

-- 3. Expenses
TRUNCATE TABLE expenses      RESTART IDENTITY CASCADE;

-- 4. Audit logs
TRUNCATE TABLE audit_logs    RESTART IDENTITY CASCADE;

-- 5. Non-admin users only (keeps admin accounts safe)
DELETE FROM users WHERE role != 'admin';

-- 6. Farmers / collection centres
TRUNCATE TABLE farmers       RESTART IDENTITY CASCADE;

-- Done. Admin accounts preserved.
SELECT 'Data cleared. Admin accounts preserved.' AS result;
