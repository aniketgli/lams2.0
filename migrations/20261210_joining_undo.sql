-- Migration: a joining report's last step (forward / approve / reject) can be undone within 10 minutes, like a leave.
-- undo_count:  steps undone at stage 1 (reporting manager may do it once).
-- undo2_count: steps undone at stage 2 (HoD may do it once). An administrator may undo any step.
-- Safe to re-run. Run it before using the new code: the joining report list reads these columns.

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_joining_reports' AND COLUMN_NAME = 'undo_count');
SET @ddl := IF(@has = 0,
  'ALTER TABLE leave_joining_reports ADD COLUMN undo_count TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER manager_comment',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_joining_reports' AND COLUMN_NAME = 'undo2_count');
SET @ddl := IF(@has = 0,
  'ALTER TABLE leave_joining_reports ADD COLUMN undo2_count TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER undo_count',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
