-- Migration: salutation (Mr. / Mrs. / Ms. / Miss / Dr. / Prof.) on the employee profile.
-- Adds employee_profiles.suffix only if it does not exist yet, so it is safe to re-run.
-- (Replaces src/db/migrations/0001_add_employee_suffix.sql, which referenced a
--  user_id column this table does not have.)
SET @has_suffix := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_profiles' AND COLUMN_NAME = 'suffix'
);
SET @ddl := IF(@has_suffix = 0,
  'ALTER TABLE employee_profiles ADD COLUMN suffix VARCHAR(10) NULL AFTER biometric_id',
  'SELECT ''employee_profiles.suffix already exists''');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
