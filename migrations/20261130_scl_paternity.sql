-- Migration: Special Casual Leave for everyone, and Paternity Leave rules. Safe to re-run.
--
-- 1. leave_types.purposes: the purposes a leave type can be taken for, one per line (edited in
--    Leave > Leave Types). When it is filled, the apply form asks for one of them.
-- 2. leave_requests: the chosen purpose, and for Paternity Leave the birth / adoption details.
-- 3. Special Casual Leave (SCL): every employee (no longer persons with disability only), no balance,
--    no half day, taken for one of: National sports / cultural event, Family planning, Natural calamity,
--    Bandh. Its other rules stay those of Casual Leave (see 20261119_scl_like_cl.sql).
-- 4. Paternity Leave (PAT): male employees, no balance, no half day, at most 15 days in one application
--    and joinable with any leave. The birth / adoption checks are in server/leave/specialLeave.ts.
--
-- 5. Special Casual Leave is added to every leave group.
--
-- Only adds columns and changes leave settings, so the portal version before this change keeps working.

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_types' AND COLUMN_NAME = 'purposes');
SET @ddl := IF(@has = 0, 'ALTER TABLE leave_types ADD COLUMN purposes TEXT NULL', 'SELECT ''leave_types.purposes already exists''');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests' AND COLUMN_NAME = 'purpose');
SET @ddl := IF(@has = 0,
  'ALTER TABLE leave_requests ADD COLUMN purpose VARCHAR(150) NULL, ADD COLUMN child_event VARCHAR(10) NULL, ADD COLUMN child_event_date DATE NULL, ADD COLUMN child_birth_date DATE NULL, ADD COLUMN surviving_children TINYINT UNSIGNED NULL',
  'SELECT ''leave_requests.purpose already exists''');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE leave_types
SET pwd_only = 0,
    half_day_allowed = 0,
    is_debited = 0,
    purposes = IF(purposes IS NULL OR TRIM(purposes) = '',
                  CONCAT_WS(CHAR(10), 'National sports / cultural event', 'Family planning', 'Natural calamity', 'Bandh'),
                  purposes)
WHERE code = 'SCL' AND id > 0;

UPDATE leave_types
SET gender = 'male_only',
    pwd_only = 0,
    half_day_allowed = 0,
    is_debited = 0,
    max_consecutive_days = 15,
    combine_with = 'both'
WHERE code = 'PAT' AND id > 0;

-- Special Casual Leave is for everyone, so it is added to every leave group (an employee sees only the
-- leave types of their group). Groups that already have it are left as they are.
SET @has := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_group_types');
SET @ddl := IF(@has = 1,
  'INSERT IGNORE INTO leave_group_types (group_id, leave_type_id) SELECT g.id, t.id FROM leave_groups g JOIN leave_types t ON t.code = ''SCL''',
  'SELECT ''no leave groups yet''');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
