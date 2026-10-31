-- Leave Policy master, second part: rules from the Leave Rules document and category-wise quotas.
-- Run after 20261031_leave_types.sql.
ALTER TABLE leave_types
  DROP COLUMN ccs_rule,
  DROP COLUMN ccs_category,
  ADD COLUMN is_paid                 TINYINT(1)    NOT NULL DEFAULT 1 AFTER is_debited,            -- 0 = unpaid (leave without pay)
  ADD COLUMN after_exhausted_type_id BIGINT UNSIGNED NULL AFTER is_paid,                           -- usable only once this leave type's balance is used up
  ADD COLUMN lifetime_max            DECIMAL(7,1)  NOT NULL DEFAULT 0 AFTER after_exhausted_type_id, -- days in the whole service; 0 = no limit
  ADD COLUMN max_spells_per_year     SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER lifetime_max;       -- separate applications in a leave year; 0 = no limit

-- Quota for one employee type, where it differs from the leave type's default quota
-- (for example Casual Leave: Researcher 30 days, Contractual 20 days).
CREATE TABLE IF NOT EXISTS leave_type_quotas (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  leave_type_id  BIGINT UNSIGNED NOT NULL,
  employee_type  VARCHAR(50)   NOT NULL,
  quota          DECIMAL(6,1)  NOT NULL,
  UNIQUE KEY uq_leave_type_quotas (leave_type_id, employee_type),
  CONSTRAINT fk_leave_type_quotas_type FOREIGN KEY (leave_type_id) REFERENCES leave_types (id) ON DELETE CASCADE
);
