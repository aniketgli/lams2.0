-- Migration: default password for new employees + forced change at first sign-in.
-- Safe to re-run.
--
--   users.must_change_password  1 = the user must set their own password before using the portal
--                               (new employees, and after an administrator reset).
--   users.password_changed_at   when the user last set their own password.
--   account_settings            the default password for new employees, stored ONLY as a bcrypt hash.

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'must_change_password'
);
SET @ddl := IF(@has_col = 0,
  'ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT ''users.must_change_password already exists''');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_changed_at'
);
SET @ddl := IF(@has_col = 0,
  'ALTER TABLE users ADD COLUMN password_changed_at DATETIME NULL',
  'SELECT ''users.password_changed_at already exists''');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS account_settings (
  id                    VARCHAR(32)  NOT NULL PRIMARY KEY,   -- always 'default'
  default_password_hash VARCHAR(255) NULL,                   -- bcrypt hash; the password itself is never stored
  updated_by            VARCHAR(4)   NULL,                   -- biometric ID of the administrator
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
