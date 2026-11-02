-- Migration: compensatory off earned by working a weekly off / holiday.
--   leave_requests.comp_off_date  the worked day a Compensatory Off (C-OFF) leave uses (one day each, never reused)
--   C-OFF "times a month" = 2, and C-OFF cannot be taken as a half day
-- The days earned come from the biometric log (never manual attendance); the validity is one month. Safe to re-run.

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests' AND COLUMN_NAME = 'comp_off_date'
);
SET @ddl := IF(@has_col = 0,
  'ALTER TABLE leave_requests ADD COLUMN comp_off_date DATE NULL, ADD KEY idx_leave_comp_off (user_id, comp_off_date)',
  'SELECT ''leave_requests.comp_off_date already exists''');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE leave_types SET max_spells_per_month = 2, half_day_allowed = 0 WHERE id > 0 AND code = 'C-OFF';
