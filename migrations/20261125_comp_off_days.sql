-- Migration: a compensatory off leave can take several days at once.
--   leave_comp_off_uses  one row per leave day: the worked day (work_date) that pays for it and the leave day (leave_date)
-- The monthly limit counts these rows by the month of leave_date, so a leave that crosses a month end is charged to each month.
-- Rows are copied from leave_requests.comp_off_date (single-day version); that column is no longer used. Safe to re-run.

CREATE TABLE IF NOT EXISTS leave_comp_off_uses (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id  BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  work_date   DATE NOT NULL,
  leave_date  DATE NOT NULL,
  UNIQUE KEY uq_comp_off_request_work (request_id, work_date),
  KEY idx_comp_off_user_work (user_id, work_date),
  KEY idx_comp_off_user_leave (user_id, leave_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO leave_comp_off_uses (request_id, user_id, work_date, leave_date)
SELECT id, user_id, comp_off_date, start_date FROM leave_requests WHERE comp_off_date IS NOT NULL;
