-- Migration: Maternity Leave (MAT) and Child Care Leave (CCL) rules. Safe to re-run.
--
-- 1. leave_requests: Child Care Leave details (which child, child with a disability, single mother).
--    Only Child Care Leave writes them; every other leave works before this migration is run.
-- 2. Maternity Leave: female employees; no yearly balance; no half day; 2 stages (Reporting Manager, then HoD);
--    holidays inside it count. The form asks: birth / adoption (180 days in one go, To worked out from From,
--    less than two surviving children, adoption of a child under one year starting on the date of adoption) or
--    abortion / miscarriage (up to 45 days, after it happened, medical certificate, once in the service).
--    Birth / adoption maternity leave can be joined with any other kind of leave.
-- 3. Child Care Leave: female employees; treated like Earned Leave (2 stages, holidays inside it count);
--    730 days in the whole service (no yearly balance); LTC can be taken with it; no half day.
--    The form asks which of the two eldest children, the child's date of birth (below 18, no limit with a
--    disability) and single mother (6 spells a year instead of 3). It cannot start today or earlier.
-- The checks are in server/leave/specialLeave.ts.

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests' AND COLUMN_NAME = 'child_order');
SET @ddl := IF(@has = 0,
  'ALTER TABLE leave_requests ADD COLUMN child_order TINYINT UNSIGNED NULL, ADD COLUMN child_disabled TINYINT(1) NOT NULL DEFAULT 0, ADD COLUMN single_parent TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT ''leave_requests.child_order already exists''');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE leave_types
SET gender = 'female_only',
    pwd_only = 0,
    half_day_allowed = 0,
    is_debited = 0,
    approval_stages = 2,
    sandwich_rule = 'included',
    hod_after_days = 0,
    max_consecutive_days = 180,
    combine_with = 'both'
WHERE code = 'MAT' AND id > 0;

UPDATE leave_types
SET gender = 'female_only',
    pwd_only = 0,
    half_day_allowed = 0,
    is_debited = 0,
    approval_stages = 2,
    sandwich_rule = 'included',
    hod_after_days = 0,
    lifetime_max = 730,
    max_spells_per_year = 0,
    ltc_allowed = 1
WHERE code = 'CCL' AND id > 0;
