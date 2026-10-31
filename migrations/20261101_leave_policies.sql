-- Leave policies: one policy per employee category and version, each holding the leave types
-- (with their own entitlement and conditions), general rules, approval workflow and assignment.
-- Nothing is pre-filled. Active policies are never deleted; changes are made as a new version.
CREATE TABLE IF NOT EXISTS leave_policies (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code                  VARCHAR(30)  NOT NULL,
  name                  VARCHAR(150) NOT NULL,
  employee_category     VARCHAR(100) NOT NULL,                 -- lookup_values.code of the employee type
  version               VARCHAR(20)  NOT NULL DEFAULT '1.0',
  effective_from        DATE         NOT NULL,
  effective_to          DATE         NULL,
  year_cycle            VARCHAR(10)  NOT NULL,                 -- calendar | financial
  status                VARCHAR(10)  NOT NULL DEFAULT 'draft', -- draft | active | inactive
  description           VARCHAR(1000) NULL,
  -- general leave rules
  pro_rata              TINYINT(1)   NOT NULL DEFAULT 0,
  mid_year_joining      VARCHAR(10)  NOT NULL DEFAULT 'prorata', -- prorata | full | none
  backdated_leave       VARCHAR(12)  NOT NULL DEFAULT 'not_allowed', -- allowed | not_allowed
  notice_period_leave   VARCHAR(12)  NOT NULL DEFAULT 'not_allowed',
  sandwich_rule         VARCHAR(8)   NOT NULL DEFAULT 'excluded', -- included | excluded
  weekly_off            VARCHAR(8)   NOT NULL DEFAULT 'excluded',
  public_holiday        VARCHAR(8)   NOT NULL DEFAULT 'excluded',
  separation_balance    VARCHAR(8)   NOT NULL DEFAULT 'lapse',   -- lapse | encash | adjust
  general_remarks       VARCHAR(1000) NULL,
  -- approval workflow
  approval_mode         VARCHAR(12)  NOT NULL DEFAULT 'single_level', -- single_level | two_level
  workflow_status       VARCHAR(10)  NOT NULL DEFAULT 'enabled',      -- enabled | disabled (disabled = approved on application)
  l1_role               VARCHAR(30)  NULL,
  l1_mandatory          TINYINT(1)   NOT NULL DEFAULT 1,
  l2_role               VARCHAR(30)  NULL,
  l2_mandatory          TINYINT(1)   NOT NULL DEFAULT 1,
  -- employee assignment
  assignment_method     VARCHAR(16)  NOT NULL DEFAULT 'automatic',    -- automatic | manual | default_override
  department_scope      VARCHAR(10)  NOT NULL DEFAULT 'all',          -- all | selected
  departments           TEXT         NULL,                            -- JSON array of unit names
  designation_scope     VARCHAR(10)  NOT NULL DEFAULT 'all',
  designations          TEXT         NULL,                            -- JSON array of designation names
  assignment_remarks    VARCHAR(1000) NULL,
  -- administrative information
  reference_no          VARCHAR(100) NULL,
  order_date            DATE         NULL,
  official_remarks      VARCHAR(1000) NULL,
  created_by            BIGINT UNSIGNED NULL,
  created_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_leave_policy_version (code, version),
  KEY idx_leave_policy_category (employee_category, status)
);

CREATE TABLE IF NOT EXISTS leave_policy_items (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  policy_id            BIGINT UNSIGNED NOT NULL,
  leave_type_id        BIGINT UNSIGNED NOT NULL,
  annual_entitlement   DECIMAL(6,1) NOT NULL DEFAULT 0,
  accrual              VARCHAR(16)  NOT NULL DEFAULT 'yearly',
  accrual_quantity     DECIMAL(6,1) NOT NULL DEFAULT 0,
  max_balance          DECIMAL(6,1) NOT NULL DEFAULT 0,            -- 0 = no limit
  min_application      DECIMAL(4,1) NOT NULL DEFAULT 0,            -- 0 = no minimum
  max_application      DECIMAL(6,1) NOT NULL DEFAULT 0,            -- 0 = no maximum
  carry_forward        TINYINT(1)   NOT NULL DEFAULT 0,
  carry_limit          DECIMAL(6,1) NOT NULL DEFAULT 0,
  encashment           TINYINT(1)   NOT NULL DEFAULT 0,
  encash_limit         DECIMAL(6,1) NOT NULL DEFAULT 0,
  half_day             TINYINT(1)   NOT NULL DEFAULT 0,
  document_required    TINYINT(1)   NOT NULL DEFAULT 0,
  probation_applicable TINYINT(1)   NOT NULL DEFAULT 1,
  negative_balance     TINYINT(1)   NOT NULL DEFAULT 0,
  conditions           VARCHAR(500) NULL,
  sort_order           SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_policy_leave_type (policy_id, leave_type_id),
  CONSTRAINT fk_policy_item_policy FOREIGN KEY (policy_id) REFERENCES leave_policies (id) ON DELETE CASCADE,
  CONSTRAINT fk_policy_item_type FOREIGN KEY (leave_type_id) REFERENCES leave_types (id)
);
