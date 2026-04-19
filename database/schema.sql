-- ============================================================
--  DAIRY MANAGEMENT ERP — Complete Schema v2.0
--  Engine: InnoDB | Charset: utf8mb4
--  Includes: Auth, Farmers, Milk, Billing, Sales, HR,
--            Assets, Expenses, Audit Triggers
-- ============================================================

CREATE DATABASE IF NOT EXISTS dairy_erp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE dairy_erp;

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. USERS & AUTH
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                 INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name               VARCHAR(100)    NOT NULL,
  email              VARCHAR(150)    NOT NULL,
  password_hash      VARCHAR(255)        NULL COMMENT 'NULL for OAuth-only users',
  role               ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  avatar_url         VARCHAR(500)        NULL,
  google_id          VARCHAR(100)        NULL COMMENT 'Google OAuth subject ID',
  is_active          TINYINT(1)      NOT NULL DEFAULT 1,
  email_verified     TINYINT(1)      NOT NULL DEFAULT 0,
  verification_token VARCHAR(64)         NULL,
  token_expires_at   DATETIME            NULL,
  refresh_token_hash VARCHAR(255)        NULL COMMENT 'Hashed refresh token',
  created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email    (email),
  UNIQUE KEY uq_users_google   (google_id),
  INDEX idx_users_role         (role),
  INDEX idx_users_active       (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. FARMERS (Milk Suppliers)
-- ============================================================
CREATE TABLE IF NOT EXISTS farmers (
  id               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  farmer_code      VARCHAR(20)     NOT NULL,
  name             VARCHAR(100)    NOT NULL,
  phone            VARCHAR(20)     NOT NULL,
  address          TEXT            NOT NULL,
  bank_name        VARCHAR(100)        NULL,
  bank_account     VARCHAR(50)         NULL,
  -- Dynamic pricing defaults
  base_rate        DECIMAL(8,2)    NOT NULL DEFAULT 45.00 COMMENT 'Base rate per litre',
  ideal_fat        DECIMAL(5,2)    NOT NULL DEFAULT 6.00  COMMENT 'Standard FAT %',
  ideal_snf        DECIMAL(5,2)    NOT NULL DEFAULT 9.00  COMMENT 'Standard SNF %',
  fat_correction   DECIMAL(8,4)    NOT NULL DEFAULT 0.50  COMMENT 'Per unit FAT correction factor',
  snf_correction   DECIMAL(8,4)    NOT NULL DEFAULT 0.30  COMMENT 'Per unit SNF correction factor',
  is_active        TINYINT(1)      NOT NULL DEFAULT 1,
  created_by       INT UNSIGNED        NULL,
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_farmers_code   (farmer_code),
  INDEX idx_farmers_name       (name),
  INDEX idx_farmers_active     (is_active),
  CONSTRAINT fk_farmers_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. MILK COLLECTION RECORDS
-- Dynamic Rate = base_rate + (actual_fat - ideal_fat) * fat_correction
--                           + (actual_snf - ideal_snf) * snf_correction
-- ============================================================
CREATE TABLE IF NOT EXISTS milk_records (
  id               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  farmer_id        INT UNSIGNED    NOT NULL,
  collection_date  DATE            NOT NULL,
  shift            ENUM('morning','evening') NOT NULL DEFAULT 'morning',
  quantity_liters  DECIMAL(10,2)   NOT NULL,
  fat_percentage   DECIMAL(5,2)    NOT NULL COMMENT 'Actual FAT reading',
  snf_percentage   DECIMAL(5,2)        NULL COMMENT 'Actual SNF reading',
  -- Snapshot of pricing at time of entry
  base_rate        DECIMAL(8,2)    NOT NULL,
  fat_correction   DECIMAL(8,4)    NOT NULL,
  snf_correction   DECIMAL(8,4)    NOT NULL,
  computed_rate    DECIMAL(8,2)    NOT NULL COMMENT 'Final calculated rate per litre',
  total_amount     DECIMAL(12,2)   NOT NULL,
  notes            TEXT                NULL,
  recorded_by      INT UNSIGNED        NULL,
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_milk_farmer        (farmer_id),
  INDEX idx_milk_date          (collection_date),
  INDEX idx_milk_date_shift    (collection_date, shift),
  CONSTRAINT fk_milk_farmer
    FOREIGN KEY (farmer_id) REFERENCES farmers(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_milk_recorded_by
    FOREIGN KEY (recorded_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. BILLING
-- ============================================================
CREATE TABLE IF NOT EXISTS billing_periods (
  id             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  period_month   TINYINT         NOT NULL,
  period_year    SMALLINT        NOT NULL,
  status         ENUM('open','closed','paid') NOT NULL DEFAULT 'open',
  closed_at      DATETIME            NULL,
  created_by     INT UNSIGNED        NULL,
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_billing_period (period_month, period_year),
  CONSTRAINT fk_billing_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bills (
  id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  bill_number         VARCHAR(30)     NOT NULL,
  billing_period_id   INT UNSIGNED    NOT NULL,
  farmer_id           INT UNSIGNED    NOT NULL,
  total_liters        DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  avg_fat             DECIMAL(5,2)        NULL,
  avg_snf             DECIMAL(5,2)        NULL,
  total_amount        DECIMAL(14,2)   NOT NULL DEFAULT 0.00,
  advance_deduction   DECIMAL(14,2)   NOT NULL DEFAULT 0.00,
  other_deductions    DECIMAL(14,2)   NOT NULL DEFAULT 0.00,
  net_payable         DECIMAL(14,2)   NOT NULL DEFAULT 0.00,
  status              ENUM('generated','paid','cancelled') NOT NULL DEFAULT 'generated',
  generated_by        INT UNSIGNED        NULL,
  paid_at             DATETIME            NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bill_number          (bill_number),
  UNIQUE KEY uq_bill_period_farmer   (billing_period_id, farmer_id),
  INDEX idx_bills_farmer             (farmer_id),
  INDEX idx_bills_status             (status),
  CONSTRAINT fk_bills_period
    FOREIGN KEY (billing_period_id) REFERENCES billing_periods(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_bills_farmer
    FOREIGN KEY (farmer_id) REFERENCES farmers(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_bills_generated_by
    FOREIGN KEY (generated_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bill_line_items (
  id               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  bill_id          INT UNSIGNED    NOT NULL,
  milk_record_id   INT UNSIGNED    NOT NULL,
  collection_date  DATE            NOT NULL,
  shift            ENUM('morning','evening') NOT NULL,
  quantity_liters  DECIMAL(10,2)   NOT NULL,
  fat_percentage   DECIMAL(5,2)    NOT NULL,
  snf_percentage   DECIMAL(5,2)        NULL,
  computed_rate    DECIMAL(8,2)    NOT NULL,
  line_amount      DECIMAL(12,2)   NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_line_bill (bill_id),
  CONSTRAINT fk_line_bill
    FOREIGN KEY (bill_id) REFERENCES bills(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. SALES MODULE (Bulk Milk Sales to Companies)
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name         VARCHAR(150)    NOT NULL,
  contact_name VARCHAR(100)        NULL,
  phone        VARCHAR(20)         NULL,
  address      TEXT                NULL,
  gstin        VARCHAR(20)         NULL,
  is_active    TINYINT(1)      NOT NULL DEFAULT 1,
  created_by   INT UNSIGNED        NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_companies_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_contracts (
  id               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  company_id       INT UNSIGNED    NOT NULL,
  contract_ref     VARCHAR(50)         NULL,
  rate_per_liter   DECIMAL(8,2)    NOT NULL,
  min_quantity     DECIMAL(10,2)       NULL,
  start_date       DATE            NOT NULL,
  end_date         DATE                NULL,
  status           ENUM('active','expired','terminated') NOT NULL DEFAULT 'active',
  notes            TEXT                NULL,
  created_by       INT UNSIGNED        NULL,
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_contracts_company (company_id),
  CONSTRAINT fk_contracts_company
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_contracts_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS milk_sales (
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  contract_id     INT UNSIGNED    NOT NULL,
  company_id      INT UNSIGNED    NOT NULL,
  sale_date       DATE            NOT NULL,
  quantity_liters DECIMAL(10,2)   NOT NULL,
  fat_percentage  DECIMAL(5,2)        NULL,
  snf_percentage  DECIMAL(5,2)        NULL,
  rate_per_liter  DECIMAL(8,2)    NOT NULL,
  total_amount    DECIMAL(12,2)   NOT NULL,
  payment_status  ENUM('pending','received','partial') NOT NULL DEFAULT 'pending',
  received_amount DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  notes           TEXT                NULL,
  recorded_by     INT UNSIGNED        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_sales_contract  (contract_id),
  INDEX idx_sales_company   (company_id),
  INDEX idx_sales_date      (sale_date),
  CONSTRAINT fk_sales_contract
    FOREIGN KEY (contract_id) REFERENCES sales_contracts(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sales_company
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sales_recorded_by
    FOREIGN KEY (recorded_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. ASSET MANAGEMENT — VEHICLES
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  reg_number      VARCHAR(30)     NOT NULL,
  make_model      VARCHAR(100)        NULL,
  ownership_type  ENUM('owned','rented') NOT NULL DEFAULT 'owned',
  -- Rented vehicle fields
  owner_name      VARCHAR(100)        NULL,
  owner_phone     VARCHAR(20)         NULL,
  monthly_rent    DECIMAL(10,2)       NULL,
  -- Common
  is_active       TINYINT(1)      NOT NULL DEFAULT 1,
  notes           TEXT                NULL,
  created_by      INT UNSIGNED        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicle_reg (reg_number),
  CONSTRAINT fk_vehicles_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vehicle_expenses (
  id           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  vehicle_id   INT UNSIGNED    NOT NULL,
  expense_date DATE            NOT NULL,
  expense_type ENUM('diesel','service','rent','insurance','other') NOT NULL,
  amount       DECIMAL(10,2)   NOT NULL,
  odometer_km  INT UNSIGNED        NULL,
  notes        TEXT                NULL,
  recorded_by  INT UNSIGNED        NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_vexp_vehicle  (vehicle_id),
  INDEX idx_vexp_date     (expense_date),
  CONSTRAINT fk_vexp_vehicle
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_vexp_recorded_by
    FOREIGN KEY (recorded_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. ASSET MANAGEMENT — SHOPS / LOCATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS shops (
  id             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  shop_name      VARCHAR(150)    NOT NULL,
  location       TEXT                NULL,
  ownership_type ENUM('owned','rented') NOT NULL DEFAULT 'owned',
  -- Rented shop fields
  owner_name     VARCHAR(100)        NULL,
  owner_phone    VARCHAR(20)         NULL,
  monthly_rent   DECIMAL(10,2)       NULL,
  rent_due_day   TINYINT             NULL COMMENT 'Day of month rent is due',
  -- Location coordinates
  latitude       DECIMAL(10,8)       NULL,
  longitude      DECIMAL(11,8)       NULL,
  is_active      TINYINT(1)      NOT NULL DEFAULT 1,
  created_by     INT UNSIGNED        NULL,
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_shops_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_rent_payments (
  id           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  shop_id      INT UNSIGNED    NOT NULL,
  paid_for     VARCHAR(7)      NOT NULL COMMENT 'YYYY-MM',
  paid_date    DATE            NOT NULL,
  amount       DECIMAL(10,2)   NOT NULL,
  notes        TEXT                NULL,
  recorded_by  INT UNSIGNED        NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_shop_rent_shop (shop_id),
  CONSTRAINT fk_shop_rent_shop
    FOREIGN KEY (shop_id) REFERENCES shops(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. HR & PAYROLL
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED        NULL COMMENT 'Links to system user if applicable',
  emp_code        VARCHAR(20)     NOT NULL,
  name            VARCHAR(100)    NOT NULL,
  phone           VARCHAR(20)         NULL,
  address         TEXT                NULL,
  designation     VARCHAR(100)        NULL,
  department      VARCHAR(100)        NULL,
  base_salary     DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  join_date       DATE                NULL,
  is_active       TINYINT(1)      NOT NULL DEFAULT 1,
  created_by      INT UNSIGNED        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_emp_code (emp_code),
  CONSTRAINT fk_emp_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_emp_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS advance_salary (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  employee_id   INT UNSIGNED    NOT NULL,
  amount        DECIMAL(10,2)   NOT NULL,
  advance_date  DATE            NOT NULL,
  recovered     DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  status        ENUM('pending','partial','recovered') NOT NULL DEFAULT 'pending',
  notes         TEXT                NULL,
  created_by    INT UNSIGNED        NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_advance_emp (employee_id),
  CONSTRAINT fk_advance_emp
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payroll (
  id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  employee_id         INT UNSIGNED    NOT NULL,
  payroll_month       VARCHAR(7)      NOT NULL COMMENT 'YYYY-MM',
  base_salary         DECIMAL(10,2)   NOT NULL,
  allowances          DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  advance_deduction   DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  other_deductions    DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  net_salary          DECIMAL(10,2)   NOT NULL,
  status              ENUM('draft','paid') NOT NULL DEFAULT 'draft',
  paid_at             DATETIME            NULL,
  notes               TEXT                NULL,
  processed_by        INT UNSIGNED        NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payroll_emp_month (employee_id, payroll_month),
  CONSTRAINT fk_payroll_emp
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_payroll_processed_by
    FOREIGN KEY (processed_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. CENTRALIZED EXPENSES LEDGER
-- ============================================================
CREATE TABLE IF NOT EXISTS expense_categories (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100)    NOT NULL,
  description TEXT                NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exp_cat_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenses (
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  category_id     INT UNSIGNED    NOT NULL,
  expense_date    DATE            NOT NULL,
  amount          DECIMAL(10,2)   NOT NULL,
  description     VARCHAR(500)        NULL,
  reference_type  VARCHAR(50)         NULL COMMENT 'vehicles, shops, payroll, etc.',
  reference_id    INT UNSIGNED        NULL COMMENT 'FK to the referenced table row',
  created_by      INT UNSIGNED        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_expense_date     (expense_date),
  INDEX idx_expense_category (category_id),
  CONSTRAINT fk_expense_category
    FOREIGN KEY (category_id) REFERENCES expense_categories(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_expense_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id           BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED            NULL,
  action       VARCHAR(20)         NOT NULL COMMENT 'CREATE, UPDATE, DELETE',
  table_name   VARCHAR(64)         NOT NULL,
  record_id    INT UNSIGNED            NULL,
  old_values   JSON                    NULL,
  new_values   JSON                    NULL,
  ip_address   VARCHAR(45)             NULL,
  user_agent   VARCHAR(500)            NULL,
  created_at   DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_audit_user   (user_id),
  INDEX idx_audit_table  (table_name, record_id),
  INDEX idx_audit_date   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 11. DATABASE-LEVEL AUDIT TRIGGERS
-- ============================================================

DELIMITER //

-- Farmers triggers
CREATE TRIGGER trg_farmers_after_insert
AFTER INSERT ON farmers FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (action, table_name, record_id, new_values)
  VALUES ('CREATE', 'farmers', NEW.id, JSON_OBJECT(
    'farmer_code', NEW.farmer_code, 'name', NEW.name, 'phone', NEW.phone
  ));
END//

CREATE TRIGGER trg_farmers_after_update
AFTER UPDATE ON farmers FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (action, table_name, record_id, old_values, new_values)
  VALUES ('UPDATE', 'farmers', NEW.id,
    JSON_OBJECT('name', OLD.name, 'base_rate', OLD.base_rate, 'is_active', OLD.is_active),
    JSON_OBJECT('name', NEW.name, 'base_rate', NEW.base_rate, 'is_active', NEW.is_active)
  );
END//

CREATE TRIGGER trg_farmers_after_delete
AFTER DELETE ON farmers FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (action, table_name, record_id, old_values)
  VALUES ('DELETE', 'farmers', OLD.id, JSON_OBJECT('name', OLD.name, 'farmer_code', OLD.farmer_code));
END//

-- Milk records triggers
CREATE TRIGGER trg_milk_after_insert
AFTER INSERT ON milk_records FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (action, table_name, record_id, new_values)
  VALUES ('CREATE', 'milk_records', NEW.id, JSON_OBJECT(
    'farmer_id', NEW.farmer_id, 'collection_date', NEW.collection_date,
    'shift', NEW.shift, 'quantity_liters', NEW.quantity_liters,
    'computed_rate', NEW.computed_rate, 'total_amount', NEW.total_amount
  ));
END//

CREATE TRIGGER trg_milk_after_update
AFTER UPDATE ON milk_records FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (action, table_name, record_id, old_values, new_values)
  VALUES ('UPDATE', 'milk_records', NEW.id,
    JSON_OBJECT('quantity_liters', OLD.quantity_liters, 'computed_rate', OLD.computed_rate, 'total_amount', OLD.total_amount),
    JSON_OBJECT('quantity_liters', NEW.quantity_liters, 'computed_rate', NEW.computed_rate, 'total_amount', NEW.total_amount)
  );
END//

CREATE TRIGGER trg_milk_after_delete
AFTER DELETE ON milk_records FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (action, table_name, record_id, old_values)
  VALUES ('DELETE', 'milk_records', OLD.id, JSON_OBJECT(
    'farmer_id', OLD.farmer_id, 'collection_date', OLD.collection_date, 'total_amount', OLD.total_amount
  ));
END//

-- Bills trigger
CREATE TRIGGER trg_bills_after_update
AFTER UPDATE ON bills FOR EACH ROW
BEGIN
  IF OLD.status != NEW.status THEN
    INSERT INTO audit_logs (action, table_name, record_id, old_values, new_values)
    VALUES ('UPDATE', 'bills', NEW.id,
      JSON_OBJECT('status', OLD.status),
      JSON_OBJECT('status', NEW.status, 'net_payable', NEW.net_payable)
    );
  END IF;
END//

-- Expenses trigger
CREATE TRIGGER trg_expenses_after_insert
AFTER INSERT ON expenses FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (action, table_name, record_id, new_values)
  VALUES ('CREATE', 'expenses', NEW.id, JSON_OBJECT(
    'category_id', NEW.category_id, 'amount', NEW.amount,
    'expense_date', NEW.expense_date, 'description', NEW.description
  ));
END//

DELIMITER ;

-- ============================================================
-- 12. DEFAULT SEED DATA
-- ============================================================

-- Default expense categories
INSERT INTO expense_categories (name, description) VALUES
  ('Diesel',       'Fuel expenses for vehicles'),
  ('Vehicle Service', 'Maintenance and repair for vehicles'),
  ('Rent',         'Shop and office rent payments'),
  ('Salaries',     'Staff and employee salaries'),
  ('Utilities',    'Electricity, water, gas bills'),
  ('Procurement',  'Consumables, packaging, supplies'),
  ('Insurance',    'Vehicle and property insurance'),
  ('Miscellaneous','Other uncategorized expenses')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- Default admin user (password: Admin@1234 — CHANGE IN PRODUCTION)
-- bcrypt hash for "Admin@1234"
INSERT INTO users (name, email, password_hash, role, is_active, email_verified) VALUES
  ('System Admin', 'admin@dairy.local',
   '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'admin', 1, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

SET FOREIGN_KEY_CHECKS = 1;
