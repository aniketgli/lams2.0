-- Migration: count of undone decisions on a manual attendance request.
-- A reporting manager may undo their own approve / reject once; an administrator any time.
-- Safe to re-run.

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'manual_attendance_requests' AND COLUMN_NAME = 'undo_count');
SET @ddl := IF(@has = 0,
  'ALTER TABLE manual_attendance_requests ADD COLUMN undo_count TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER manager_comment',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
