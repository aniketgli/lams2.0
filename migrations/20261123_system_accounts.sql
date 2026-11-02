-- Migration: system accounts.
-- users.is_system = 1 marks the two fixed accounts (erp@wii.gov.in Administrator, erpauditor@wii.gov.in Auditor).
-- A system account can never be edited, deactivated or deleted, is shown only in the Profiles table, and is left out of
-- every export, dropdown and employee list. Safe to re-run.

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_system'
);
SET @ddl := IF(@has_col = 0,
  'ALTER TABLE users ADD COLUMN is_system TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT ''users.is_system already exists''');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE users SET is_system = 1 WHERE email IN ('erp@wii.gov.in', 'erpauditor@wii.gov.in');
