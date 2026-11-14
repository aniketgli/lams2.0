-- Migration: a leave balance is set "as on" a date. Safe to re-run.
--
-- When the Leave Balance Manager / Administrator sets a balance, it is the balance on that date: leaves that start
-- before it are already reflected in it and are not deducted again; only leaves from that date on come off it.
-- Adding or deducting days keeps the date. Rows without a date (set before this migration) count every leave of the year.

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_balances' AND COLUMN_NAME = 'as_of');
SET @ddl := IF(@has = 0, 'ALTER TABLE leave_balances ADD COLUMN as_of DATE NULL', 'SELECT ''leave_balances.as_of already exists''');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
