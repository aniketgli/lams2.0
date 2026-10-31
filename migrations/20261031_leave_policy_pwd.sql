-- Persons with disability (PwD): their own quota for a leave type, and leave types only they can take (e.g. Special Casual Leave).
-- Run after 20261031_leave_policy_debit.sql.
ALTER TABLE leave_types
  ADD COLUMN pwd_quota DECIMAL(6,1) NULL AFTER default_quota,                 -- days a year for a PwD employee; empty = same as everyone
  ADD COLUMN pwd_only  TINYINT(1)   NOT NULL DEFAULT 0 AFTER employee_types;  -- 1 = only PwD employees can take it
