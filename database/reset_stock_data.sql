-- ============================================================
-- FULL DATA RESET — run in Supabase SQL Editor
-- Clears all transactional data, keeps settings/users/shops/farmers
-- Stock can never go negative after this (enforced in app layer)
-- ============================================================

-- 1. Receipts & invoice line items (sales)
TRUNCATE TABLE receipt_items    RESTART IDENTITY CASCADE;
TRUNCATE TABLE receipts         RESTART IDENTITY CASCADE;

-- 2. Milk records (purchase/collection)
TRUNCATE TABLE milk_records     RESTART IDENTITY CASCADE;

-- 3. Billing & payouts
TRUNCATE TABLE bill_items       RESTART IDENTITY CASCADE;
TRUNCATE TABLE bills            RESTART IDENTITY CASCADE;
TRUNCATE TABLE billing_periods  RESTART IDENTITY CASCADE;

-- 4. Expenses
TRUNCATE TABLE expenses         RESTART IDENTITY CASCADE;

-- 5. Walkin / shop sales (legacy table if exists)
TRUNCATE TABLE walkin_sales     RESTART IDENTITY CASCADE;
TRUNCATE TABLE milk_sales       RESTART IDENTITY CASCADE;

-- 6. Payroll
TRUNCATE TABLE payroll          RESTART IDENTITY CASCADE;
TRUNCATE TABLE advance_salary   RESTART IDENTITY CASCADE;

-- 7. Audit logs
TRUNCATE TABLE audit_logs       RESTART IDENTITY CASCADE;

-- 8. Product stock — reset to 0
UPDATE products SET stock_qty = 0;

-- Confirm
SELECT 'Data reset complete. Stock is now 0. Fresh start.' AS status;
