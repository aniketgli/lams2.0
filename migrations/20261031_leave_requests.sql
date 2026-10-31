-- Leave requests and per-employee leave balances. Used / pending days are never stored:
-- they are always worked out from leave_requests, so they cannot drift.
CREATE TABLE IF NOT EXISTS leave_requests (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  leave_type_id   BIGINT UNSIGNED NOT NULL,
  start_date      DATE          NOT NULL,
  end_date        DATE          NOT NULL,
  start_session   VARCHAR(12)   NOT NULL DEFAULT 'full',   -- full | second_half (first day starts after lunch)
  end_session     VARCHAR(12)   NOT NULL DEFAULT 'full',   -- full | first_half (last day ends before lunch)
  days_count      DECIMAL(5,1)  NOT NULL,                  -- worked out by the server
  cycle_year      SMALLINT UNSIGNED NOT NULL,              -- calendar year (CY) or the year the financial year starts (FY)
  reason          VARCHAR(1000) NOT NULL,
  certificate     TINYINT(1)    NOT NULL DEFAULT 0,        -- applicant confirms a medical certificate will be submitted
  stages          TINYINT UNSIGNED NOT NULL DEFAULT 1,     -- approval stages of the leave type when applied
  status          VARCHAR(16)   NOT NULL DEFAULT 'pending_l1', -- pending_l1 | pending_l2 | approved | rejected
  applied_by      BIGINT UNSIGNED NOT NULL,
  manager_id      BIGINT UNSIGNED NULL,                    -- reporting manager when applied
  reviewer_id     BIGINT UNSIGNED NULL,                    -- HoD when applied
  l1_by           BIGINT UNSIGNED NULL,                    -- reporting manager who forwarded it to the HoD
  l1_at           DATETIME(3)   NULL,
  l1_comment      VARCHAR(500)  NULL,
  decided_stage   TINYINT UNSIGNED NULL,                   -- stage at which approved / rejected
  action_by       BIGINT UNSIGNED NULL,
  action_at       DATETIME(3)   NULL,
  manager_comment VARCHAR(500)  NULL,
  undo_count      TINYINT UNSIGNED NOT NULL DEFAULT 0,     -- steps undone at stage 1 (reporting manager)
  undo2_count     TINYINT UNSIGNED NOT NULL DEFAULT 0,     -- steps undone at stage 2 (HoD)
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_leave_user_start (user_id, start_date),
  KEY idx_leave_dates (start_date, end_date),
  KEY idx_leave_type (leave_type_id),
  KEY idx_leave_status (status)
);

CREATE TABLE IF NOT EXISTS leave_balances (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id        BIGINT UNSIGNED NOT NULL,
  leave_type_id  BIGINT UNSIGNED NOT NULL,
  cycle_year     SMALLINT UNSIGNED NOT NULL,
  total          DECIMAL(6,1)  NOT NULL,                   -- days granted for the year
  carry_forward  DECIMAL(6,1)  NOT NULL DEFAULT 0,         -- days brought from the last year
  created_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_leave_balance (user_id, leave_type_id, cycle_year),
  KEY idx_leave_balance_type (leave_type_id)
);
