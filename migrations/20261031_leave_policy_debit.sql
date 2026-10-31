-- A leave type that is debited from another leave type's balance (for example Commuted Leave: 2 days of Half Pay Leave for each day).
-- Run after 20261031_leave_policy_rules.sql.
ALTER TABLE leave_types
  ADD COLUMN debit_from_type_id BIGINT UNSIGNED NULL AFTER after_exhausted_type_id,
  ADD COLUMN debit_factor       DECIMAL(3,1) NOT NULL DEFAULT 1 AFTER debit_from_type_id;
