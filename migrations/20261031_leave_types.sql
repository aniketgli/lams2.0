-- Leave types (the Leave Policy master). Created by the administrator; nothing is pre-filled.
CREATE TABLE IF NOT EXISTS leave_types (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code                 VARCHAR(20)   NOT NULL,
  name                 VARCHAR(100)  NOT NULL,
  description          VARCHAR(500)  NULL,
  default_quota        DECIMAL(6,1)  NOT NULL DEFAULT 0,        -- days a year
  accrual              VARCHAR(16)   NOT NULL DEFAULT 'yearly', -- yearly | half_yearly | quarterly | monthly | upfront
  max_accumulation     SMALLINT UNSIGNED NOT NULL DEFAULT 0,    -- 0 = no limit
  carry_forward        TINYINT(1)    NOT NULL DEFAULT 0,
  max_carry_forward    DECIMAL(6,1)  NOT NULL DEFAULT 0,
  encashment_allowed   TINYINT(1)    NOT NULL DEFAULT 0,
  approval_stages      TINYINT UNSIGNED NOT NULL DEFAULT 1,     -- 1 = reporting manager; 2 = reporting manager forwards, HoD approves
  min_notice_days      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  half_day_allowed     TINYINT(1)    NOT NULL DEFAULT 0,
  medical_cert_days    SMALLINT UNSIGNED NOT NULL DEFAULT 0,    -- certificate needed above this many days; 0 = never
  sandwich_rule        VARCHAR(8)    NOT NULL DEFAULT 'excluded', -- included | excluded
  employee_types       VARCHAR(500)  NOT NULL DEFAULT '',       -- employee_type codes, comma separated; empty = all
  gender               VARCHAR(12)   NOT NULL DEFAULT 'all',    -- all | female_only | male_only
  min_service_months   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  max_consecutive_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,    -- 0 = no limit
  is_debited           TINYINT(1)    NOT NULL DEFAULT 1,
  ccs_rule             VARCHAR(50)   NULL,
  ccs_category         VARCHAR(40)   NULL,
  status               VARCHAR(10)   NOT NULL DEFAULT 'active',
  created_at           DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_leave_types_code (code),
  UNIQUE KEY uq_leave_types_name (name)
);
